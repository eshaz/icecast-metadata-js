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

import MPEG12Header from "./version12/MPEG12Header";
import MPEG4Header from "./version4/MPEG4Header";
import Frame from "./Frame";

export default class MPEGParser {
  constructor(mpegVersion) {
    this._getHeader =
      mpegVersion === "audio/aac"
        ? this._getMPEG4Header
        : this._getMPEG12Header;
    this._headerLength =
      mpegVersion === "audio/aac"
        ? MPEG4Header.headerByteLength
        : MPEG12Header.headerByteLength;
    this._headerCache = new Map();
  }

  /**
   * @private
   * @description Caches valid MPEG 1/2 so they are parsed only happens once
   * @param {data} buffer Header data
   */
  _getMPEG4Header(buffer) {
    const header = MPEG4Header.getHeader(buffer);
    console.log(header);
    return header;
  }

  /**
   * @private
   * @description Caches valid MPEG 1/2 so they are parsed only happens once
   * @param {data} buffer Header data
   */
  _getMPEG12Header(buffer) {
    const key = String.fromCharCode(
      ...buffer.subarray(0, MPEG12Header.headerByteLength)
    );

    if (this._headerCache.has(key)) {
      return this._headerCache.get(key);
    } else {
      const header = MPEG12Header.getHeader(buffer);
      if (header) {
        this._headerCache.set(key, header);
        return header;
      }
    }
  }

  /**
   * @description Finds and returns an MPEG frame in the context of a stream. Frame will be undefined if no valid frame was found at the offset.
   * @param {Uint8Array} data MPEG data that should contain an MPEG header, audio data, and then next MPEG header
   * @param {number} offset Offset where frame should be
   * @returns {object} Object containing the actual offset and frame.
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
      const nextHeaderOffset = offset + header.frameByteLength;
      if (nextHeaderOffset + this._headerLength <= data.length) {
        return this._getHeader(data.subarray(nextHeaderOffset))
          ? {
              offset,
              frame: new Frame(header, data.subarray(offset, nextHeaderOffset)),
            }
          : { offset: nextHeaderOffset + this._headerLength };
      }
    }

    // there is a header, but there is not enough data to determine the next header
    return {
      offset,
    };
  }
}
