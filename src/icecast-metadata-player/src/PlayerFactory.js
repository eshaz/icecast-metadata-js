import { IcecastReadableStream } from "icecast-metadata-js";
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
  constructor(icecast, preferredPlaybackMethod) {
    const instanceVariables = p.get(icecast);

    this._icecast = icecast;
    this._enableLogging = instanceVariables[enableLogging];
    this._enableCodecUpdate = instanceVariables[enableCodecUpdate];
    this._audioElement = instanceVariables[audioElement];
    this._metadataTypes = instanceVariables[metadataTypes];
    this._icyMetaInt = instanceVariables[icyMetaInt];
    this._icyCharacterEncoding = instanceVariables[icyCharacterEncoding];
    this._icyDetectionTimeout = instanceVariables[icyDetectionTimeout];
    this._preferredPlaybackMethod = instanceVariables[playbackMethod];

    this._playbackMethod = "";
    this._player = new Player(this._icecast);
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
      metadataTypes: this._metadataTypes,
      icyCharacterEncoding: this._icyCharacterEncoding,
      icyDetectionTimeout: this._icyDetectionTimeout,
      ...(this._icyMetaInt && { icyMetaInt: this._icyMetaInt }),
    });

    const icecastPromise = this._icecastReadableStream.startReading();
    const codec = await codecPromise;

    if (!this._player.isAudioPlayer) {
      [this._player, this._playbackMethod] = this._buildPlayer(
        inputMimeType,
        codec
      );
      this._player.start();
    } else {
      await this._syncPlayer(inputMimeType, codec);
    }

    await icecastPromise;
  }

  async _syncPlayer(inputMimeType, codec) {
    console.log("switching player");
    const handleSyncEvent = async () => {
      const syncState = await this._player.syncStateUpdate;
      //console.log(syncState);

      switch (syncState) {
        case PCM_SYNCED:
        case NOT_SYNCED:
          const oldPlayer = this._player;

          const startNewPlayer = () => {
            oldPlayer.end();
            this._icecast[fireEvent](event.PLAY);
            return this._player.start();
          };

          // all new stream and metadata will be pushed to the new player
          [this._player, this._playbackMethod] = this._buildPlayer(
            inputMimeType,
            codec
          );

          this._unprocessedFrames.push(...oldPlayer.syncFrames);

          if (oldPlayer.syncDelay) {
            await new Promise((resolve) => {
              setTimeout(() => {
                if (this._icecast.state === state.SWITCHING) {
                  startNewPlayer().then(resolve);
                }
              }, oldPlayer.syncDelay * 1000);
            });
          } else {
            await startNewPlayer();
          }

          break;
        case SYNCING:
          return handleSyncEvent(); // still syncing
        case SYNCED: // synced on crc32 hashes
      }
    };

    await handleSyncEvent();

    console.log("player switched");
  }

  _buildPlayer(inputMimeType, codec) {
    // in order of preference
    const { [this._preferredPlaybackMethod]: firstMethod, ...rest } = {
      mediasource: MediaSourcePlayer,
      webaudio: WebAudioPlayer,
      html5: HTML5Player,
    };

    let player, playbackMethod;

    for (const Player of Object.values({ firstMethod, ...rest })) {
      const support = Player.canPlayType(`${inputMimeType};codecs="${codec}"`);

      if (support === "probably" || support === "maybe") {
        playbackMethod = Player.name;
        player = new Player(this._icecast, inputMimeType, codec);
        return [player, playbackMethod];
      }
    }

    if (player) {
      throw new Error(
        `Your browser does not support this audio codec ${inputMimeType}${
          codec && `;codecs="${codec}"`
        }`
      );
    }
  }
}
