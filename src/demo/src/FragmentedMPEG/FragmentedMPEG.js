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

import MPEGParser from "./mpeg/MPEGParser";
import FragmentedISOBMFFBuilder from "./isobmff/FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  static MIN_FRAMES = 2;
  static MIN_FRAMES_LENGTH = 1022;

  constructor() {
    this._mpegParser = new MPEGParser();
    this._frames = [];
    this._mpegData = new Uint8Array(0);

    this._generator = this._generator();
    this._generator.next();
  }

  static appendBuffers(buf1, buf2) {
    const buf = new Uint8Array(buf1.length + buf2.length);
    buf.set(buf1);
    buf.set(buf2, buf1.length);

    return buf;
  }

  next(data) {
    return this._generator.next(data);
  }

  *_generator() {
    let frames;
    // start parsing out frames
    while (!frames) {
      frames = yield* this._processFrames();
    }
    // yield the movie box along with a movie fragment containing frames
    frames = FragmentedMPEG.appendBuffers(
      FragmentedISOBMFFBuilder.getMp3MovieBox(),
      frames
    );
    // yield movie fragments containing frames
    while (true) {
      frames = yield* this._processFrames(frames);
    }
  }

  *_processFrames(data) {
    yield* this._sendReceiveData(data);
    this._parseFrames();
    return this._getMovieFragment();
  }

  *_sendReceiveData(frames) {
    let mpegData = yield frames;

    while (!mpegData) {
      mpegData = yield;
    }

    this._mpegData = FragmentedMPEG.appendBuffers(this._mpegData, mpegData);
  }

  _parseFrames() {
    let currentFrame = this._mpegParser.readFrameStream(this._mpegData);

    while (currentFrame.frame) {
      this._frames.push(currentFrame.frame.data);

      currentFrame = this._mpegParser.readFrameStream(
        this._mpegData,
        currentFrame.offset + currentFrame.frame.header.frameByteLength
      );
    }

    this._mpegData = this._mpegData.subarray(currentFrame.offset);
  }

  _getMovieFragment() {
    if (
      this._frames.length >= FragmentedMPEG.MIN_FRAMES &&
      this._frames.reduce((acc, frame) => acc + frame.length, 0) >=
        FragmentedMPEG.MIN_FRAMES_LENGTH
    ) {
      const movieFragment = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );

      this._frames = [];
      return movieFragment;
    }
  }
}
