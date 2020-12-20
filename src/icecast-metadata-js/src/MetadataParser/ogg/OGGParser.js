/* Copyright 2020 Ethan Halsall
    
    This file is part of isobmff-audio.
    
    isobmff-audio is free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    isobmff-audio is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

import CodecParser from "../CodecParser";
import OGGPage from "./OGGPage";
import FlacFrame from "../flac/FlacFrame";

export default class OGGParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 283;
    this._codec = null;
  }

  get codec() {
    return this._codec || "flac,opus";
  }

  setCodec(oggPage) {
    // FLAC
    if (
      oggPage.data[0] === 0x7f &&
      oggPage.data[1] === 0x46 &&
      oggPage.data[2] === 0x4c &&
      oggPage.data[3] === 0x41 &&
      oggPage.data[4] === 0x43
    ) {
      this._codec = "flac";
      this._frameClass = FlacFrame;
      this._maxHeaderLength = 309;
    }
  }

  parseFrames(data) {
    const oggPages = this.fixedLengthFrame(OGGPage, data);

    if (!this._codec && oggPages.frames.length)
      this.setCodec(oggPages.frames[0]);

    const frames = oggPages.frames.flatMap(
      ({ data }) =>
        this.variableLengthFrame(this._frameClass, data, true).frames
    );

    return { frames, remainingData: oggPages.remainingData };
  }
}
