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

import MPEGHeader from "./mpeg/MPEGHeader";
import MPEGFrame from "./mpeg/MPEGFrame";

import AACHeader from "./aac/AACHeader";
import AACFrame from "./aac/AACFrame";

export default class CodecParser {
  constructor(mimeType) {
    if (mimeType === "audio/aac") {
      this._frameClass = AACFrame;
      this._getHeader = this._getAACHeader;
      this._headerLength = 9;
    } else {
      this._frameClass = MPEGFrame;
      this._getHeader = this._getMPEGHeader;
      this._headerLength = 4;
      this._headerCache = new Map();
    }
  }

  /**
   * @private
   * @description Parses an AAC header from the passed in buffer.
   * @param {data} buffer Header data
   * @returns {AACHeader} Instance of AACHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getAACHeader(buffer) {
    const header = AACHeader.getHeader(buffer);
    return header;
  }

  /**
   * @private
   * @description Parses and caches valid MPEG 1/2 headers so they are parsed only happens once.
   * @param {data} buffer Header data
   * @returns {MPEGHeader} Instance of MPEGHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getMPEGHeader(buffer) {
    const key = String.fromCharCode(...buffer.subarray(0, 4));

    if (this._headerCache.has(key)) {
      return this._headerCache.get(key);
    } else {
      const header = MPEGHeader.getHeader(buffer);
      if (header) {
        this._headerCache.set(key, header);
        return header;
      }
    }
  }

  /**
   * @description Finds and returns a codec frame in the context of a stream. Frame will be undefined if no valid frame was found at the offset.
   * @param {Uint8Array} data Codec data that should contain a header, audio data, and then next header
   * @param {number} offset Offset where frame should be
   * @returns {object} Object containing the actual offset and frame. Frame is undefined if no valid header was found
   */
  readFrameStream(data, offset = 0) {
    // try to get the header at the given offset
    let header = this._getHeader(data.subarray(offset));

    // find a header in the data
    while (!header && offset + this._headerLength < data.length) {
      offset++;
      header = this._getHeader(data.subarray(offset));
    }

    if (header) {
      // check if there is a valid header immediately after this frame
      const nextHeaderOffset = offset + header.dataByteLength;
      if (nextHeaderOffset + header.headerByteLength <= data.length) {
        return this._getHeader(data.subarray(nextHeaderOffset))
          ? {
              offset,
              frame: new this._frameClass(
                header,
                data.subarray(offset, nextHeaderOffset)
              ),
            }
          : { offset: nextHeaderOffset + header.headerByteLength };
      }
    }

    // there is a header, but there is not enough data to determine the next header
    return {
      offset,
    };
  }
}
