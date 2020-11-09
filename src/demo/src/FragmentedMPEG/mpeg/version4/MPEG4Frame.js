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

export default class MPEG4Frame {
  constructor(header, data) {
    this._header = header;
    this._data = data.subarray(this._header.headerByteLength);
    this._length = data.length;
  }

  /**
   * @returns Total length of frame (header + data)
   */
  get length() {
    return this._length;
  }

  /**
   * @returns {MPEG4Header} This frame's Instance of MPEG4 Header
   */
  get header() {
    return this._header;
  }

  /**
   * @returns {Uint8Array} The frame data (does not include header)
   */
  get data() {
    return this._data;
  }
}
