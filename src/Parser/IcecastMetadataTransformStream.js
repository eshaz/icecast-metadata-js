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

const IcecastMetadataParser = require("./IcecastMetadataParser");
const { Transform } = require("stream");

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
class IcecastMetadataTransformStream extends Transform {
  constructor({ icyMetaInt, icyBr, onMetadata }) {
    super();

    this.icecastMetadataParser = new IcecastMetadataParser({
      icyMetaInt,
      icyBr,
      onMetadata,
      disableMetadataUpdates: true,
    });
    this._icyBr = icyBr;
  }

  _transform(chunk, encoding, callback) {
    this.icecastMetadataParser.readBuffer(
      chunk,
      0,
      this.icecastMetadataParser.getTimeByBytes(
        this.icecastMetadataParser.streamBytesRead
      )
    );
    const stream = this.icecastMetadataParser.stream;
    callback(null, stream);
  }
}

module.exports = IcecastMetadataTransformStream;
