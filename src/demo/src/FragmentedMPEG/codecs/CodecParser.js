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

import OGGPage from "./ogg/OGGPage";
import FlacHeader from "./flac/FlacHeader";

export default class CodecParser {
  constructor(mimeType) {
    if (mimeType.match(/aac/)) {
      this.parseFrames = this._getAACFrame;
      this._maxHeaderLength = 9;
    } else if (mimeType.match(/mpeg/)) {
      this.parseFrames = this._getMPEGFrame;
      this._maxHeaderLength = 4;
    } else {
      this.parseFrames = this._getFLACFrame;
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
    const oggPages = this.fixedLengthFrame(OGGPage, buffer);

    const flacFrames = oggPages.frames.flatMap(
      (frame) => this.variableLengthFrame(FlacFrame, frame.data, 0, true).frames
    );

    return { frames: flacFrames, remainingData: oggPages.remainingData };
  }

  /**
   * @private
   * @description Parses an AAC header from the passed in buffer.
   * @param {data} buffer Header data
   * @returns {AACHeader} Instance of AACHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getAACFrame(buffer) {
    return this.fixedLengthFrame(AACFrame, buffer);
  }

  /**
   * @private
   * @description Parses and caches valid MPEG 1/2 headers so they are parsed only happens once.
   * @param {data} buffer Header data
   * @returns {MPEGHeader} Instance of MPEGHeader
   * @returns {null} If buffer does not contain a valid header
   */
  _getMPEGFrame(buffer) {
    return this.fixedLengthFrame(MPEGFrame, buffer);
  }

  syncFrame(CodecFrame, data, remainingData = 0) {
    let frame = new CodecFrame(data.subarray(remainingData));

    while (
      !frame.header &&
      remainingData + this._maxHeaderLength < data.length
    ) {
      remainingData += frame.length || 1;
      frame = new CodecFrame(data.subarray(remainingData));
    }

    return { frame, remainingData };
  }

  /**
   * @description Searches for CodecFrames within bytes containing a sequence of known codec frames.
   * @param {Uint8Array} data Codec data that should contain a sequence of known length frames.
   * @returns {object} Object containing the actual offset and frame. Frame is undefined if no valid header was found
   */
  fixedLengthFrame(CodecFrame, data) {
    // initial sync
    let { frame, remainingData } = this.syncFrame(CodecFrame, data);
    let frames = [];

    // find a header in the data
    while (
      frame.header &&
      frame.length + remainingData + this._maxHeaderLength < data.length
    ) {
      // check if there is a valid frame immediately after this frame
      const nextFrame = new CodecFrame(
        data.subarray(frame.length + remainingData)
      );

      if (nextFrame.header) {
        // there is a next frame, so the current frame is valid
        frames.push(frame);
        remainingData += frame.length;
        frame = nextFrame;
      } else {
        // frame is invalid and must re-sync
        remainingData++;
        const syncResult = this.syncFrame(CodecFrame, data, remainingData);
        remainingData += syncResult.remainingData;
        frame = syncResult.frame;
      }
    }

    return {
      frames,
      remainingData,
    };
  }

  variableLengthFrame(CodecFrame, data, remainingData = 0, isComplete) {
    let frameLocations = [];
    let frames = [];
    let frameNumber;

    for (let readPosition = 0; readPosition <= data.length; readPosition++) {
      const flacHeader = FlacHeader.getHeader(data.subarray(readPosition));

      if (flacHeader) {
        if (!frameNumber) frameNumber = flacHeader.frameNumber - 1;

        if (flacHeader.frameNumber === frameNumber + 1) {
          frameLocations.push(readPosition);

          frameNumber = flacHeader.frameNumber;
          readPosition += flacHeader.length;
        }
      }
    }

    // if there is a complete set of frames, assume the last frame is valid
    const lengthOffset = isComplete ? 0 : 1;

    for (let i = 0; i < frameLocations.length - lengthOffset; i++) {
      frames.push(
        new CodecFrame(data.subarray(frameLocations[i], frameLocations[i + 1]))
      );

      remainingData = frameLocations[i];
    }

    return {
      frames,
      remainingData,
    };
  }
}
