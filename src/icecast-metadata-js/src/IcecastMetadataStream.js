/* Copyright 2020-2021 Ethan Halsall
    This file is part of icecast-metadata-js.

    icecast-metadata-js free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    icecast-metadata-js distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

import { Writable, PassThrough } from "stream";
import CodecParser from "codec-parser";

import IcecastMetadataReader from "./IcecastMetadataReader.js";

export default class IcecastMetadataStream extends Writable {
  /**
   * @description NodeJS streams wrapper for IcecastMetadataReader
   * @param {object} IcecastMetadataStream constructor parameter
   * @param {number} IcecastMetadataStream.mimeType Mimetype pulled from the `Content-Type` header of the Icecast stream (i.e. `audio/mpeg` or `application/ogg`)
   * @param {number} IcecastMetadataStream.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
   * @param {number} IcecastMetadataStream.icyBr Bitrate of audio stream used to increase accuracy when updating metadata
   * @param {number} IcecastMetadataStream.icyDetectionTimeout Duration in milliseconds to search for metadata if icyMetaInt isn't passed in
   * @param {number} IcecastMetadataStream.metadataTypes Types of metadata to capture: "icy" and/or "ogg"
   */
  constructor({ icyBr, mimeType, ...rest }) {
    super();
    this._mimeType = mimeType;
    this._icyBr = icyBr;

    if (this._mimeType) {
      this._codecParser = new CodecParser(mimeType, {
        enableFrameCRC32: false,
      });

      this._currentDuration = 0;

      this._handleStream = ({ stream }) => {
        const frames = [...this._codecParser.parseChunk(stream)];

        this._currentDuration = frames.length
          ? frames[frames.length - 1].totalDuration / 1000
          : this._currentDuration;

        this._stream.push(stream);
      };

      this._getDuration = () => this._currentDuration;
    } else {
      this._handleStream = ({ stream }) => {
        this._stream.push(stream);
      };

      if (this._icyBr) {
        this._getDuration = () => this._streamBytesRead / (this._icyBr * 125);
      } else {
        this._getDuration = () => 0;
      }
    }

    this._stream = new PassThrough();
    this._metadata = new PassThrough({ objectMode: true });

    this._generator = new IcecastMetadataReader({
      ...rest,
      onStream: (value) => this._handleStream(value),
      onMetadata: (value) => this._handleMetadata(value),
    });
  }

  /**
   * @returns Readable stream for stream data
   */
  get stream() {
    return this._stream;
  }

  /**
   * @returns Readable stream for metadata
   */
  get metadata() {
    return this._metadata;
  }

  _handleMetadata({ metadata, stats: { streamBytesRead } }) {
    this._streamBytesRead = streamBytesRead;

    this._metadata.push({
      metadata,
      time: this._getDuration(),
    });
  }

  _write(chunk, enc, next) {
    this._generator.readAll(chunk);
    next();
  }

  end() {
    this._stream.push(null);
    this._metadata.push(null);
    super.end();
  }
}
