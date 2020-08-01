/**
 * @description Stores a collection of buffers as a linked list.
 */
class BufferArray {
  constructor() {
    this.init();

    // Use fast buffer allocation if this is a NodeJS runtime or Uint8Array if a browser runtime
    this._bufferFunction =
      typeof module !== "undefined" && module.exports
        ? (length) => Buffer.allocUnsafe(length)
        : (length) => new Uint8Array(length);
  }

  /**
   * @description Resets all internal state
   */
  init() {
    this._buffers = [];
    this._totalBytes = 0;
    this._currentLength = 0;
    this._numberBuffers = 0;
  }

  /**
   * @type {number} Length of all stored data in bytes
   */
  get length() {
    return this._totalBytes;
  }

  /**
   * @type {Uint8Array} Returns all stored data
   */
  get readAll() {
    let current = this._head;
    let offset = 0;
    this._trimTail();
    const returnBuffer = this._newBuffer(this._totalBytes);

    this._buffers.forEach((buf) => {
      returnBuffer.set(buf, offset);
      offset += buf.length;
    });

    return returnBuffer;
  }

  /**
   * @description Adds a new buffer using Buffer.allocUnsafe
   * @param {number} length Bytes to allocate for the buffer
   */
  newBuffer(length) {
    this._buffers.push(this._newBuffer(length));
  }

  /**
   * @description Appends data to the currently allocated buffer
   * @param {Uint8Array} data Data to append
   */
  append(data) {
    this._buffers[this._numberBuffers].set(data, this._currentLength);
    this._currentLength += data.length;
    this._totalBytes += data.length;
  }

  _trimTail() {
    this._buffers[this._numberBuffers] = this._buffers[
      this._numberBuffers
    ].subarray(0, this._currentLength);
  }

  _newBuffer(length) {
    return this._bufferFunction(length);
  }
}

module.exports = BufferArray;
