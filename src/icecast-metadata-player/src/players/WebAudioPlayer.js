import { OpusStreamDecoder } from "opus-stream-decoder";
import CodecParser from "codec-parser";

import FrameQueue from "../FrameQueue.js";
import { state, event, fireEvent } from "../global.js";
import Player from "./Player.js";

// sync state
const NOT_SYNCED = Symbol("not_synced");
const SYNCING = Symbol("syncing");
const SYNCED = Symbol("synced");

export default class WebAudioPlayer extends Player {
  constructor(icecast) {
    super(icecast);

    this._icecast.addEventListener(event.RETRY, () => {
      this._syncState = NOT_SYNCED;
    });

    this._opusDecoder = new OpusStreamDecoder({
      onDecodeAll: (decodedAudio) => {
        this._onDecode(decodedAudio);
      },
    });

    this.reset();
  }

  get metadataTimestamp() {
    return (this._currentSample + this._currentSampleOffset) / this._sampleRate;
  }

  async reset() {
    this._syncState = SYNCED;
    this._recoveredFromSync = false;
    this._frameQueue = new FrameQueue(this._icecast);

    this._currentSample = 0;
    this._currentSampleOffset = 0;
    this._sampleRate = 48000; // opus
    this._startTime = undefined;

    if (this._audioContext) this._audioContext.close();

    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    if (this._opusDecoder) {
      await this._opusDecoder.ready
        .then(() => this._opusDecoder.free())
        .then(() => {
          this._opusDecoder = new OpusStreamDecoder({
            onDecodeAll: (decodedAudio) => {
              this._onDecode(decodedAudio);
            },
          });
        });
    }
  }

  _initOggPageBuffer() {
    // store any non audio ogg pages
    this._oggPageBuffers = [];
    this._oggPageBuffersLength = 0;
  }

  getOnStream(res) {
    const inputMimeType = res.headers.get("content-type");
    this._codecParser = new CodecParser(inputMimeType, {
      onCodecUpdate: (...args) =>
        this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
    });

    this._initOggPageBuffer();

    return async ({ stream }) => {
      for await (const oggPage of this._codecParser.iterator(stream)) {
        let raw = oggPage.rawData;

        if (oggPage.codecFrames.length === 0) {
          this._oggPageBuffers.push(raw);
          this._oggPageBuffersLength += raw.length;
        } else {
          let frames = [oggPage];

          switch (this._syncState) {
            case NOT_SYNCED:
              this._frameQueue.initSync();
              this._syncState = SYNCING;
            case SYNCING:
              [frames, this._recoveredFromSync] = this._frameQueue.sync(frames);

              if (frames.length) {
                this._syncState = SYNCED;

                if (!this._recoveredFromSync) {
                  await this.reset();
                } else {
                  // don't append the initial ogg pages
                  this._initOggPageBuffer();
                }
              } else {
                break;
              }
            case SYNCED:
              if (this._oggPageBuffersLength) {
                this._oggPageBuffers.push(raw);
                this._oggPageBuffersLength += raw.length;

                raw = new Uint8Array(this._oggPageBuffersLength);
                let offset = 0;

                for (const buf of this._oggPageBuffers) {
                  raw.set(buf, offset);
                  offset += buf.length;
                }

                this._oggPageBuffers = [];
                this._oggPageBuffersLength = 0;
              }

              await this._opusDecoder.ready;
              this._opusDecoder.decode(raw);
            default:
              this._frameQueue.addAll(frames); // always add frames
          }
        }
      }
    };
  }

  getOnMetadata() {
    return (value) => {
      this._icecastMetadataQueue.addMetadata(
        value,
        this.metadataTimestamp,
        (Date.now() - this._startTime) / 1000 || 0
      );
    };
  }

  _onDecode({ channelData, samplesDecoded }) {
    if (
      this._icecast.state !== state.STOPPING &&
      this._icecast.state !== state.STOPPED
    ) {
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
      source.connect(this._audioContext.destination);
      source.start(this.metadataTimestamp);

      this._currentSample += samplesDecoded;
    }
  }
}
