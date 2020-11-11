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

export default class Box extends ISOBMFFObject {
  /**
   * @description ISO/IEC 14496-12 Part 12 ISO Base Media File Format Box
   * @param {string} name Name of the box (i.e. 'moov', 'moof', 'traf')
   * @param {object} params Object containing contents or boxes
   * @param {Array<Uint8>} [params.contents] Array of bytes to insert into this box
   * @param {Array<Box>} [params.boxes] Array of boxes to insert into this box
   */
  constructor(name, { contents = [], boxes = [] } = {}) {
    super(name, [...Box.stringToByteArray(name), ...contents], boxes);

    this.LENGTH_SIZE = 4;
  }

  /**
   * @description Converts a string to a byte array
   * @param {string} name String to convert
   * @returns {Uint8Array}
   */
  static stringToByteArray(name) {
    const array = [];
    for (const char of name) {
      array.push(char.charCodeAt(0));
    }
    return array;
  }

  /**
   * @description Converts a JavaScript number to Uint32
   * @param {number} number Number to convert
   * @returns {Uint32}
   */
  static getUint32(number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number, false);
    return bytes;
  }

  /**
   * @returns {Uint8Array} Contents of this box
   */
  get contents() {
    const contents = super.contents;
    return Uint8Array.from([
      ...Box.getUint32(this.LENGTH_SIZE + contents.length),
      ...contents,
    ]);
  }

  /**
   * @description Adds a Box to this box
   * @param {Box} box Box to add
   */
  addBox(box) {
    if (box.constructor !== Box) {
      console.error("Only an object of type Box can be appended");
      throw new Error("Not a box");
    }

    this.addObject(box);
  }
}
