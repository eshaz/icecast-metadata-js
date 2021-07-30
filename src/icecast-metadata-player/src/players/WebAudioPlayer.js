import { OpusDecoder } from "opus-decoder";
import { MPEGDecoder } from "mpg123-decoder";

import FrameQueue from "../FrameQueue.js";
import {
  state,
  event,
  SYNCED,
  SYNCING,
  NOT_SYNCED,
  fireEvent,
} from "../global.js";
import Player from "./Player.js";

export default class WebAudioPlayer extends Player {
  constructor(icecast, inputMimeType, codec) {
    super(icecast, inputMimeType, codec);

    this._icecast.addEventListener(event.RETRY, () => {
      this._syncState = NOT_SYNCED;
    });

    this.reset();
  }

  static canPlayType(mimeType) {
    const mapping = {
      mpeg: ["audio/mpeg"],
      ogg: {
        opus: ['audio/ogg;codecs="opus"'],
      },
    };

    if (!window.WebAssembly) return "";
    if (!(window.AudioContext || window.webkitAudioContext)) return "";
    if (!window.MediaStream) return "";

    return super.canPlayType(
      (codec) => codec === 'audio/ogg;codecs="opus"' || codec === "audio/mpeg",
      mimeType,
      mapping
    );
  }

  static get name() {
    return "webaudio";
  }

  get isAudioPlayer() {
    return true;
  }

  get metadataTimestamp() {
    return (
      (this._currentSample + this._currentSampleOffset) / this._sampleRate || 0
    );
  }

  get currentTime() {
    return (Date.now() - this._startTime) / 1000 || 0;
  }

  async reset() {
    this._syncState = SYNCED;
    this._syncSuccessful = false;
    this._frameQueue = new FrameQueue(this._icecast);

    this._currentSample = 0;
    this._currentSampleOffset = 0;
    this._sampleRate = 0;
    this._startTime = undefined;
    this._firedPlay = false;

    // reset audio context
    if (this._audioContext) this._audioContext.close();

    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // hack for safari to continue playing while locked
    this._scriptProcessor = this._audioContext.createScriptProcessor(
      2 ** 14,
      2,
      2
    );
    this._scriptProcessor.connect(this._audioContext.destination);

    this._mediaStream = this._audioContext.createMediaStreamDestination();
    this._audioElement.srcObject = this._mediaStream.stream;

    // reset opus decoder
    if (this._wasmDecoder) {
      await this._wasmDecoder.ready;
      this._wasmDecoder.free();
    }

    switch (this._codec) {
      case "mpeg":
        this._wasmDecoder = new MPEGDecoder();
        break;
      case "opus":
        this._wasmDecoder = new OpusDecoder();
        break;
    }
  }

  async onStream(oggPages) {
    let frames = oggPages.flatMap((oggPage) => oggPage.codecFrames || oggPage);

    switch (this._syncState) {
      case NOT_SYNCED:
        this._frameQueue.initSync();
        this._syncState = SYNCING;
      case SYNCING:
        [frames, this._syncSuccessful] = this._frameQueue.sync(frames);

        if (frames.length) {
          this._syncState = SYNCED;

          if (!this._syncSuccessful) await this.reset();
        }
      case SYNCED:
        if (frames.length) {
          await this._wasmDecoder.ready;
          const decoded = this._wasmDecoder.decodeFrames(
            frames.map((f) => f.data)
          );
          this.playDecodedAudio(decoded);
        }
      default:
        this._frameQueue.addAll(frames); // always add frames
    }
  }

  playDecodedAudio({ channelData, samplesDecoded, sampleRate }) {
    if (
      this._icecast.state !== state.STOPPING &&
      this._icecast.state !== state.STOPPED &&
      samplesDecoded
    ) {
      if (!this._sampleRate) this._sampleRate = sampleRate;
      if (!this._startTime) this._startTime = Date.now();

      if (this.metadataTimestamp < this._audioContext.currentTime) {
        // audio context time starts incrementing immediately when it's created
        // offset needs to be accounted for to prevent overlapping sources
        this._currentSampleOffset += Math.floor(
          this._audioContext.currentTime * this._sampleRate
        );
      }

      const audioBuffer = this._audioContext.createBuffer(
        channelData.length,
        samplesDecoded,
        this._sampleRate
      );

      channelData.forEach((channel, idx) =>
        audioBuffer.getChannelData(idx).set(channel)
      );

      const source = this._audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this._mediaStream);
      source.start(this.metadataTimestamp);

      if (!this._firedPlay) {
        this._icecast[fireEvent](event.PLAY);
        this._firedPlay = true;
      }

      this._currentSample += samplesDecoded;
    }
  }
}
