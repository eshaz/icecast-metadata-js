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

class IcecastMetadataQueue {
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

  constructor({ icyMetaInt, icyBr, onMetadataUpdate, onMetadata }) {
    this._icyMetaInt = icyMetaInt;
    this._icyBr = icyBr;
    this._onMetadataUpdate = onMetadataUpdate;
    this._onMetadata = onMetadata;

    this._metadataQueue = [];
    this._metadataCurrentTime = 0;
    this._metadataEndOfBufferTime = 0;
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
   * @description Calculates audio stream length based on bitrate
   * @param {number} bytesRead Number of bytes
   * @type {number} Seconds
   */
  getTimeByBytes(bytesRead) {
    return this._icyBr ? bytesRead / (this._icyBr * 125) : 0;
  }

  /**
   * @description Resets the internal state of the IcecastMetadataReader
   */
  reset() {
    this._purgeMetadataQueue();
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

  _addMetadata(metadata, currentTime, endOfBufferTime) {
    /**
     * Metadata time is sum of the total time elapsed when readBuffer is called
     * with the offset of the audio bytes read so far while parsing.
     */
    const time = currentTime + endOfBufferTime;

    // metadata callbacks
    this._disableMetadataUpdates ||
      this._enqueueMetadata(metadata, time, currentTime);
    this._onMetadata && this._onMetadata({ ...metadata, time });
  }
}

module.exports = IcecastMetadataQueue;
