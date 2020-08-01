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

const { TextDecoder } = require("util");
const BufferArray = require("./BufferArray");

class IcecastMetadataParser {
  /**
   * @description Reads, parses, and schedules updates up to the millisecond for Icecast Metadata from the response body of an Icecast stream mountpoint
   * @description The accuracy of metadata updates is a direct relationship of the icyMetaInt
   * @param {Object} IcecastMetadataParser constructor parameter
   * @param {number} IcecastMetadataParser.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
   * @param {number} [IcecastMetadataParser.icyBr] Bitrate of audio stream used to increase accuracy when to updating metadata
   * @param {function} [IcecastMetadataParser.disableMetadataUpdates] Disables deferred metadata updates
   * @param {function} [IcecastMetadataParser.onMetadataUpdate] Callback executed when metadata is scheduled to update
   * @param {function} [IcecastMetadataParser.onMetadata] Callback executed when metadata is discovered and queued for update
   */
  constructor({
    icyMetaInt,
    icyBr,
    disableMetadataUpdates,
    onMetadataUpdate,
    onMetadata,
  }) {
    this._dec = new TextDecoder("utf-8");
    this._icyMetaInt = icyMetaInt;
    this._icyBr = icyBr;
    this._disableMetadataUpdates = disableMetadataUpdates;
    this._onMetadataUpdate = onMetadataUpdate;
    this._onMetadata = onMetadata;

    this._stream = new BufferArray();
    this._metadataQueue = [];
    this._readPosition = 0;
    this._step = 0;
    this._streamBytesRead = 0;
    this._metadataBytesRead = 0;
  }

  /**
   * @description Returns and clears the buffer of streaming audio data
   * @type {UInt8Array} Stored bytes of stream data
   */
  get stream() {
    const oldStream = this._stream.readAll;
    this._stream.init();
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
   * @param {number} [endOfBufferTime] Time in seconds representing the end of the stored buffer by the audio player
   */
  readBuffer(buffer, currentTime, endOfBufferTime) {
    this._readPosition = 0;
    this._stream.newBuffer(buffer.length);

    do {
      switch (this._step) {
        case 0: // read stream length
          this._bytesToRead = this._icyMetaInt;
          this._nextStep();
          break;
        case 1: // read stream chunk
          this._appendStream(this._readData(buffer));
          break;
        case 2: // read metadata length
          this._bytesToRead = 1; // metadata length is stored in one byte
          this._metadataBytesRead++; // this counts as metadata
          this._bytesToRead = this._readData(buffer)[0] * 16; // calculate length of metadata -> 1360
          if (!this._bytesToRead) this._nextStep(); // skip the metadata read step if there is nothing to read
          break;
        case 3: // read metadata chunk
          this._addMetadata(
            this._readData(buffer),
            currentTime,
            endOfBufferTime
          );
          break;
      }
    } while (this._readPosition < buffer.length);
  }

  /**
   * @description Resets the internal state of the IcecastMetadataReader
   */
  reset() {
    this._stream.init();
    this._readPosition = 0;
    this._step = 0;
    this._streamBytesRead = 0;
    this._metadataBytesRead = 0;
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
    this._step = (this._step + 1) % 4;
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
   * @type {number} Number of bytes written to the audio stream buffer
   * @param {UInt8Array} data Data to append
   */
  _appendStream(data) {
    this._stream.append(data);

    this._streamBytesRead += data.length;
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

  _addMetadata(data, playTime, readTime) {
    /**
     * Metadata time is sum of the total time elapsed when readBuffer is called
     * with the offset of the audio bytes read so far while parsing.
     */
    const time = readTime + this.getTimeByBytes(this._stream.length);

    const metadata = this._dec
      .decode(data) // "StreamTitle='The Stream Title';      "
      .replace(/.*StreamTitle='/, "") // "The Stream Title';      "
      .replace(/';.*/, ""); // "The Stream Title"

    this._disableMetadataUpdates ||
      this._enqueueMetadata(metadata, time, playTime);
    this._onMetadata && this._onMetadata({ metadata, time });

    this._metadataBytesRead += data.length;
  }
}

module.exports = IcecastMetadataParser;
