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

import CodecParser from "./codecs/CodecParser";
import FragmentedISOBMFFBuilder from "./isobmff/FragmentedISOBMFFBuilder";

/**
 * @description Generator that takes in MPEG 1/2 or AAC Data and yields Fragmented MP4 (ISOBMFF)
 */
export default class FragmentedMPEG {
  static MIN_FRAMES = 8;
  static MIN_FRAMES_LENGTH = 1022;

  constructor(mimeType) {
    this._codecParser = new CodecParser(mimeType);
    this._fragmentedISOBMFFBuilder = new FragmentedISOBMFFBuilder();
    this._frames = [];
    this._codecData = new Uint8Array(0);

    this._generator = this._generator();
    this._generator.next();
  }

  static getMimeType(mimeType) {
    switch (mimeType) {
      case /mpeg/.test(mimeType) && mimeType:
        return 'audio/mp4;codecs="mp3"';
      case /aac/.test(mimeType) && mimeType:
        return 'audio/mp4;codecs="mp4a.40.2"';
      case /ogg/.test(mimeType) && mimeType:
        return 'audio/mp4;codecs="flac"';
      default:
        return "audio/mp4";
    }
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
    // start parsing out frames
    while (!frames) {
      yield* this._sendReceiveData();
      frames = this._parseFrames();
    }

    // yield the movie box along with a movie fragment containing frames
    let fMP4 = FragmentedMPEG.appendBuffers(
      this._fragmentedISOBMFFBuilder.getMovieBox(frames[0].header),
      this._fragmentedISOBMFFBuilder.wrapFrames(frames)
    );

    // yield movie fragments containing frames
    while (true) {
      yield* this._sendReceiveData(fMP4);
      frames = this._parseFrames();
      fMP4 = frames ? this._fragmentedISOBMFFBuilder.wrapFrames(frames) : null;
    }
  }

  /**
   * @private
   * @param {Uint8Array} fMP4 Fragmented MP4 to send
   * @yields {Uint8Array} Fragmented MP4
   */
  *_sendReceiveData(fMP4) {
    let codecData = yield fMP4;

    while (!codecData) {
      codecData = yield;
    }

    this._codecData = FragmentedMPEG.appendBuffers(this._codecData, codecData);
  }

  /**
   * @private
   */
  _parseFrames() {
    let currentFrame = this._codecParser.readFrameStream(this._codecData);

    while (currentFrame.frame) {
      this._frames.push(currentFrame.frame);

      currentFrame = this._codecParser.readFrameStream(
        this._codecData,
        currentFrame.offset + currentFrame.frame.length
      );
    }
    this._codecData = this._codecData.subarray(currentFrame.offset);

    if (
      this._frames.length >= FragmentedMPEG.MIN_FRAMES &&
      this._frames.reduce((acc, frame) => acc + frame.data.length, 0) >=
        FragmentedMPEG.MIN_FRAMES_LENGTH
    ) {
      const frames = this._frames;
      this._frames = [];
      return frames;
    }
  }
}
