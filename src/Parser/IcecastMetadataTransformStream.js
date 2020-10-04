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

const { read } = require("./IcecastMetadataReader");
const { Writable, Readable } = require("stream");

class IcecastStream extends Readable {
  constructor() {
    super();
  }

  append(stream) {
    this.push(stream);
  }

  _read() {}
}

class IcecastMetadata extends Readable {
  constructor({ icyBr }) {
    super({ objectMode: true });
    this._icyBr = icyBr;
  }

  append({ metadata, stats: { streamBytesRead } }) {
    super.push({
      metadata,
      time: streamBytesRead / (this._icyBr * 125),
    });
  }

  _read() {}
}

/**
 * @description An IcecastMetadataParser implemented as a Transform stream
 * @param {Object} IcecastMetadataTransformStream constructor parameter
 * @param {number} IcecastMetadataTransformStream.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
 * @param {number} IcecastMetadataTransformStream.icyBr Bitrate of audio stream used to increase accuracy when to updating metadata
 * @param {onMetadata} IcecastMetadataTransformStream.onMetadata Callback executed when metadata is discovered and queued for update
 *
 * @callback onMetadata
 * @param {Object} metadata Object containing all metadata received.
 * @param {string} [metadata.StreamTitle] Title of the metadata update.
 * @param {string} [metadata.StreamUrl] Url (usually album art) of the metadata update.
 * @param {number} time Time in seconds the metadata should be displayed / recorded
 */
class IcecastMetadataTransformStream extends Writable {
  constructor({ icyMetaInt, icyBr }) {
    super();

    this._generator = read(icyMetaInt);
    this._icyBr = icyBr;

    this._stream = new IcecastStream();
    this._metadata = new IcecastMetadata({ icyBr });
  }

  get stream() {
    return this._stream;
  }

  get metadata() {
    return this._metadata;
  }

  _write(chunk, enc, next) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {
      if (i.value.stream) {
        this._stream.append(i.value.stream);
      } else {
        this.metadata.append(i.value);
      }
    }
    next();
  }

  end() {
    this._stream.push(null);
    this._metadata.push(null);
    super.end();
  }
}

module.exports = IcecastMetadataTransformStream;
