import { OpusDecoderWebWorker } from "opus-decoder";
import { MPEGDecoderWebWorker } from "mpg123-decoder";
import { FLACDecoderWebWorker } from "@wasm-audio-decoders/flac";

import {
  audioContext,
  event,
  state,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
  fireEvent,
} from "../global.js";
import Player from "./Player.js";

export default class WebAudioPlayer extends Player {
  constructor(icecast, inputMimeType, codec) {
    super(icecast, inputMimeType, codec);

    this._audioContext = icecast[audioContext];

    this._createDecoder();
    this._init();
  }

  static canPlayType(mimeType) {
    const mapping = {
      flac: ["audio/flac"],
      mpeg: ["audio/mpeg"],
      ogg: {
        flac: ['audio/ogg;codecs="flac"'],
        opus: ['audio/ogg;codecs="opus"'],
      },
    };

    if (!WebAudioPlayer.isSupported) return "";

    return super.canPlayType(
      (codec) =>
        codec === 'audio/ogg;codecs="opus"' ||
        codec === 'audio/ogg;codecs="flac"' ||
        codec === "audio/mpeg" ||
        codec === "audio/flac",
      mimeType,
      mapping
    );
  }

  static get isSupported() {
    return Boolean(
      window.WebAssembly &&
        (window.AudioContext || window.webkitAudioContext) &&
        window.MediaStream
    );
  }

  static get name() {
    return "webaudio";
  }

  get isAudioPlayer() {
    return true;
  }

  get metadataTimestamp() {
    return this._currentTime / 1000;
  }

  get currentTime() {
    return (performance.now() - this._playbackStartTime) / 1000 || 0;
  }

  _createDecoder() {
    switch (this._codec) {
      case "mpeg":
        this._wasmDecoder = new MPEGDecoderWebWorker();
        break;
      case "opus":
        this._wasmDecoder = new OpusDecoderWebWorker();
        break;
      case "flac":
        this._wasmDecoder = new FLACDecoderWebWorker();
        break;
    }
  }

  async _init() {
    super._init();

    this._currentTime = 0;
    this._decodedSample = 0;
    this._decodedSampleOffset = 0;
    this._sampleRate = 0;
    this._playbackStartTime = undefined;
    this._playReady = false;

    this._playPromise = new Promise((resolve) => {
      this._playStart = resolve;
    });
  }

  async start(metadataOffset) {
    if (!this._wasmDecoder) this._createDecoder();

    const playing = super.start(metadataOffset);
    this._playStart();
    await playing;
  }

  async end() {
    super.end();

    if (this._wasmDecoder) {
      const decoder = this._wasmDecoder;
      decoder.ready.then(() => decoder.free());

      this._wasmDecoder = null;
    }

    if (this._mediaStream) {
      // disconnect the currently playing media stream
      this._mediaStream.stream
        .getTracks()
        .forEach((track) => this._mediaStream.stream.removeTrack(track));
    }

    this._init();
  }

  async onStream(oggPages) {
    let frames = oggPages.flatMap((oggPage) => oggPage.codecFrames || oggPage);

    switch (this.syncState) {
      case NOT_SYNCED:
        this._frameQueue.initSync();
        this.syncState = SYNCING;
      case SYNCING:
        [this.syncFrames, this.syncState, this.syncDelay] =
          await this._frameQueue.sync(frames);
        frames = this.syncFrames;
    }

    switch (this.syncState) {
      case PCM_SYNCED:
        break;
      case SYNCED:
        // when frames are present, we should already know the codec and have the mse audio mimetype determined
        if (frames.length) {
          this._currentTime = frames[frames.length - 1].totalDuration;

          this._decode(frames).then((decoded) => this._play(decoded));
        }

        this._frameQueue.addAll(frames);
        break;
    }
  }

  async _decode(frames) {
    await this._wasmDecoder.ready;

    return this._wasmDecoder.decodeFrames(frames.map((f) => f.data));
  }

  async _play({ channelData, samplesDecoded, sampleRate }) {
    await this._playPromise;

    if (
      this._icecast.state !== state.STOPPING &&
      this._icecast.state !== state.STOPPED &&
      samplesDecoded
    ) {
      this._icecast[fireEvent](event.STREAM, {
        channelData,
        samplesDecoded,
        sampleRate,
      });

      if (!this._sampleRate) {
        this._sampleRate = sampleRate;

        this._mediaStream = this._audioContext.createMediaStreamDestination();
        this._audioElement.srcObject = this._mediaStream.stream; // triggers canplay event
      }

      const decodeDuration =
        (this._decodedSample + this._decodedSampleOffset) / this._sampleRate;

      if (decodeDuration < this._audioContext.currentTime) {
        // audio context time starts incrementing immediately when it's created
        // offset needs to be accounted for to prevent overlapping sources
        this._decodedSampleOffset += Math.floor(
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
      source.start(decodeDuration);

      if (!this._playReady) {
        if (this._bufferLength <= this.metadataTimestamp) {
          this._icecast[fireEvent](event.PLAY_READY);
          this._playbackStartTime = performance.now();

          this._startMetadataQueues();
          this._icecast[fireEvent](event.PLAY);
          this._playReady = true;
        } else {
          this._icecast[fireEvent](event.BUFFER, this.metadataTimestamp);
        }
      }

      this._decodedSample += samplesDecoded;
    }
  }
}
