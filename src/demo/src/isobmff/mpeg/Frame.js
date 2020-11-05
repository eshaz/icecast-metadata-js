export default class Frame {
  constructor(header, data) {
    this._header = header;
    this._data = data;
  }

  get header() {
    return this._header;
  }

  get data() {
    return this._data;
  }
}
