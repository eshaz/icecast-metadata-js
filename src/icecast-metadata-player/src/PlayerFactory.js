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
  endpoint,
  enableLogging,
  enableCodecUpdate,
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
    this._player.enablePlayButton(PlayerFactory.supportedPlaybackMethods);

    this._unprocessedFrames = [];
    this._codecParser = undefined;
    this._inputMimeType = "";
    this._codec = "";
  }

  static get supportedPlaybackMethods() {
    return [MediaSourcePlayer, WebAudioPlayer, HTML5Player].map((player) =>
      player.isSupported ? player.name : ""
    );
  }

  static canPlayType(type) {
    return {
      mediasource: MediaSourcePlayer.canPlayType(type),
      html5: HTML5Player.canPlayType(type),
      webaudio: WebAudioPlayer.canPlayType(type),
    };
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
    return this.fetchStream().then(async (res) => {
      this._icecast[fireEvent](event.STREAM_START);

      return this.readIcecastResponse(res).finally(() => {
        this._icecast[fireEvent](event.STREAM_END);
      });
    });
  }

  async fetchStream() {
    const instanceVariables = p.get(this._icecast);

    const res = await fetch(instanceVariables[endpoint], {
      method: "GET",
      headers: instanceVariables[hasIcy] ? { "Icy-MetaData": 1 } : {},
      signal: instanceVariables[abortController].signal,
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

    const codecPromise = new Promise((onCodec) => {
      this._codecParser = new CodecParser(inputMimeType, {
        onCodecUpdate:
          this._enableCodecUpdate &&
          ((...args) => this._player.onCodecUpdate(...args)),
        onCodec,
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
          await this._player.onStream([...this._unprocessedFrames, ...frames]);

          this._unprocessedFrames = [];
        } else {
          this._unprocessedFrames.push(...frames);
        }
      },
      onError: (...args) => this._icecast[fireEvent](event.WARN, ...args),
      metadataTypes: instanceVariables[metadataTypes],
      icyCharacterEncoding: instanceVariables[icyCharacterEncoding],
      icyDetectionTimeout: instanceVariables[icyDetectionTimeout],
      icyMetaInt: instanceVariables[icyMetaInt],
    });

    const icecastPromise = this._icecastReadableStream.startReading();
    const codec = await codecPromise;

    if (!this._player.isAudioPlayer) {
      [this._player, this._playbackMethod] = this._buildPlayer(
        inputMimeType,
        codec
      );
    }

    if (this._player.syncState === SYNCED) {
      this._player.start();
    } else {
      await this._syncPlayer(inputMimeType, codec);
    }

    await icecastPromise;
  }

  async _syncPlayer(inputMimeType, codec) {
    const oldIcecastMetadataQueue = this._player.icecastMetadataQueue;
    const oldCodecUpdateQueue = this._player.codecUpdateQueue;

    this._newMetadataQueues();
    // intercept all new metadata updates
    this._player.icecastMetadataQueue = this._icecastMetadataQueue;
    this._player.codecUpdateQueue = this._codecUpdateQueue;

    const handleSyncEvent = (complete, cancel) => {
      // need to handle metadata updates while syncing
      return this._player.syncStateUpdate.then((syncState) => {
        switch (syncState) {
          case SYNCING:
            return handleSyncEvent(complete, cancel);
          case SYNCED: // synced on crc32 hashes
            if (this._icecast.state === state.SWITCHING)
              this._icecast[fireEvent](event.PLAY);

            // put old queues back since audio data is crc synced
            this._icecastMetadataQueue.purgeMetadataQueue();
            this._codecUpdateQueue.purgeMetadataQueue();
            this._player.icecastMetadataQueue = oldIcecastMetadataQueue;
            this._player.codecUpdateQueue = oldCodecUpdateQueue;
            complete();
            break;
          case PCM_SYNCED:
          case NOT_SYNCED:
            const oldPlayer = this._player;
            // put old queues back so they can be purged when the player is ended
            oldPlayer.icecastMetadataQueue = oldIcecastMetadataQueue;
            oldPlayer.codecUpdateQueue = oldCodecUpdateQueue;

            [this._player, this._playbackMethod] = this._buildPlayer(
              inputMimeType,
              codec
            );

            this._unprocessedFrames.push(...oldPlayer.syncFrames);

            let delayTimeoutId;

            const stoppingHandler = () => {
              clearTimeout(delayTimeoutId);
              this._player = oldPlayer;
              cancel();
            };

            // cancel switch event if stop is called
            this._icecast.addEventListener(state.STOPPING, stoppingHandler, {
              once: true,
            });

            // start player after delay or immediately
            delayTimeoutId = setTimeout(() => {
              if (this._icecast.state === state.SWITCHING) {
                oldPlayer.end();
                this._player
                  .start(Math.max(0, oldPlayer.syncDelay / 1000))
                  .then(complete);
              }

              this._icecast.removeEventListener(
                state.STOPPING,
                stoppingHandler
              );
            }, Math.max(oldPlayer.syncDelay, 0));
        }
      });
    };

    let cancel;
    await new Promise((complete, reject) => {
      // cancel switch event if stop is called
      cancel = () => {
        oldIcecastMetadataQueue.purgeMetadataQueue();
        oldCodecUpdateQueue.purgeMetadataQueue();
        reject();
      };

      this._icecast.addEventListener(state.STOPPING, cancel, { once: true });

      handleSyncEvent(complete, cancel);
    });

    this._icecast.removeEventListener(state.STOPPING, cancel);

    if (this._icecast.state === state.SWITCHING)
      this._icecast[playerState] = state.PLAYING;
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

  _buildPlayer(inputMimeType, codec) {
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
        player = new Player(this._icecast, inputMimeType, codec);
        player.icecastMetadataQueue = this._icecastMetadataQueue;
        player.codecUpdateQueue = this._codecUpdateQueue;
        break;
      }
    }

    if (!player) {
      throw new Error(
        `Your browser does not support this audio codec ${inputMimeType}${
          codec && `;codecs="${codec}"`
        }`
      );
    }

    return [player, method];
  }
}

// statically initialize audio context and start using a DOM event
if (WebAudioPlayer.isSupported) {
  const audioCtxErrorHandler = (e) => {
    console.error(
      "icecast-metadata-js",
      "Failed to start the AudioContext. WebAudio playback will not be possible.",
      e
    );
  };

  // hack for iOS Audio element controls support
  // iOS will only enable AudioContext.resume() when called directly from a UI event
  // https://stackoverflow.com/questions/57510426
  const events = ["touchstart", "touchend", "mousedown", "keydown"];

  const unlock = () => {
    events.forEach((e) => document.removeEventListener(e, unlock));

    const audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      latencyHint: "playback",
    });

    audioCtx
      .resume()
      .then(() => {
        // hack for iOS to continue playing while locked
        audioCtx
          .createScriptProcessor(2 ** 14, 2, 2)
          .connect(audioCtx.destination);

        audioCtx.onstatechange = () => {
          if (audioCtx.state !== "running")
            audioCtx.resume().catch(audioCtxErrorHandler);
        };
      })
      .catch(audioCtxErrorHandler);

    PlayerFactory.constructor.audioContext = audioCtx;
  };

  events.forEach((e) => document.addEventListener(e, unlock));
}
