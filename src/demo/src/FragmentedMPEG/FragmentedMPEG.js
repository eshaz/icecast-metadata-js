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

/**
 * @description Generator that takes in MP3 (MPEG) Data and yields Fragmented MP4 (ISOBMFF)
 */
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

  /**
   * @private
   * @description Appends two buffers
   * @param {Uint8Array} buf1
   * @param {Uint8Array} buf2
   */
  static appendBuffers(buf1, buf2) {
    const buf = new Uint8Array(buf1.length + buf2.length);
    buf.set(buf1);
    buf.set(buf2, buf1.length);

    return buf;
  }

  /**
   * @description Returns an iterator for the passed in MPEG data.
   * @param {Uint8Array} chunk Next chunk of MPEG data to read
   * @returns {IterableIterator} Iterator that operates over a raw icecast response.
   * @yields {Uint8Array} Movie Fragments containing MPEG frames
   */
  *iterator(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      yield i.value;
    }
  }

  /**
   * @private
   * @description Internal generator.
   * @yields {Uint8Array} Movie Fragments containing MPEG frames
   */
  *_generator() {
    let frames;
    // start parsing out frames, save the first header
    while (!frames) {
      yield* this._sendReceiveData();
      const parsedFrames = this._parseFrames();
      this._firstHeader = parsedFrames.length && parsedFrames[0].header;
      frames = this._getMovieFragment();
    }

    // yield the movie box along with a movie fragment containing frames
    frames = FragmentedMPEG.appendBuffers(
      FragmentedISOBMFFBuilder.getMp3MovieBox(this._firstHeader),
      frames
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(frames);
      this._parseFrames();
      frames = this._getMovieFragment();
    }
  }

  /**
   * @private
   * @param {Uint8Array} frames
   */
  *_sendReceiveData(frames) {
    let mpegData = yield frames;

    while (!mpegData) {
      mpegData = yield;
    }

    this._mpegData = FragmentedMPEG.appendBuffers(this._mpegData, mpegData);
  }

  /**
   * @private
   */
  _parseFrames() {
    let currentFrame = this._mpegParser.readFrameStream(this._mpegData);

    while (currentFrame.frame) {
      this._frames.push(currentFrame.frame);

      currentFrame = this._mpegParser.readFrameStream(
        this._mpegData,
        currentFrame.offset + currentFrame.frame.header.frameByteLength
      );
    }
    this._mpegData = this._mpegData.subarray(currentFrame.offset);

    return this._frames;
  }

  /**
   * @private
   */
  _getMovieFragment() {
    if (
      this._frames.length >= FragmentedMPEG.MIN_FRAMES &&
      this._frames.reduce((acc, frame) => acc + frame.data.length, 0) >=
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
