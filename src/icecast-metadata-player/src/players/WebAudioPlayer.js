import { OpusStreamDecoder } from "opus-stream-decoder";
import CodecParser from "codec-parser";

import { state, event, fireEvent } from "../global.js";
import Player from "./Player.js";

export default class WebAudioPlayer extends Player {
  constructor(icecast) {
    super(icecast);

    this._opusDecoder = new OpusStreamDecoder({
      onDecodeAll: (decodedAudio) => {
        this._onDecode(decodedAudio);
      },
    });
  }

  get metadataTimestamp() {
    return (this._currentSample + this._currentSampleOffset) / this._sampleRate;
  }

  async play() {
    this._audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();

    this._currentSample = 0;
    this._currentSampleOffset = 0;
    this._sampleRate = 48000; // opus
    this._startTime = undefined;

    // store any non audio ogg pages
    this._oggPageBuffers = [];
    this._oggPageBuffersLength = 0;

    console.log(this._audioContext.destination);

    return super.play();
  }

  reset() {
    this._opusDecoder.ready.then(() => this._opusDecoder.free());
    this._audioContext && this._audioContext.close();
  }

  getOnStream(res) {
    const inputMimeType = res.headers.get("content-type");

    this._codecParser = new CodecParser(inputMimeType, {
      onCodecUpdate: (...args) =>
        this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
    });

    return async ({ stream }) => {
      for await (const oggPage of this._codecParser.iterator(stream)) {
        let raw = oggPage.rawData;

        if (oggPage.codecFrames.length === 0) {
          this._oggPageBuffers.push(raw);
          this._oggPageBuffersLength += raw.length;
        } else {
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
