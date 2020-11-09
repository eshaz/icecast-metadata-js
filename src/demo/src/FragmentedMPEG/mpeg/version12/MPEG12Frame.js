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

export default class MPEG12Frame {
  constructor(header, data) {
    this._header = header;
    this._data = data;
  }

  /**
   * @returns Total length of frame (header + data)
   */
  get length() {
    return this._data.length;
  }

  /**
   * @returns {MPEG12Header} This frame's Instance of MPEG12 Header
   */
  get header() {
    return this._header;
  }

  /**
   * @returns {MPEG12Header} {Uint8Array} The frame data (includes header)
   */
  get data() {
    return this._data;
  }
}
