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

const BufferArray = require("./BufferArray");

class IcecastMetadataParser {
  /**
   * @description Reads, parses, and schedules updates up to the millisecond for Icecast Metadata from the response body of an Icecast stream mountpoint
   * @description The accuracy of metadata updates is a direct relationship of the icyMetaInt
   * @param {Object} IcecastMetadataParser constructor parameter
   * @param {number} IcecastMetadataParser.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
   * @param {number} [IcecastMetadataParser.icyBr] Bitrate of audio stream used to increase accuracy when to updating metadata
   * @param {boolean} [IcecastMetadataParser.disableMetadataUpdates] Disables scheduled metadata updates
   * @param {onMetadataUpdate} [IcecastMetadataParser.onMetadataUpdate] Callback executed when metadata is scheduled to update
   * @param {onMetadata} [IcecastMetadataParser.onMetadata] Callback executed when metadata is discovered and queued for update
   *
   * @callback onMetadataUpdate
   * @param {Object} metadata Object containing all metadata received.
   * @param {string} [metadata.StreamTitle] Title of the metadata update.
   * @param {string} [metadata.StreamUrl] Url (usually album art) of the metadata update.
   * @param {number} time Time in seconds the metadata should be displayed / recorded
   *
   * @callback onMetadata
   * @param {Object} metadata Object containing all metadata received.
   * @param {string} [metadata.StreamTitle] Title of the metadata update.
   * @param {string} [metadata.StreamUrl] Url (usually album art) of the metadata update.
   * @param {number} time Time in seconds the metadata should be displayed / recorded
   */

  constructor({
    icyMetaInt,
    icyBr,
    disableMetadataUpdates,
    onMetadataUpdate,
    onMetadata,
  }) {
    this._icyMetaInt = icyMetaInt;
    this._icyBr = icyBr;
    this._disableMetadataUpdates = disableMetadataUpdates;
    this._onMetadataUpdate = onMetadataUpdate;
    this._onMetadata = onMetadata;

    this._streamBuffer = new BufferArray();
    this._metadataBuffer = new BufferArray();
    this._metadataQueue = [];
    this._readPosition = 0;
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
    this._metadataLength = 0;
    this._remainingData = 0;

    this._steps = {
      READ_STREAM: (buffer) => {
        this._streamBuffer.append(this._readData(buffer, this._icyMetaInt));

        return this._remainingData
          ? this._steps.READ_STREAM
          : this._steps.READ_METADATA_LENGTH;
      },
      READ_METADATA_LENGTH: (buffer) => {
        this._metadataLength = this._readData(buffer, 1)[0] * 16;

        return this._remainingData
          ? this._steps.READ_METADATA_LENGTH
          : this._metadataLength
          ? this._steps.INITIALIZE_METADATA
          : this._steps.READ_STREAM;
      },
      INITIALIZE_METADATA: () => {
        this._metadataBuffer.addBuffer(this._metadataLength);
        return this._steps.READ_METADATA;
      },
      READ_METADATA: (buffer) => {
        this._metadataBuffer.append(
          this._readData(buffer, this._metadataLength)
        );
        return this._remainingData
          ? this._steps.READ_METADATA
          : this._steps.ADD_METADATA;
      },
      ADD_METADATA: () => {
        this._addMetadata(this._metadataBuffer.readAll);
        return this._steps.READ_STREAM;
      },
    };

    this._step = this._steps.READ_STREAM;
  }

  /**
   * @description Parses key value pairs from metadata string
   * @param {string} metaString String containing Icecast metadata
   * @type {Object} Key Value pairs extracted from the metadata
   */
  static parseMetadataString(metaString) {
    /**
     * Metadata is a string of key='value' pairs delimited by a semicolon.
     * The string is a fixed length and any unused bytes at the end are 0x00.
     * i.e. "StreamTitle='The Stream Title';StreamUrl='https://example.com';\0\0\0\0\0\0"
     */
    const metadata = {};

    // [{key: "StreamTitle", val: "The Stream Title"}, {key: "StreamUrl", val: "https://example.com"}]
    try {
      for (let match of metaString.matchAll(
        /(?<key>[ -~]+?)='(?<val>[ -~]*?)(;$|';|'$|$)/g
      )) {
        metadata[match["groups"]["key"]] = match["groups"]["val"];
      }
    } catch (e) {
      if (typeof metaString !== "string") {
        console.error(
          "Metadata must be of type string, instead got",
          metaString
        );
      }
    }

    // {StreamTitle: "The Stream Title", StreamUrl: "https://example.com"}
    return metadata;
  }

