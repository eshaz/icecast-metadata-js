export default class Frame {
  constructor(header, buffer) {
    this._header = header;
    this._data = buffer.subarray(0, header.frameByteLength);
  }

  get header() {
    return this._header;
  }

  get data() {
    return this._data;
  }

  get isComplete() {
    return !(this._header.frameByteLength - this._data.length);
  }
}
