import {
  IcecastMetadataQueue,
  IcecastReadableStream,
} from "icecast-metadata-js";
import CodecParser from "codec-parser";

import {
  p,
  state,
  event,
  audioElement,
  enableLogging,
  enableCodecUpdate,
  endpointGenerator,
  metadataTypes,
  icyMetaInt,
  icyCharacterEncoding,
  icyDetectionTimeout,
  playbackMethod,
  fireEvent,
  hasIcy,
  abortController,
  playerState,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
  noOp,
  authentication,
} from "./global.js";

import Player from "./players/Player.js";
import HTML5Player from "./players/HTML5Player.js";
import MediaSourcePlayer from "./players/MediaSourcePlayer.js";
import WebAudioPlayer from "./players/WebAudioPlayer.js";

export default class PlayerFactory {
  constructor(icecast) {
    const instanceVariables = p.get(icecast);

    this._icecast = icecast;
    this._audioElement = instanceVariables[audioElement];
    this._enableLogging = instanceVariables[enableLogging];
    this._enableCodecUpdate = instanceVariables[enableCodecUpdate];

    this._playbackMethod = "";

    this._newMetadataQueues();
    this._player = new Player(this._icecast);
    this._player.icecastMetadataQueue = this._icecastMetadataQueue;
    this._player.codecUpdateQueue = this._codecUpdateQueue;
    this._player.enablePlayButton();

    this._unprocessedFrames = [];
    this._codecParser = undefined;
    this._inputMimeType = "";
    this._codec = "";

    this._syncPromise = Promise.resolve();
    this._syncCancel = noOp;
  }

  static get supportedPlaybackMethods() {
    return [MediaSourcePlayer, WebAudioPlayer, HTML5Player].map((player) =>
      player.isSupported ? player.name : "",
    );
  }

  static canPlayType(type) {
    return {
      mediasource: MediaSourcePlayer.canPlayType(type),
      html5: HTML5Player.canPlayType(type),
      webaudio: WebAudioPlayer.canPlayType(type),
    };
  }

  get endpoint() {
    return this._endpoint;
  }

  get player() {
    return this._player;
  }

  get playbackMethod() {
    return this._playbackMethod;
  }

  get icyMetaInt() {
    return (
      this._icecastReadableStream && this._icecastReadableStream.icyMetaInt
    );
  }

  async playStream() {
    return this.fetchStream()
      .then(async (res) => {
        this._icecast[fireEvent](event.STREAM_START);

        return this.readIcecastResponse(res).finally(() => {
          this._icecast[fireEvent](event.STREAM_END);
        });
      })
      .catch((e) => {
        if (this._icecast.state !== state.SWITCHING) throw e;
      });
  }

  async switchStream() {
    if (this._icecast.state !== state.PLAYING) {
      this._syncCancel();
      await this._syncPromise;
    }

    const instance = p.get(this._icecast);

    instance[playerState] = state.SWITCHING;
    instance[abortController].abort();
    instance[abortController] = new AbortController();
  }

  async fetchStream() {
    const instanceVariables = p.get(this._icecast);
    this._endpoint = instanceVariables[endpointGenerator].next().value;

    const headers = instanceVariables[hasIcy] ? { "Icy-MetaData": 1 } : {};
    // Work around for Icecast implementations that require range
    headers["Range"] = "bytes=0-";

    if (instanceVariables[authentication]) {
      const auth = instanceVariables[authentication];
      headers["Authorization"] =
        "Basic " + btoa(auth.user + ":" + auth.password);
    }

    const request = () =>
      fetch(this._endpoint, {
        method: "GET",
        headers,
        signal: instanceVariables[abortController].signal,
      });

    const res = await request().catch((e) => {
      // work around for Safari desktop to remove Range header for CORS
      // Even though it's a safelisted header, and this shouldn't be needed
      // See: https://fetch.spec.whatwg.org/#cors-safelisted-request-header
      if (
        e.name === "TypeError" &&
        (e.message === "Load failed" ||
          e.message ===
            "Request header field Range is not allowed by Access-Control-Allow-Headers.")
      ) {
        delete headers["Range"];
        return request();
      }
      throw e;
    });

    if (!res.ok) {
      const error = new Error(`${res.status} received from ${res.url}`);
      error.name = "HTTP Response Error";
      throw error;
    }

    return res;
  }

  async readIcecastResponse(res) {
    const inputMimeType = res.headers.get("content-type");
    const instanceVariables = p.get(this._icecast);

    let onCodecHeader;
    const codecHeaderPromise = new Promise((resolve) => {
      onCodecHeader = resolve;
    });

    const codecPromise = new Promise((onCodec) => {
      this._codecParser = new CodecParser(inputMimeType, {
        onCodec,
        onCodecHeader,
        onCodecUpdate:
          this._enableCodecUpdate &&
          ((...args) => this._player.onCodecUpdate(...args)),
        enableLogging: this._enableLogging,
      });
    });

    this._icecastReadableStream = new IcecastReadableStream(res, {
      onMetadata: async (metadata) => {
        this._player.onMetadata(metadata);
      },
      onStream: async ({ stream }) => {
        this._icecast[fireEvent](event.STREAM, stream);

        const frames = [...this._codecParser.parseChunk(stream)];

        if (this._player.isAudioPlayer) {
          const appendedFrames = [...this._unprocessedFrames, ...frames];
          this._unprocessedFrames = [];

          await this._player.onStream(appendedFrames);
        } else {
          this._unprocessedFrames.push(...frames);
        }
      },
      onError: (...args) => this._icecast[fireEvent](event.WARN, ...args),
      metadataTypes: instanceVariables[metadataTypes],
      icyCharacterEncoding: instanceVariables[icyCharacterEncoding],
      icyDetectionTimeout: instanceVariables[icyDetectionTimeout],
      ...(instanceVariables[icyMetaInt]
        ? { icyMetaInt: instanceVariables[icyMetaInt] }
        : {}),
    });

    const icecastPromise = this._icecastReadableStream.startReading();
    const codec = await codecPromise;

    if (!this._player.isAudioPlayer) {
      [this._player, this._playbackMethod] = this._buildPlayer(
        inputMimeType,
        codec,
        codecHeaderPromise,
      );
    }

    if (this._player.syncState === SYNCED) {
      this._player.start();
    } else {
      await this._syncPlayer(inputMimeType, codec, codecHeaderPromise);
    }

    await icecastPromise;
  }

