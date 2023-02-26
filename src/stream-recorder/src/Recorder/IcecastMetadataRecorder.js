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

import fs from "fs";
import path from "path";

import { AbortController } from "abort-controller";
import { IcecastMetadataStream } from "icecast-metadata-js";

import CueWriter from "./CueWriter.js";

/**
 * @description Records an Icecast Stream with Metadata into an audio file and a cue file
 * @description Icecast server must return a Content-Type header
 * @param {Object} IcecastMetadataRecorder constructor parameter
 * @param {string} IcecastMetadataRecorder.output Filename to store audio and cue files
 * @param {string} IcecastMetadataRecorder.name Title of cue file
 * @param {string} IcecastMetadataRecorder.endpoint Web address for Icecast stream
 * @param {boolean} IcecastMetadataRecorder.prependDate Prepend an ISO date to each cue entry
 * @param {number} [IcecastMetadataRecorder.cueRollover=undefined] Number of metadata updates before creating a new cue file. Use for compatibility with applications such as foobar2000.
 */
export default class IcecastMetadataRecorder {
  constructor({
    output,
    name,
    endpoint,
    prependDate,
    dateEntries,
    cueRollover,
    metadataInterval,
    contentType,
    fetch,
  }) {
    this._fileName = output;
    this._endpoint = endpoint;
    this._metadataInterval = metadataInterval;
    this._contentType = contentType;
    this._fetch = fetch;

    this._cueWriterParams = {
      name,
      prependDate,
      dateEntries,
      cueRollover,
      fileName: this._fileName,
    };

    this._audioFilePromise = Promise.resolve();
  }

  set errorHandler(e) {
    this._errorHandler = e;
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

  _getIcecast(headers) {
    const icecastParams = {
      icyMetaInt:
        this._metadataInterval || parseInt(this._icyHeaders["metaint"]),
      mimeType: this._contentType || headers.get("content-type"),
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

    if (!icecastParams.mimeType) {
      console.warn(
        `Icecast server: ${this._endpoint} did not respond with a valid Content-Type header`
      );
      console.error("Please manually specify a mimetype to record this stream");
      console.error("Received 'ICY-' headers", this._icyHeaders);
      throw new Error("Invalid Icecast Mimetype");
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
  }

  get fileNames() {
    return [...this._fileNames, ...(this._cueWriter?.fileNames || [])];
  }

  /**
   * @description Fetches and starts recording the icecast stream
   */
  async record() {
    this._init();

    this._recordPromise = this._fetch(this._endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
        "User-Agent":
          "Icecast Metadata Recorder - https://github.com/eshaz/icecast-metadata-js",
      },
      signal: this._controller.signal,
    })
      .then((res) => {
        this._audioFileWritable = this._openFile(this._fileName);

        this._getIcyHeaders(res.headers);
        this._getIcecast(res.headers);
        this._getCueWriter();
        /**
         * TEST: Pipe to a raw response to file for testing
         *
         * res.body.pipe(this._raw);
         */
        this._icecast.stream.pipe(this._audioFileWritable);
        this._icecast.metadata.pipe(this._cueWriter);

        res.body.pipe(this._icecast);

        return this._audioFilePromise.then(
          () => this._cueWriter?.cueFilePromise
        );
      })
      .catch((e) => {
        this._closeFile(this._icecast);
        if (e.name !== "AbortError") {
          this._errorHandler(e);
        }
      });

    return this._recordPromise;
  }

  /**
   * @description Stops recording the Icecast stream
   */
  stop() {
    this._controller.abort();
    this._closeFile(this._icecast);

    return this._recordPromise;
  }

  _openFile(fileName) {
    try {
      fs.mkdirSync(path.dirname(fileName), { recursive: true });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }

    const file = fs.createWriteStream(fileName);

    this._audioFilePromise = new Promise(
      (resolve) => (this._audioResolve = resolve)
    );
    file.on("ready", () => {
      this._fileNames.push(fileName);
    });
    file.on("close", () => {
      this._audioResolve();
    });

    return file;
  }

  _closeFile(file) {
    file && file.end();
  }
}
