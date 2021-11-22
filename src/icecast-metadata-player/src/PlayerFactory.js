import { IcecastReadableStream } from "icecast-metadata-js";
import CodecParser from "codec-parser";
import {
  p,
  event,
  audioElement,
  endpoint,
  enableLogging,
  enableCodecUpdate,
  metadataTypes,
  icyMetaInt,
  icyCharacterEncoding,
  icyDetectionTimeout,
  fireEvent,
  hasIcy,
  abortController,
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
    this._endpoint = instanceVariables[endpoint];
    this._metadataTypes = instanceVariables[metadataTypes];
    this._icyMetaInt = instanceVariables[icyMetaInt];
    this._icyCharacterEncoding = instanceVariables[icyCharacterEncoding];
    this._icyDetectionTimeout = instanceVariables[icyDetectionTimeout];

    this._hasIcy = instanceVariables[hasIcy];

    this._preferredPlaybackMethod = preferredPlaybackMethod || "mediasource";
    this._playbackMethod = "";
    this._player = new Player(this._icecast);
    this._unprocessedFrames = [];
    this._codecParser = undefined;
    this._inputMimeType = "";
    this._codec = "";
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
    const res = await fetch(this._endpoint, {
      method: "GET",
      headers: this._hasIcy ? { "Icy-MetaData": 1 } : {},
      signal: p.get(this._icecast)[abortController].signal,
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

    if (!this._player.isAudioPlayer) {
      this._buildPlayer(inputMimeType, await codecPromise);
    }

    await icecastPromise;
  }

  _buildPlayer(inputMimeType, codec) {
    // in order of preference
    const { [this._preferredPlaybackMethod]: firstMethod, ...rest } = {
      mediasource: MediaSourcePlayer,
      webaudio: WebAudioPlayer,
      html5: HTML5Player,
    };

    for (const player of Object.values({ firstMethod, ...rest })) {
      const support = player.canPlayType(`${inputMimeType};codecs="${codec}"`);

      if (support === "probably" || support === "maybe") {
        this._playbackMethod = player.name;
        this._player = new player(this._icecast, inputMimeType, codec);
        break;
      }
    }

    if (!this._player) {
      throw new Error(
        `Your browser does not support this audio codec ${inputMimeType}${
          codec && `;codecs="${codec}"`
        }`
      );
    }
  }
}