  async _syncPlayer(inputMimeType, codec, codecHeaderPromise) {
    let delayTimeoutId,
      canceled = false,
      playerStarted = false,
      complete;

    const oldPlayer = this._player;
    const oldIcecastMetadataQueue = this._player.icecastMetadataQueue;
    const oldCodecUpdateQueue = this._player.codecUpdateQueue;

    this._newMetadataQueues();
    // intercept all new metadata updates
    oldPlayer.icecastMetadataQueue = this._icecastMetadataQueue;
    oldPlayer.codecUpdateQueue = this._codecUpdateQueue;

    const startNewPlayer = () => {
      playerStarted = true;
      if (
        this._icecast.state !== state.STOPPING ||
        this._icecast.state !== state.STOPPED
      ) {
        oldPlayer.icecastMetadataQueue.purgeMetadataQueue();
        oldPlayer.codecUpdateQueue.purgeMetadataQueue();
        this._player
          .start(Math.max(0, oldPlayer.syncDelay / 1000))
          .then(() => oldPlayer.end())
          .then(complete);
      }
    };

    this._syncCancel = () => {
      canceled = true;

      this._icecastMetadataQueue.purgeMetadataQueue();
      this._codecUpdateQueue.purgeMetadataQueue();

      this._player.icecastMetadataQueue = oldIcecastMetadataQueue;
      this._player.codecUpdateQueue = oldCodecUpdateQueue;

      if (delayTimeoutId !== undefined && !playerStarted) {
        clearTimeout(delayTimeoutId);
        startNewPlayer();
      }
    };

    const handleSyncEvent = () => {
      return this._player.syncStateUpdate.then((syncState) => {
        if (canceled) complete();
        else
          switch (syncState) {
            case SYNCING:
              return handleSyncEvent();
            case SYNCED: // synced on crc32 hashes
              // put old queues back since audio data is crc synced
              this._icecastMetadataQueue.purgeMetadataQueue();
              this._codecUpdateQueue.purgeMetadataQueue();
              this._player.icecastMetadataQueue = oldIcecastMetadataQueue;
              this._player.codecUpdateQueue = oldCodecUpdateQueue;

              if (
                this._icecast.state !== state.STOPPING ||
                this._icecast.state !== state.STOPPED
              )
                this._icecast[playerState] = state.PLAYING;

              complete();
              break;
            case PCM_SYNCED:
            case NOT_SYNCED:
              // put old queues back so they can be purged when the player is ended
              oldPlayer.icecastMetadataQueue = oldIcecastMetadataQueue;
              oldPlayer.codecUpdateQueue = oldCodecUpdateQueue;

              [this._player, this._playbackMethod] = this._buildPlayer(
                inputMimeType,
                codec,
                codecHeaderPromise,
              );

              this._unprocessedFrames.push(...oldPlayer.syncFrames);

              // start player after delay or immediately
              delayTimeoutId = setTimeout(
                startNewPlayer,
                Math.max(oldPlayer.syncDelay, 0),
              );
          }
      });
    };

    let stoppingHandler;

    this._syncPromise = new Promise((resolve) => {
      complete = resolve;

      // cancel switch event if stop is called
      stoppingHandler = () => {
        this._syncCancel();
        complete();
      };

      this._icecast.addEventListener(state.STOPPING, stoppingHandler, {
        once: true,
      });

      handleSyncEvent();
    }).finally(() => {
      this._icecast.removeEventListener(state.STOPPING, stoppingHandler);
    });
  }

  _newMetadataQueues() {
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (...args) =>
        this._icecast[fireEvent](event.METADATA, ...args),
      onMetadataEnqueue: (...args) =>
        this._icecast[fireEvent](event.METADATA_ENQUEUE, ...args),
      paused: true,
    });

    this._codecUpdateQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (...args) =>
        this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
      paused: true,
    });
  }

  _buildPlayer(inputMimeType, codec, codecHeader) {
    // in order of preference
    const { [p.get(this._icecast)[playbackMethod]]: firstMethod, ...rest } = {
      mediasource: MediaSourcePlayer,
      webaudio: WebAudioPlayer,
      html5: HTML5Player,
    };

    let player, method;

    for (const Player of Object.values({ firstMethod, ...rest })) {
      const support = Player.canPlayType(`${inputMimeType};codecs="${codec}"`);

      if (support === "probably" || support === "maybe") {
        method = Player.name;
        player = new Player(
          this._icecast,
          this._endpoint,
          inputMimeType,
          codec,
          codecHeader,
        );
        player.icecastMetadataQueue = this._icecastMetadataQueue;
        player.codecUpdateQueue = this._codecUpdateQueue;
        break;
      }
    }

    if (!player) {
      throw new Error(
        `Your browser does not support this audio codec ${inputMimeType}${
          codec && `;codecs="${codec}"`
        }`,
      );
    }

    return [player, method];
  }
}
