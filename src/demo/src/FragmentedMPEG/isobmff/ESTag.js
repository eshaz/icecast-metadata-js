import ISOBMFFObject from "./ISOBMFFObject";

export default class ESTag extends ISOBMFFObject {
  constructor(tagNumber, { contents = [], tags = [] } = {}) {
    super(tagNumber, contents, tags);
    this.LENGTH_SIZE = 1;
  }

  /**
   * @returns {Uint8Array} Contents of this stream descriptor tag
   */
  get contents() {
    const contents = super.contents;

    /* prettier-ignore */
    return [
      this._name,
      0x80,0x80,0x80,
      contents.length,
    ].concat(contents);
  }

  addTag(tag) {
    this.addObject(tag);
  }
}