  /**
   * @description Returns and clears the buffer of streaming audio data
   * @type {UInt8Array} Stored bytes of stream data
   */
  get stream() {
    const oldStream = this._streamBuffer.readAll;
    this._streamBuffer.init();
    return oldStream;
  }

  /**
   * @description Returns the metadata queued for updates
   * @type {{metadata: string, time: number}[]} Queued metadata
   */
  get metadataQueue() {
    return this._metadataQueue.map(({ metadata, time }) => ({
      metadata,
      time,
    }));
  }

  /**
   * @description Returns the total stream bytes read
   * @type Total stream bytes
   */
  get streamBytesRead() {
    return this._streamBuffer.totalBytes;
  }

  /**
   * @description Returns the total metadata bytes read
   * @type {number} Total metadata bytes read
   */
  get metadataBytesRead() {
    return this._metadataBuffer.totalBytes;
  }

  /**
   * @description Calculates audio stream length based on bitrate
   * @param {number} bytesRead Number of bytes
   * @type {number} Seconds
   */
  getTimeByBytes(bytesRead) {
    return this._icyBr ? bytesRead / (this._icyBr * 125) : 0;
  }

  /**
   * @description Reads the incoming byte array and saves the metadata and stream data
   * @param {UInt8Array} buffer Byte array from the Icecast stream response body
   * @param {number} [currentTime] Time in seconds representing current time the audio player is reporting
   * @param {number} [endOfBufferTime] Total time in seconds that the audio player has played and has buffered
   */
  readBuffer(buffer, currentTime, endOfBufferTime) {
    this._readPosition = 0;
    this._streamBuffer.addBuffer(buffer.length);
    this._metadataCurrentTime = currentTime;
    this._metadataEndOfBufferTime = endOfBufferTime;

    do {
      this._step = this._step(buffer);
    } while (this._readPosition !== buffer.length);
  }

  /**
   * @description Resets the internal state of the IcecastMetadataReader
   */
  reset() {
    this._streamBuffer.init();
    this._metadataBuffer.init();
    this._readPosition = 0;
    this._step = this._steps.READ_STREAM;
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
    this._metadataLength = 0;
    this._remainingData = 0;
    this._purgeMetadataQueue();
  }

  _readData(value, bytes) {
    this._remainingData = this._remainingData || bytes;

    const data = value.subarray(
      this._readPosition,
      this._remainingData + this._readPosition
    );

    this._readPosition += data.length;
    this._remainingData -= data.length;

    return data;
  }

  /**
   * @description Clears all metadata updates and empties the queue
   */
  _purgeMetadataQueue() {
    this._metadataQueue.forEach((i) => clearTimeout(i._timeoutId));
    this._metadataQueue = [];
  }

  _enqueueMetadata(metadata, time, playTime) {
    this._metadataQueue.push({
      _timeoutId: setTimeout(() => {
        this._dequeueMetadata();
      }, (time - playTime) * 1000), // trigger timeout relative to play position
      metadata,
      time,
    });
  }

  _dequeueMetadata() {
    const meta = this._metadataQueue.shift();
    this._onMetadataUpdate &&
      this._onMetadataUpdate({ metadata: meta.metadata, time: meta.time });
  }

  _addMetadata(metadataBuffer) {
    /**
     * Metadata time is sum of the total time elapsed when readBuffer is called
     * with the offset of the audio bytes read so far while parsing.
     */
    const time =
      this._metadataEndOfBufferTime +
      this.getTimeByBytes(this._streamBuffer.length);

    const metadata = IcecastMetadataParser.parseMetadataString(
      String.fromCharCode(...metadataBuffer)
    );

    // metadata callbacks
    this._disableMetadataUpdates ||
      this._enqueueMetadata(metadata, time, this._metadataCurrentTime);
    this._onMetadata && this._onMetadata({ metadata, time });

    this._metadataBuffer.init();
  }
}

module.exports = IcecastMetadataParser;
