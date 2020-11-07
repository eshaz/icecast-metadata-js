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

export default class Box {
  static LENGTH_SIZE = 4;

  /**
   * @description ISO/IEC 14496-12 Part 12 ISO Base Media File Format Box
   * @param {string} name Name of the box (i.e. 'moov', 'moof', 'traf')
   * @param {object} params Object containing contents or boxes
   * @param {Uint8Array} [params.contents] Array of bytes to insert into this box
   * @param {Array<Box>} [params.boxes] Array of boxes to insert into this box
   */
  constructor(name, { contents = [], boxes = [] } = {}) {
    this._contents = Uint8Array.from([
      ...Box.stringToU8intArray(name),
      ...contents,
    ]);
    this._boxes = boxes;
  }

  /**
   * @description Converts a string to a byte array
   * @param {string} name String to convert
   * @returns {Uint8Array}
   */
  static stringToU8intArray(name) {
    const array = [];
    for (const char of name) {
      array.push(char.charCodeAt(0));
    }
    return Uint8Array.from(array);
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
   * @returns {number} Total length of this box and all contents
   */
  get length() {
    return this._boxes.reduce(
      (acc, box) => acc + box.length,
      Box.LENGTH_SIZE + this._contents.length
    );
  }

  /**
   * @returns {Uint8Array} Contents of this box
   */
  get contents() {
    const contents = [
      ...this._contents,
      ...this._boxes.flatMap((box) => [...box.contents]),
    ];

    return Uint8Array.from([
      ...Box.getUint32(Box.LENGTH_SIZE + contents.length),
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

    this._boxes.push(box);
  }

  /**
   * @description Inserts bytes into the contents of this box
   * @param {Uint8Array} data Bytes to insert
   * @param {number} index Position to insert bytes
   */
  insertBytes(data, index) {
    const insertOffset = index + 4;
    this._contents = Uint8Array.from([
      ...this._contents.subarray(0, insertOffset),
      ...data,
      ...this._contents.subarray(insertOffset),
    ]);
  }

  /**
   * @description Appends data to the end of the contents of this box
   * @param {Uint8Array} data Bytes to append
   */
  appendBytes(data) {
    this._contents = Uint8Array.from([...this._contents, ...data]);
  }
}
