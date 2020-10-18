export default class StreamBuffer {
  constructor(length) {
    this._buffer = new Uint8Array(length);
    this._currentLength = 0;
  }

  /**
   * @type {number} Length of all stored data in bytes
   */
  get length() {
    return this._currentLength;
  }

  /**
   * @type {Uint8Array} Returns all stored data
   */
  get read() {
    return this._buffer.subarray(0, this._currentLength);
  }

  /**
   * @description Appends data to the currently allocated buffer
   * @param {Uint8Array} data Data to append
   */
  append(data) {
    this._buffer.set(data, this._currentLength);
    this._currentLength += data.length;
  }
}
