const Decoder = require("util").TextDecoder || TextDecoder;
const Stats = require("./Stats");

const noOp = () => {};

// Use fast buffer allocation if this is a NodeJS runtime or Uint8Array if a browser runtime
const bufferFunction = Buffer
  ? (length) => Buffer.allocUnsafe(length)
  : (length) => new Uint8Array(length);

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

    this._generator = this._passThroughParser();
    this._generator.next();
  }

  *_passThroughParser() {
    this._remainingData = Infinity;
    while (true) {
      yield* this._sendStream(yield* this._getNextValue());
    }
  }

  static _concatBuffers(buf1, buf2) {
    const result = bufferFunction(buf1.length + buf2.length);
    result.set(buf1);
    result.set(buf2, buf1.length);
    return result;
  }

  /**
   * @description Returns an iterator that yields stream or metadata.
   * @param {Uint8Array} chunk Next chunk of data to read
   * @returns {IterableIterator} Iterator that operates over a raw icecast response.
   * @yields {object} Object containing stream or metadata.
   */
  *iterator(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      yield i.value;
    }
  }

  /**
   * @description Reads all data in the passed in chunk and calls the onStream and onMetadata callbacks.
   * @param {Uint8Array} chunk Next chunk of data to read
   */
  readAll(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {}
  }

  /**
   * @description Returns an async iterator that yields stream or metadata and awaits the onStream and onMetadata callbacks.
   * @param {Uint8Array} chunk Next chunk of data to read
   * @returns {IterableIterator} Iterator that operates over a raw icecast response.
   * @yields {object} Object containing stream or metadata.
   */
  async *asyncIterator(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      await this._onStreamPromise;
      await this._onMetadataPromise;
      yield i.value;
    }
  }

  /**
   * @description Reads all data in the chunk and awaits the onStream and onMetadata callbacks.
   * @param {Uint8Array} chunk Next chunk of data to read
   */
  async asyncReadAll(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      await this._onStreamPromise;
      await this._onMetadataPromise;
    }
  }

  *_sendStream(stream) {
    this._stats.addStreamBytes(stream.length);

    const streamPayload = { stream, stats: this._stats.stats };

    this._onStreamPromise = this._onStream(streamPayload);
    yield streamPayload;
  }

  *_sendMetadata(metadata) {
    const metadataPayload = {
      metadata,
      stats: this._stats.stats,
    };

    this._onMetadataPromise = this._onMetadata(metadataPayload);
    yield metadataPayload;
  }

  *_getNextValue(minLength = 0) {
    if (this._currentPosition === this._buffer.length) {
      this._buffer = yield* this._readData();
      this._currentPosition = 0;
    }

    while (this._buffer.length - this._currentPosition < minLength) {
      const newData = yield* this._readData();
      const temp = bufferFunction(this._buffer.length + newData.length);
      temp.set(this._buffer);
      temp.set(newData, this._buffer.length);
      this._buffer = temp;
    }

    const value = this._buffer.subarray(
      this._currentPosition,
      (minLength || this._remainingData) + this._currentPosition
    );

    this._remainingData -= value.length;
    this._currentPosition += value.length;

    return value;
  }

  *_readData() {
    let data;

    do {
      data = yield; // if out of data, accept new data in the .next() call
    } while (!data || data.length === 0);

    this._stats.addCurrentBytesRemaining(data.length);
    return data;
  }
}

module.exports = MetadataParser;
