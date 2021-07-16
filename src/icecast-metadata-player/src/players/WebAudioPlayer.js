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

    // mp3 32kbs silence
    this._audioElement.src =
      "data:audio/mpeg;base64,//sQxAAABFgC/SCEYACCgB9AAAAAppppVCAHBAEIgBByw9WD5+J8ufwxiDED" +
      "sMfE+D4fwG/RUGCx6VO4awVxV3qDtQNPiXKnZUNSwKuUDR6IgaeoGg7Fg6pMQU1FMy4xMDCqqqqqqqr/+xL" +
      "EB4PAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" +
      "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=";

    this._audioElement.loop = true;

    this.reset();
  }

  get metadataTimestamp() {
    return (this._currentSample + this._currentSampleOffset) / this._sampleRate;
  }

  async reset() {
    this._syncState = SYNCED;
    this._syncSuccessful = false;
    this._frameQueue = new FrameQueue(this._icecast);

    this._currentSample = 0;
    this._currentSampleOffset = 0;
    this._sampleRate = 48000; // opus
    this._startTime = undefined;

    // reset audio context
    if (this._audioContext) this._audioContext.close();

    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    // reset opus decoder
    if (this._opusDecoder) {
      await this._opusDecoder.ready;
      this._opusDecoder.free();
    }

    this._opusDecoder = new OpusStreamDecoder({
      onDecodeAll: (decodedAudio) => {
        this._onDecode(decodedAudio);
      },
    });
  }

  getOnStream(res) {
    const inputMimeType = res.headers.get("content-type");
    this._codecParser = new CodecParser(inputMimeType, {
      onCodecUpdate: (...args) =>
        this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
    });

    this._resetOggPageBuffer();

    return async ({ stream }) => {
      for await (const oggPage of this._codecParser.iterator(stream)) {
        let oggPageData = oggPage.rawData;

        if (oggPage.codecFrames.length === 0) {
          // store any initialization pages
          this._addOggPageBuffer(oggPageData);
        } else {
          let frames = [oggPage];

          switch (this._syncState) {
            case NOT_SYNCED:
              this._frameQueue.initSync();
              this._syncState = SYNCING;
            case SYNCING:
              [frames, this._syncSuccessful] = this._frameQueue.sync(frames);

              if (frames.length) {
                this._syncState = SYNCED;

                if (this._syncSuccessful) {
                  // don't append the initial ogg pages when recovering from sync
                  this._resetOggPageBuffer();
                } else {
                  // there is a gap in the old and new frames so reset everything and start over decoding
                  await this.reset();
                }
              } else {
                break;
              }
            case SYNCED:
              if (this._oggPageBufferLength) {
                // add the first audio page to the buffer
                this._addOggPageBuffer(oggPageData);
                // get the initialization pages along with the first audio page to be sent to the decoder
                oggPageData = this._getOggPageBuffer();

                this._resetOggPageBuffer();
              }

              await this._opusDecoder.ready;
              this._opusDecoder.decode(oggPageData);
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

  _addOggPageBuffer(oggPageData) {
    this._oggPageBuffer.push(oggPageData);
    this._oggPageBufferLength += oggPageData.length;
  }

  _getOggPageBuffer() {
    const data = new Uint8Array(this._oggPageBufferLength);

    let offset = 0;
    for (const buf of this._oggPageBuffer) {
      data.set(buf, offset);
      offset += buf.length;
    }

    return data;
  }

  _resetOggPageBuffer() {
    // store any non audio ogg pages
    this._oggPageBuffer = [];
    this._oggPageBufferLength = 0;
  }
}
