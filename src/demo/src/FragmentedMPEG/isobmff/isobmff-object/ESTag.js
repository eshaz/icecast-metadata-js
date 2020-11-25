/* Copyright 2020 Ethan Halsall

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

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
