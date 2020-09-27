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
const READ_STREAM = 1;
const READ_METADATA_LENGTH = 2;
const INITIALIZE_METADATA = 3;
const READ_METADATA = 4;
const ADD_METADATA = 5;
/*
const READ_STREAM_LENGTH = Symbol("READ_STREAM_LENGTH");
const READ_STREAM = Symbol("READ_STREAM");
const READ_METADATA_LENGTH = Symbol("READ_METADATA_LENGTH");
const INITIALIZE_METADATA = Symbol("INITIALIZE_METADATA");
const READ_METADATA = Symbol("READ_METADATA");
const ADD_METADATA = Symbol("ADD_METADATA");
*/

const steps = [
  READ_STREAM_LENGTH,
  READ_STREAM,
  READ_METADATA_LENGTH,
  INITIALIZE_METADATA,
  READ_METADATA,
  ADD_METADATA,
];

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
    this._streamBytesRead = 0;
    this._metadataBytesRead = 0;
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
    this._metadataLength = 0;
    this._chunkLength = 0;
    this._step = 0;
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
        metadata[match.groups.key] = match.groups.val;
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

    for (const step of this._steps(buffer.length)) {
      switch (step) {
        case READ_STREAM_LENGTH:
          this._reading = false;
          break;
        case READ_STREAM:
          this._appendStream(this._readData(buffer, this._icyMetaInt));
          break;
        case READ_METADATA_LENGTH:
          this._metadataLength = this._readData(buffer, 1)[0] * 16; // calculate length of metadata
          break;
        case INITIALIZE_METADATA:
          this._metadataBytesRead++; // count the metadata length
          this._startReadingMetadata(currentTime, endOfBufferTime);
          break;
        case READ_METADATA:
          this._appendMetadata(this._readData(buffer, this._metadataLength));
          break;
        case ADD_METADATA:
          this._addMetadata();
          break;
      }
    }
  }

  *_steps(bufferLength) {
    while (this._readPosition !== bufferLength) {
      if (!this._reading) {
        if (this._step === READ_METADATA_LENGTH && !this._metadataLength) {
          this._step = READ_STREAM_LENGTH;
        } else {
          this._step = (this._step + 1) % steps.length;
        }
      }

      yield steps[this._step];
    }
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
    this._metadataLength = 0;
    this._chunkLength = 0;
    this._purgeMetadataQueue();
  }

  _readData(value, bytes) {
    this._chunkLength = this._chunkLength || bytes;

    const readTo = this._chunkLength + this._readPosition;

    const data = value.subarray(this._readPosition, readTo);

    this._readPosition += data.length;
    this._chunkLength -= data.length;

    /**
     * If we have more bytes to read, but we have ran out of
     * data in `value`, continue this on this step when record is
     * called again.
     */
    this._reading = this._chunkLength;
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
   * @description Clears all metadata updates and empties the queue
   */
  _purgeMetadataQueue() {
    this._metadataQueue.forEach((i) => clearTimeout(i._timeoutId));
    this._metadataQueue = [];
  }

  /**
   * @description Creates a new metadata buffer and saves the timestamps for adding the metadata
   * @param {number} currentTime Current time the audio player is reporting
   * @param {number} endOfBufferTime Total time buffered in the audio player
   */
  _startReadingMetadata(currentTime, endOfBufferTime) {
    this._metadataBuffer.addBuffer(this._metadataLength);
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
     * Metadata time is sum of the total time elapsed when readBuffer is called
     * with the offset of the audio bytes read so far while parsing.
     */
    const time =
      this._metadataEndOfBufferTime +
      this.getTimeByBytes(this._streamBuffer.length);

    const metadata = IcecastMetadataParser.parseMetadataString(
      String.fromCharCode(...this._metadataBuffer.readAll)
    );

    // metadata callbacks
    this._disableMetadataUpdates ||
      this._enqueueMetadata(metadata, time, this._metadataCurrentTime);
    this._onMetadata && this._onMetadata({ metadata, time });

    // reset the metadata buffer because we're done with it
    this._metadataBuffer.init();
  }
}

module.exports = IcecastMetadataParser;
