/**
 * @description Stores a collection of buffers as a linked list.
 */
export default class BufferArray {
  constructor() {
    this.init();
    this._bufferFunction = (length) => new Uint8Array(length);
  }

  /**
   * @description Resets all internal state
   */
  init() {
    this._buffers = [];
    this._totalBytes = 0;
    this._currentLength = 0;
    this._currentIndex = -1;
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
    let offset = 0;
    this._buffers.length && this._trimTail();
    const returnBuffer = this._newBuffer(this._totalBytes);

    this._buffers.forEach((buf) => {
      returnBuffer.set(buf, offset);
      offset += buf.length;
    });

    this.init();

    return returnBuffer;
  }

  /**
   * @description Adds a new buffer using Buffer.allocUnsafe
   * @param {number} length Bytes to allocate for the buffer
   */
  addBuffer(length) {
    this._buffers.length && this._trimTail();
    this._buffers.push(this._newBuffer(length));
    this._currentLength = 0;
    this._currentIndex++;
  }

  /**
   * @description Appends data to the currently allocated buffer
   * @param {Uint8Array} data Data to append
   */
  append(data) {
    this._buffers[this._currentIndex].set(data, this._currentLength);
    this._currentLength += data.length;
    this._totalBytes += data.length;
  }

  _trimTail() {
    this._buffers[this._currentIndex] = this._buffers[
      this._currentIndex
    ].subarray(0, this._currentLength);
  }

  _newBuffer(length) {
    return this._bufferFunction(length);
  }
}
