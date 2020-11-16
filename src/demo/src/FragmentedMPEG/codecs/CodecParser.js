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

import MPEGFrame from "./mpeg/MPEGFrame";
import AACFrame from "./aac/AACFrame";
import FlacFrame from "./flac/FlacFrame";

import OGGPageHeader from "./ogg/OGGPageHeader";

export default class CodecParser {
  constructor(mimeType) {
    if (mimeType.match(/aac/)) {
      this._getFrame = this._getAACFrame;
      this._maxHeaderLength = 9;
    } else if (mimeType.match(/mpeg/)) {
      this._getFrame = this._getMPEGFrame;
      this._maxHeaderLength = 4;
    } else {
      this._getFrame = this._getFLACFrame;
      this._oggPosition = new WeakMap();
      this._maxHeaderLength = 309; // flac 26, ogg 283
    }
  }

  /**
   * @private
   * @description Parses an AAC header from the passed in buffer.
   * @param {data} buffer Header data
   * @returns {AACHeader} Instance of AACHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getFLACFrame(buffer) {
    const oggPage = OGGPageHeader.getHeader(buffer);

    if (oggPage) {
      const flacFrame = new FlacFrame(buffer, oggPage);

      this._oggPosition.set(flacFrame, oggPage.absoluteGranulePosition);
      const prevPosition = this._oggPosition.get(this.frame);

      if (prevPosition && oggPage.absoluteGranulePosition > prevPosition) {
        this.frame.header.sampleLength = Number(
          oggPage.absoluteGranulePosition - prevPosition
        );
      }

      return flacFrame;
    }

    return {
      length: 0,
      data: [],
    };
  }

  /**
   * @private
   * @description Parses an AAC header from the passed in buffer.
   * @param {data} buffer Header data
   * @returns {AACHeader} Instance of AACHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getAACFrame(buffer) {
    return new AACFrame(buffer);
  }

  /**
   * @private
   * @description Parses and caches valid MPEG 1/2 headers so they are parsed only happens once.
   * @param {data} buffer Header data
   * @returns {MPEGHeader} Instance of MPEGHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getMPEGFrame(buffer) {
    return new MPEGFrame(buffer);
  }

  /**
   * @description Finds and returns a codec frame in the context of a stream. Frame will be undefined if no valid frame was found at the offset.
   * @param {Uint8Array} data Codec data that should contain a header, audio data, and then next header
   * @param {number} offset Offset where frame should be
   * @returns {object} Object containing the actual offset and frame. Frame is undefined if no valid header was found
   */
  readFrameStream(data, offset = 0) {
    // try to get the header at the given offset
    this.frame = this._getFrame(data.subarray(offset));

    // find a header in the data
    while (!this.frame.header && offset + this._maxHeaderLength < data.length) {
      offset += this.frame.length || 1;
      this.frame = this._getFrame(data.subarray(offset));
    }

    if (this.frame.header) {
      // check if there is a valid frame immediately after this frame
      const nextFrame = offset + this.frame.length;
      if (nextFrame + this._maxHeaderLength <= data.length) {
        return this._getFrame(data.subarray(nextFrame)).header
          ? {
              offset,
              frame: this.frame,
            }
          : { offset: nextFrame + this.frame.header.length }; // current header is invalid since there is no next header
      }
    }

    // there is a header, but there is not enough data to determine the next header
    return {
      offset,
    };
  }
}
