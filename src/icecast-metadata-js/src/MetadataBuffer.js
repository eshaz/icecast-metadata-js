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

// Use fast buffer allocation if this is a NodeJS runtime or Uint8Array if a browser runtime
const bufferFunction =
  typeof module !== "undefined" && module.exports
    ? (length) => Buffer.allocUnsafe(length)
    : (length) => new Uint8Array(length);

/**
 * @description Stores a collection of buffers as an array.
 */
class MetadataBuffer {
  constructor(expectedLength) {
    this._buffer = bufferFunction(expectedLength);
    this._length = 0;
  }

  get length() {
    return this._length;
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
