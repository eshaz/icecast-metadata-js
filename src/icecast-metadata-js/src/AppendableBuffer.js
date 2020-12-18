/* Copyright 2020 Ethan Halsall
    This file is part of icecast-metadata-js.

    icecast-metadata-js free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    icecast-metadata-js distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

// Use fast buffer allocation if this is a NodeJS runtime or Uint8Array if a browser runtime
const bufferFunction = Buffer
  ? (length) => Buffer.allocUnsafe(length)
  : (length) => new Uint8Array(length);

/**
 * @description Stores a collection of buffers as an array.
 */
class AppendableBuffer {
  constructor(expectedLength) {
    this._buffer = bufferFunction(expectedLength);
    this._length = 0;
  }

  /**
   * @description Concatenates passed in buffers and returns a single buffer
   * @param  {...Uint8Array} buffers
   * @static
   */
  static appendBuffers(...buffers) {
    return buffers.reduce(
      (acc, buffer) => acc.append(buffer),
      new AppendableBuffer(
        buffers.reduce((acc, buffer) => acc + buffer.length, 0)
      )
    ).buffer;
  }

  get length() {
    return this._length;
  }

  get buffer() {
    return this._buffer;
  }

  append(data) {
    this._buffer.set(data, this._length);
    this._length += data.length;
    return this;
  }
}

module.exports = AppendableBuffer;
