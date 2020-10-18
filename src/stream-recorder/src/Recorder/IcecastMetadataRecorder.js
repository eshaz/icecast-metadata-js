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

const IcecastMetadataStream = require("../../../icecast-metadata-js/src/IcecastMetadataStream");
const CueWriter = require("./CueWriter");

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
  constructor({
    output,
    name,
    endpoint,
    prependDate,
    dateEntries,
    cueRollover,
  }) {
    this._fileName = output;
    this._endpoint = endpoint;

    this._cueWriterParams = {
      name,
      prependDate,
      dateEntries,
      cueRollover,
      fileName: this._fileName,
    };
  }

  get endpoint() {
    return this._endpoint;
  }

  _getIcyHeaders(headers) {
    headers.forEach((value, name) => {
      if (name.match(/^icy*/))
        this._icyHeaders[name.replace(/^icy-/, "")] = value;
    });
  }

  _getIcecast() {
    const icecastParams = {
      icyMetaInt: parseInt(this._icyHeaders["metaint"]),
      icyBr: parseInt(this._icyHeaders["br"]),
    };

    if (!icecastParams.icyMetaInt) {
      console.error(
        `Icecast server: ${this._endpoint} did not respond with a valid Icy-MetaInt header`
      );
      console.error(
        "Please manually specify a metadata interval to record this stream"
      );
      console.error("Received 'ICY-' headers", this._icyHeaders);
      throw new Error("Invalid Icecast Metadata Interval");
    }

    if (!icecastParams.icyBr) {
      console.warn(
        `Icecast server: ${this._endpoint} did not respond with a valid Icy-Br header`
      );
      console.error("Please manually specify a bitrate to record this stream");
      console.error("Received 'ICY-' headers", this._icyHeaders);
      throw new Error("Invalid Icecast Bitrate");
    }

    this._icecast = new IcecastMetadataStream(icecastParams);
  }

  _getCueWriter() {
    this._cueWriter = new CueWriter({
      startDate: this._startDate,
      icyHeaders: this._icyHeaders,
      ...this._cueWriterParams,
    });
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

    this._audioFileWritable = null;

    this._stopResolve;
    this._stopPromise = new Promise((resolve) => (this._stopResolve = resolve));

    this._stopResolve;
    this._recordPromise = new Promise(
      (resolve) => (this._recordResolve = resolve)
    );
  }

  get fileNames() {
    return [...this._fileNames, ...(this._cueWriter?.fileNames || [])];
  }

  /**
   * @description Fetches and starts recording the icecast stream
   */
  async record() {
    this._init();
    this._audioFileWritable = this._openFile(this._fileName);
    this._audioFileWritable.addListener("finish", () => {
      this._recordResolve();
      this._stopResolve();
    });

    return fetch(this._endpoint, {
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
        this._getCueWriter();
        /**
         * TEST: Pipe to a raw response to file for testing
         *
         * res.body.pipe(this._raw);
         */
        this._icecast.stream.pipe(this._audioFileWritable);
        this._icecast.metadata.pipe(this._cueWriter);

        res.body.pipe(this._icecast);

        return this._recordPromise;
      })
      .catch((e) => {
        this._closeFile(this._icecast);
        if (e.name !== "AbortError") {
          throw e;
        }
      });
  }

  /**
   * @description Stops recording the Icecast stream
   */
  async stop() {
    this._controller.abort();
    this._closeFile(this._icecast);

    return this._stopPromise;
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
    file && file.end();
  }
}

module.exports = IcecastMetadataRecorder;
