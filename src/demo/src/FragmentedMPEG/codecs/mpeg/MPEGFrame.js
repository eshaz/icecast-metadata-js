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

import CodecFrame from "../CodecFrame";
import MPEGHeader from "./MPEGHeader";

const headerCache = new Map();

export default class MPEGFrame extends CodecFrame {
  constructor(data) {
    const key = String.fromCharCode(...data.subarray(0, 4));
    let header = headerCache.get(key);

    if (!header) {
      header = MPEGHeader.getHeader(data);
      if (header) headerCache.set(key, header);
    }

    super(
      header,
      header && data.subarray(0, header.dataByteLength),
      header && header.dataByteLength
    );
  }
}
