/* Copyright 2020 Ethan Halsall
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

const MetadataParser = require("./MetadataParser");

/**
 * @description Splits Icecast raw response into stream bytes and metadata key / value pairs.
 * @param {number} icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
 * @param {number} icyDetectionTimeout Duration in milliseconds to search for metadata if icyMetaInt isn't passed in
 *
 * @callback onMetadata
 * @param {object} value Object containing Metadata and Statistics
 * @param {object} metadata Object containing the metadata received.
 * @param {string} [metadata.StreamTitle] Title of the metadata update.
 * @param {string} [metadata.StreamUrl] Url (usually album art) of the metadata update.
 * @param {object} stats Object containing statistics on how many bytes were read and the current read position.
 *
 * @callback onStream
 * @param {object} value Object containing Stream data and Statistics
 * @param {Uint8Array} stream Object containing the stream buffer.
 * @param {object} stats Object containing statistics on how many bytes were read and the current read position.
 */
class IcyMetadataParser extends MetadataParser {
  constructor({
    icyMetaInt,
    icyDetectionTimeout = 2000,
    onStream,
    onMetadata,
  } = {}) {
    super({ onMetadata, onStream });

    this._icyMetaInt = icyMetaInt;
    this._icyDetectionTimeout = icyDetectionTimeout;

    this._generator = this._generator();
    this._generator.next();
  }

  /**
   * @description Parses an Icecast metadata string into key value pairs.
   * @param {string} metadataString Icecast formatted metadata string. (i.e. "StreamTitle='A Title';")
   * @returns {object} Parsed metadata key value pairs. (i.e. {StreamTitle: "A Title"})
   */
  static parseMetadataString(metadataString) {
    /**
     * Metadata is a string of key='value' pairs delimited by a semicolon.
     * The string is a fixed length and any unused bytes at the end are 0x00.
     * i.e. "StreamTitle='The Stream Title';StreamUrl='https://example.com';\0\0\0\0\0\0"
     */

    const metadata = {};
    // [{key: "StreamTitle", val: "The Stream Title"}, {key: "StreamUrl", val: "https://example.com"}]
    for (let match of metadataString.matchAll(
      /(?<key>[^\0]+?)='(?<val>[^\0]*?)(;$|';|'$|$)/g
    )) {
      metadata[match["groups"]["key"]] = match["groups"]["val"];
    }
    // {StreamTitle: "The Stream Title", StreamUrl: "https://example.com"}
    return metadata;
  }

  *_generator() {
    if (yield* this._hasIcyMetadata()) {
      do {
        this._remainingData = this._icyMetaInt;
        yield* this._getStream();
        yield* this._getMetadataLength();
        if (this._remainingData) yield* this._getMetadata();
      } while (true);
    }

    this._remainingData = Infinity;
    yield* this._getStream();
  }

  *_hasIcyMetadata() {
    if (this._icyMetaInt > 0) return true;
    if (!this._icyDetectionTimeout) return false;

    console.warn(
      "icecast-metadata-js",
      "\n  Passed in Icy-MetaInt is invalid. Attempting to detect ICY Metadata.",
      "\n  See https://github.com/eshaz/icecast-metadata-js for information on how to properly request ICY Metadata."
    );

    // prettier-ignore
    const METADATA_SEARCH = [null,83,116,114,101,97,109,84,105,116,108,101,61]; // StreamTitle=
    const startTime = Date.now();
    let metaInt = 0;

    while (startTime + this._icyDetectionTimeout > Date.now()) {
      this._buffer = MetadataParser.concatBuffers(
        this._buffer,
        yield* this._readData()
      );

      // search for metadata
      detectMetadata: while (
        metaInt <
        this._buffer.length - METADATA_SEARCH.length
      ) {
        for (let i = 1; i < METADATA_SEARCH.length; i++) {
          if (this._buffer[i + metaInt] !== METADATA_SEARCH[i]) {
            metaInt++;
            continue detectMetadata;
          }
        }

        // found metadata
        console.warn(
          "icecast-metadata-js",
          `\n  Found ICY Metadata! Setting Icy-MetaInt to ${metaInt}.`
        );
        this._icyMetaInt = metaInt;
        return true;
      }
    }

    // prettier-ignore
    console.warn(
      "icecast-metadata-js",
      `\n  ICY Metadata not detected after searching ${this._buffer.length} bytes for ${(Date.now() - startTime) / 1000} seconds.`,
      "\n  Assuming stream does not contain ICY metadata. Audio errors will occur if there is ICY metadata."
    );
    return false;
  }

  *_getStream() {
    this._stats.currentStreamBytesRemaining = this._remainingData;

    while (this._remainingData) {
      yield* this._sendStream(yield* super._getNextValue());
    }
  }

  *_getMetadataLength() {
    this._remainingData = 1;

    do {
      this._remainingData = (yield* this._getNextValue())[0] * 16;
    } while (this._remainingData === 1);

    this._stats.addMetadataLengthBytes(1);
  }

  *_getMetadata() {
    this._stats.currentMetadataBytesRemaining = this._remainingData;

    const metadata = yield* this._getNextValue(this._remainingData);
    this._stats.addMetadataBytes(metadata.length);

    yield* this._sendMetadata(
      IcyMetadataParser.parseMetadataString(this._decoder.decode(metadata))
    );
  }
}

module.exports = IcyMetadataParser;
