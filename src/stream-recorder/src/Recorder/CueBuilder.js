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

/*
  Based on documentation from:
  * http://www.13thmonkey.org/documentation/SCSI/x3_304_1997.pdf
  * https://wiki.hydrogenaud.io/index.php?title=Cue_sheet
*/

// File Types
const WAVE = "WAVE";
const MP3 = "MP3";
const AIFF = "AIFF";
const BINARY = "BINARY";
const MOTOROLA = "MOTOROLA";
const DEFAULT_FILETYPE = WAVE;

// Entries
const CATALOG = "CATALOG";
const PERFORMER = "PERFORMER";
const SONGWRITER = "SONGWRITER";
const TITLE = "TITLE";
const FILE = "FILE";
const ISRC = "ISRC";
const POSTGAP = "POSTGAP";
const PREGAP = "PREGAP";

const supportedFileTypes = [WAVE, MP3, AIFF, BINARY, MOTOROLA];
const supportedDiscEntries = [CATALOG, PERFORMER, SONGWRITER, TITLE, FILE];
const supportedTrackEntries = [
  ISRC,
  SONGWRITER,
  PERFORMER,
  TITLE,
  //POSTGAP,
  //PREGAP,
  FILE,
];

export default class CueBuilder {
  /**
   * @description Generates a CD cue file based on the SCSI-3 Multimedia Commands specification
   * @param {Object} entries Key-Value pairs to add as entries to the top of the cue file
   * @param {Array<string>} [comments] Comments to be added to the top of the file
   * @param {string} [fileType=WAVE] Audio file type for the cue file.
   */
  constructor() {
    this._trackCount = 0;
  }

  /**
   * @description Returns total number of tracks in the cue file
   */
  get trackCount() {
    return this._trackCount;
  }

  /**
   * @description Adds a new track to the cue file
   * @param {Object} entries Key-Value pairs to add as entries to track
   * @param {Array<string>} [comments] Comments to be added to the track
   * @param {string} [fileType=WAVE] Audio file type for the track file. Only used when the `file` parameter is present in `entries`
   */
  addTrack(entries, time, comments, fileType) {
    const trackEntries = [];

    // only add a file entry if one is passed in
    const fileEntry = CueBuilder._getFileEntry(entries, fileType);

    //
    fileEntry && trackEntries.push(fileEntry);
    trackEntries.push(
      `  TRACK ${(this._trackCount += 1)} AUDIO`,
      `    ${CueBuilder._getEntries(
        entries,
        comments,
        supportedTrackEntries
      ).join("\n    ")}`,
      `    INDEX 01 ${CueBuilder._getMinutesSecondsFrames(time)}`
    );

    return "\n" + trackEntries.join("\n");
  }

  static getHeader(entries, comments = [], fileType = "WAVE") {
    const beginningCue = [
      ...CueBuilder._getEntries(entries, comments, supportedDiscEntries),
    ];
    const fileEntry = CueBuilder._getFileEntry(entries, fileType);
    fileEntry && beginningCue.push(fileEntry);

    return beginningCue.join("\n");
  }

  // prettier-ignore
  static _formatEntry(name, value, suffix) {
    return `${name} "${value}"${suffix ? " " + suffix : ""}`;
  }

  static _formatComment(comment) {
    return `REM ${comment}`;
  }

  static _getFileEntry(entries, filetype = DEFAULT_FILETYPE) {
    const fileEntry = Object.entries(entries)
      .filter(([key]) => key.toUpperCase() === FILE)
      .map(([key, value]) => value)[0];

    if (fileEntry) {
      return CueBuilder._formatEntry(
        FILE,
        fileEntry,
        supportedFileTypes.includes(filetype.toUpperCase())
          ? filetype.toUpperCase()
          : DEFAULT_FILETYPE
      );
    }
  }

  static _getEntries(entries, comments = [], supportedEntries) {
    const entriesBlock = [];

    Object.entries(entries).forEach(([key, value]) => {
      const name = key.toUpperCase();
      if (name !== FILE) {
        supportedEntries.includes(name)
          ? entriesBlock.push(CueBuilder._formatEntry(name, value))
          : comments.push(CueBuilder._formatEntry(name, value)); // add to the comments block if an entry is not a supported at the disc level
      }
    });

    const commentsBlock = comments.map(CueBuilder._formatComment);

    return [...commentsBlock, ...entriesBlock];
  }

  /**
   * @description Calculates the Minutes:Seconds:Frames time to be entered into a new entry's index.
   * @param {number} seconds Time in seconds
   */
  static _getMinutesSecondsFrames(seconds) {
    const totalFrames = Math.round(seconds * 75);

    const frame = totalFrames % 75;
    const second = Math.floor(totalFrames / 75) % 60;
    const minute = Math.floor(totalFrames / 4500);

    return [minute, second, frame]
      .map((value) => value.toString().padStart(2, 0))
      .join(":");
  }
}
