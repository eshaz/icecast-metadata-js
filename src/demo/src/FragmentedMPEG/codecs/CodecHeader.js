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

export default class CodecHeader {
  /**
   * @private
   */
  constructor(header) {
    this._channelMode = header.channelMode;
    this._channels = header.channels;
    this._dataByteLength = header.dataByteLength;
    this._length = header.length;
    this._sampleRate = header.sampleRate;
    this._sampleLength = header.sampleLength;
  }

  get channels() {
    return this._channels;
  }

  get dataByteLength() {
    return this._dataByteLength;
  }

  get length() {
    return this._length;
  }

  get sampleRate() {
    return this._sampleRate;
  }

  get sampleLength() {
    return this._sampleLength;
  }
}
