const AppendableBuffer = require("../AppendableBuffer");
const Decoder = require("util").TextDecoder || TextDecoder;
const Stats = require("./Stats");

const noOp = () => {};

class MetadataParser {
  constructor({ onStream = noOp, onMetadata = noOp } = {}) {
    this._remainingData = 0;
    this._currentPosition = 0;
    this._buffer = new Uint8Array(0);
    this._stats = new Stats();
    this._decoder = new Decoder("utf-8");

    this._onStream = onStream;
    this._onMetadata = onMetadata;
    this._onStreamPromise = Promise.resolve();
    this._onMetadataPromise = Promise.resolve();

    //this._generator = this._generator();
    //this._generator.next();
  }

  async asyncReadAll(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {}
  }

  *_getStream(remainingData) {
    this._remainingData = remainingData;
    this._stats.currentStreamBytesRemaining = remainingData;

    do {
      const stream = yield* this._getNextValue();
      this._stats.addStreamBytes(stream.length);

      const streamPayload = { stream, stats: this._stats.stats };

      console.log("stream");

      this._onStreamPromise = this._onStream(streamPayload);
      yield streamPayload;
    } while (this._remainingData);
  }

  *_getMetadata(remainingData) {
    this._remainingData = remainingData;
    this._stats.currentMetadataBytesRemaining = this._remainingData;

    const metadataBuffer = new AppendableBuffer(this._remainingData);

    do {
      metadataBuffer.append(yield* this._getNextValue());
    } while (this._remainingData); // store any partial metadata updates

    this._stats.addMetadataBytes(metadataBuffer.length);

    const metadataPayload = {
      metadata: this.parseMetadata(metadataBuffer.buffer),
      stats: this._stats.stats,
    };

    this._onMetadataPromise = this._onMetadata(metadataPayload);
    yield metadataPayload;
  }

  *_getNextValue(minLength) {
    while (this._currentPosition === this._buffer.length) {
      this._buffer = yield* this._readData(minLength);
      this._currentPosition = 0;
    }
    const value = this._buffer.subarray(
      this._currentPosition,
      this._remainingData + this._currentPosition
    );

    this._remainingData -= value.length;
    this._currentPosition += value.length;

    return value;
  }

  *_readData(minLength = 0) {
    this._buffer = yield;

    while (!this._buffer && this._buffer.length < minLength) {
      if (data && data.length) {
        const temp = new Uint8Array(this._buffer.length + data.length);
        temp.set(this._buffer);
        temp.set(data, this._buffer.length);
        this._buffer = temp;
      }
    }

    return this._buffer;
  }
}

module.exports = MetadataParser;
