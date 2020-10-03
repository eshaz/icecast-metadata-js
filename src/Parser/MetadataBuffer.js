const bufferFunction =
  typeof module !== "undefined" && module.exports
    ? (length) => Buffer.allocUnsafe(length)
    : (length) => new Uint8Array(length);

/**
 * @description Stores a collection of buffers as an array.
 */
class MetadataBuffer {
  constructor(expectedLength) {
    // Use fast buffer allocation if this is a NodeJS runtime or Uint8Array if a browser runtime
    this._buffer = bufferFunction(expectedLength);
    this._length = 0
  }

  /**
   * @type {Uint8Array} Returns all stored data
   */
  pop() {
    return this._buffer;
  }

  push(data) {
    this._buffer.set(data, this._length);
    this._length += data.length;
  }
}

module.exports = MetadataBuffer;
