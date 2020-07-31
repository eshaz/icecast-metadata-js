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

const { Readable } = require("stream");

class CueBuilder extends Readable {
  /**
   * @description Generates a CD cue file based on the SCSI-3 Multimedia Commands specification
   * @param {Object} CueFileGenerator constructor parameter
   * @param {number} CueFileGenerator.title Title of the cue file
   * @param {number} CueFileGenerator.fileName Filename of the audio file referenced by this cue file
   * @param {Array<string>} [CueFileGenerator.comments] Comments to be added to the top of the file
   */
  constructor({ title, fileName, comments = [] }) {
    super();
    this._trackCount = 0;
    this._startCueFile(title, fileName, comments);
  }

  /**
   * @description Returns total number of tracks in the cue file
   */
  get trackCount() {
    return this._trackCount;
  }

  /**
   * @description Adds a new track to the cue file
   * @param {number} time Time in seconds when the track should start
   * @param {string} title Title of the track
   */
  addTrack(time, title) {
    this._append(`
  TRACK ${(this._trackCount += 1)} AUDIO
    TITLE "${title}"
    INDEX 01 ${this._getMinutesSecondsFrames(time)}`);
  }

  _startCueFile(title, fileName, comments) {
    const remBlock = comments.reduce(
      (acc, comment) => acc + "REM " + comment + "\n",
      ""
    );
    this._append(
      remBlock + 'TITLE "' + title + '"\nFILE "' + fileName + '" WAVE'
    );
  }

  _read() {} // required to extend the Readable class, but we only need to use the built in read method

  _append(string) {
    this.push(string, "ascii");
  }

  /**
   * @description Calculates the Minutes:Seconds:Frames time to be entered into a new entry's index.
   * @param {number} seconds Time in seconds
   */
  _getMinutesSecondsFrames(seconds) {
    const second = Math.floor(seconds) % 60;
    const minute = Math.floor(seconds / 60);
    const frame = Math.round(74 * (seconds % 1));

    return [minute, second, frame]
      .map((value) => value.toString().padStart(2, 0))
      .join(":");
  }
}

module.exports = CueBuilder;
