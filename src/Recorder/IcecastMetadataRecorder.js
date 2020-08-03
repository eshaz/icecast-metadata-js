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

const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch").default;
const { AbortController } = require("abort-controller");

const IcecastMetadataTransformStream = require("../Parser/IcecastMetadataTransformStream");
const CueBuilder = require("./CueBuilder");

/**
 * @description Records an Icecast Stream with Metadata into an audio file and a cue file
 * @description Icecast server must return a constant bitrate in the icyBr header
 * @param {Object} IcecastMetadataRecorder constructor parameter
 * @param {string} IcecastMetadataRecorder.output Filename to store audio and cue files
 * @param {string} IcecastMetadataRecorder.name Title of cue file
 * @param {string} IcecastMetadataRecorder.endpoint Web address for Icecast stream
 * @param {boolean} IcecastMetadataRecorder.prependDate Prepend an ISO date to each cue entry
 * @param {number} [IcecastMetadataRecorder.cueRollover=undefined] Number of metadata updates before creating a new cue file. Use for compatibility with applications such as foobar2000.
 */
class IcecastMetadataRecorder {
  constructor(
    { output, name, endpoint, prependDate, dateEntries, cueRollover },
    done
  ) {
    const FORMAT_MATCHER = /(?:\.([^.]+))?$/;

    this._audioFileName = output;
    this._audioFileNameNoExt = output.replace(FORMAT_MATCHER, "");
    this._format = output.match(FORMAT_MATCHER)[1];
    this._dateEntries = dateEntries;
    this._prependDate = prependDate;
    this._name = name;
    this._endpoint = endpoint;
    this._cueRollover = cueRollover;
    this._done = done;
  }

  _init() {
    /**
     * TEST: Replace the date with a mock and create raw response WriteStream
     *
     * this._startDate = new Date(1596057371222);
     * this._raw = fs.createWriteStream(`${this._audioFileName}.raw`);
     */
    this._startDate = new Date(Date.now());
    this._controller = new AbortController();
    this._icyHeaders = {};
    this._fileNames = [];
    this._cueRolloverCount = 0;
    this._audioFileWritable = null;
    this._cueBuilder = null;
    this._cueFileWritable = null;
  }

  /**
   * @description Fetches and starts recording the icecast stream
   */
  record() {
    this._init();
    this._audioFileWritable = this._openFile(this._audioFileName);
    this._audioFileWritable.addListener("finish", () => {
      this._done && this._done();
    });

    fetch(this._endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
        "User-Agent":
          "Icecast Metadata Recorder - https://github.com/eshaz/icecast-metadata-js",
      },
      signal: this._controller.signal,
    })
      .then((res) => {
        this._getIcyHeaders(res.headers);
        this._getIcecast();
        this._getCueBuilder();
        /**
         * TEST: Pipe to a raw response to file for testing
         *
         * res.body.pipe(this._raw);
         */
        res.body.pipe(this._icecast).pipe(this._audioFileWritable);
      })
      .catch((e) => {
        this._closeFile(this._icecast);
        this._closeFile(this._cueBuilder);
        if (e.name !== "AbortError") {
          throw e;
        }
      });
  }

  /**
   * @description Stops recording the Icecast stream
   */
  stop() {
    this._controller.abort();
  }

  _openFile(fileName) {
    try {
      fs.mkdirSync(path.dirname(fileName), { recursive: true });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }

    this._fileNames.push(fileName);
    return fs.createWriteStream(fileName);
  }

  _closeFile(file) {
    file && file.push(null);
  }

  _getIcyHeaders(headers) {
    headers.forEach((value, name) => {
      if (name.match(/^icy*/))
        this._icyHeaders[name.replace(/^icy-/, "")] = value;
    });
  }

  _getIcecast() {
    this._icecast = new IcecastMetadataTransformStream({
      icyMetaInt: parseInt(this._icyHeaders["metaint"]),
      icyBr: parseInt(this._icyHeaders["br"]),
      onMetadata: (meta) => this._recordMetadata(meta),
    });
  }

  _getCueBuilder() {
    // add a rollover number to the file name
    const cueFileName = this._cueRolloverCount
      ? `${this._audioFileNameNoExt}.${this._cueRolloverCount}.cue`
      : `${this._audioFileNameNoExt}.cue`;

    this._cueFileWritable = this._openFile(cueFileName);

    const { name, ...icyHeaders } = this._icyHeaders;

    this._cueBuilder = new CueBuilder({
      comment:
        "Generated by IcecastMetadataRecorder https://github.com/eshaz/icecast-metadata-js",
      title: this._name || name, // override the header name if passed in
      ...(this._name ? this._icyHeaders : { ...icyHeaders }), // do not duplicate the header name if used in the title
      file: path.basename(this._audioFileName),
      date: this._startDate.toISOString(),
    });

    this._cueBuilder.pipe(this._cueFileWritable);
  }

  _recordMetadata(meta) {
    const trackCount = this._cueBuilder.trackCount;

    /**
     * When there is only one more cue entry remaining
     * until the next rollover, insert an END track.
     * There is no way to indicate the end of a cue file
     * so this will have to do.
     *
     * Reasonable rollover thresholds should be based on your player's limitations.
     * (i.e. Foobar2000 accepts up to 999 tracks in the cue file)
     */
    if (trackCount + 1 === this._cueRollover) {
      this._cueBuilder.addTrack({ title: "END" }, meta.time);
      this._cueRolloverCount++;
      this._closeFile(this._cueBuilder);
      this._getCueBuilder();
    }

    const timeStamp = new Date(
      this._startDate.getTime() + meta.time * 1000
    ).toISOString();

    const { StreamTitle, ...restOfMetadata } = meta.metadata;

    this._cueBuilder.addTrack(
      {
        title: this._prependDate ? `${timeStamp} ${StreamTitle}` : StreamTitle,
        ...(this._dateEntries
          ? { date: `${timeStamp.substring(0, 16)}Z` }
          : {}),
        ...restOfMetadata,
      },
      (trackCount || this._cueRolloverCount) && meta.time // force metadata for first track to show immediately
    );
  }
}

module.exports = { IcecastMetadataRecorder };
