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
    this._stats.addMetadataBytes(metadata.length);

    const metadataPayload = {
      metadata: this.parseMetadata(metadata),
      stats: this._stats.stats,
    };

    this._onMetadataPromise = this._onMetadata(metadataPayload);
    yield metadataPayload;
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

  *_getNextValue(length = 0) {
    while (this._currentPosition === this._buffer.length) {
      this._buffer = yield* this._readData(length);
      this._currentPosition = 0;
    }
    const value = this._buffer.subarray(
      this._currentPosition,
      (length || this._remainingData) + this._currentPosition
    );

    this._remainingData -= value.length;
    this._currentPosition += value.length;

    return value;
  }

  *_readData(minLength = 0) {
    /*
    while (!this._buffer && this._buffer.length < minLength) {
      const temp = new Uint8Array(this._buffer.length + data.length);
      temp.set(this._buffer);
      temp.set(data, this._buffer.length);
      this._buffer = temp;
    }
    */

    let data;

    do {
      data = yield; // if out of data, accept new data in the .next() call
    } while (!data || data.length === 0);

    this._stats.addCurrentBytesRemaining(data.length);
    return data;
  }
}

module.exports = MetadataParser;
