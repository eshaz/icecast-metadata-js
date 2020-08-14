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

const READ_STREAM_LENGTH = 0;
const READ_STREAM_CHUNK = 1;
const READ_METADATA_LENGTH = 2;
const CHECK_FOR_METADATA = 3;
const READ_METADATA_CHUNK = 4;
const ADD_METADATA = 5;

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
    this._step = 0;
    this._streamBytesRead = 0;
    this._metadataBytesRead = 0;
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
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
    return this._streamBytesRead;
  }

  /**
   * @description Returns the total metadata bytes read
   * @type {number} Total metadata bytes read
   */
  get metadataBytesRead() {
    return this._metadataBytesRead;
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

    do {
      switch (this._step) {
        case READ_STREAM_LENGTH:
          this._bytesToRead = this._icyMetaInt;
          this._nextStep();
          break;
        case READ_STREAM_CHUNK:
          this._appendStream(this._readData(buffer));
          break;
        case READ_METADATA_LENGTH:
          this._bytesToRead = 1; // metadata length is stored in one byte
          this._bytesToRead = this._readData(buffer)[0] * 16; // calculate length of metadata
          break;
        case CHECK_FOR_METADATA:
          this._metadataBytesRead++; // count the metadata length
          if (!this._bytesToRead) {
            this._step = READ_STREAM_LENGTH; // skip the metadata read steps if there is nothing to read
          } else {
            this._startReadingMetadata(currentTime, endOfBufferTime);
            this._nextStep();
          }
          break;
        case READ_METADATA_CHUNK:
          this._appendMetadata(this._readData(buffer));
          break;
        case ADD_METADATA:
          this._addMetadata();
          this._nextStep();
          break;
      }
    } while (this._readPosition < buffer.length);
  }

  /**
   * @description Resets the internal state of the IcecastMetadataReader
   */
  reset() {
    this._streamBuffer.init();
    this._metadataBuffer.init();
    this._readPosition = 0;
    this._step = 0;
    this._streamBytesRead = 0;
    this._metadataBytesRead = 0;
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
    this._purgeMetadataQueue();
  }

  /**
   * @description Clears all metadata updates and empties the queue
   */
  _purgeMetadataQueue() {
    this._metadataQueue.forEach((i) => clearTimeout(i._timeoutId));
    this._metadataQueue = [];
  }

  _nextStep() {
    // cycle through the steps to parse icecast data
    this._step = (this._step + 1) % 6;
  }

  _readData(value) {
    const readTo = this._bytesToRead + this._readPosition;

    const data =
      readTo < value.length
        ? value.subarray(this._readPosition, readTo)
        : value.subarray(this._readPosition);

    this._readPosition += data.length;
    this._bytesToRead -= data.length;

    /**
     * If we have more bytes to read, but we have ran out of
     * data in `value`, continue this on this step when record is
     * called again.
     */
    this._bytesToRead || this._nextStep();

    return data;
  }

  /**
   * @description Appends audio data to the internal audio stream buffer
   * @param {UInt8Array} data Data to append
   */
  _appendStream(data) {
    this._streamBuffer.append(data);

    this._streamBytesRead += data.length;
  }

  /**
   * @description Appends metadata to the internal metadata buffer
   * @param {UInt8Array} data Data to append
   */
  _appendMetadata(data) {
    this._metadataBuffer.append(data);

    this._metadataBytesRead += data.length;
  }

  /**
   * @description Creates a new metadata buffer and saves the timestamps for adding the metadata
   * @param {number} currentTime Current time the audio player is reporting
   * @param {number} endOfBufferTime Total time buffered in the audio player
   */
  _startReadingMetadata(currentTime, endOfBufferTime) {
    this._metadataBuffer.addBuffer(this._bytesToRead);
    this._metadataCurrentTime = currentTime;
    this._metadataEndOfBufferTime = endOfBufferTime;
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

  _addMetadata() {
    /**
     * Metadata is a string of key=value pairs delimited by a semicolon.
     * The string is a fixed length and any unused bytes at the end are 0x00.
     */
    const metadata = {};
    String.fromCharCode(...this._metadataBuffer.readAll) //    "StreamTitle='The Stream Title';StreamUrl='https://example.com';\0\0\0\0\0\0"
      .replace(/\0*$/g, "") //                                 "StreamTitle='The Stream Title';StreamUrl='https://example.com';"
      .split("';") //                                         ["StreamTitle='The Stream Title, "StreamUrl='https://example.com", ""]
      .filter((val) => val) //                                ["StreamTitle='The Stream Title, "StreamUrl='https://example.com"]
      .map((val) => val.split("='")) //                      [["StreamTitle", "The Stream Title"], ["StreamUrl", "https://example.com"]]
      .forEach(([key, value]) => (metadata[key] = value)); // { StreamTitle: "The Stream Title", StreamUrl: "https://example.com" }

    /**
     * Metadata time is sum of the total time elapsed when readBuffer is called
     * with the offset of the audio bytes read so far while parsing.
     */
    const time =
      this._metadataEndOfBufferTime +
      this.getTimeByBytes(this._streamBuffer.length);

    // metadata callbacks
    this._disableMetadataUpdates ||
      this._enqueueMetadata(metadata, time, this._metadataCurrentTime);
    this._onMetadata && this._onMetadata({ metadata, time });

    // reset the metadata buffer because we're done with it
    this._metadataBuffer.init();
  }
}

module.exports = IcecastMetadataParser;
