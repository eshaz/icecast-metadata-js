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

class IcecastMetadataParser {
  /**
   * @description Reads, parses, and schedules updates up to the millisecond for Icecast Metadata from the response body of an Icecast stream mountpoint
   * @description The accuracy of metadata updates is a direct relationship of the icyMetaInt
   * @param {Object} IcecastMetadataParser constructor parameter
   * @param {number} IcecastMetadataParser.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
   * @param {number} [IcecastMetadataParser.icyBr] Bitrate of audio stream used to increase accuracy when to updating metadata
   * @param {function} [IcecastMetadataParser.onMetadataUpdate] Callback executed when metadata is scheduled to update
   * @param {function} [IcecastMetadataParser.onMetadataQueue] Callback executed when metadata is discovered and queued for update
   */
  constructor({ icyMetaInt, icyBr, onMetadataUpdate, onMetadataQueue }) {
    this._dec = new TextDecoder("utf-8");
    this._icyMetaInt = icyMetaInt;
    this._icyBr = icyBr;
    this._onMetadataUpdate = onMetadataUpdate;
    this._onMetadataQueue = onMetadataQueue;

    this._stream = new Uint8Array();
    this._metadataQueue = [];
    this._readPosition = 0;
    this._step = 0;
  }

  /**
   * @description Returns and clears the buffer of streaming audio data
   * @type {UInt8Array} Stored bytes of stream data
   */
  get stream() {
    const oldStream = this._stream;
    this._stream = new Uint8Array();
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
   * @description Reads the incoming byte array and saves the metadata and stream data
   * @param {UInt8Array} buffer Byte array from the Icecast stream response body
   * @param {number} currentTime Time in seconds representing current time the audio player is reporting
   * @param {number} endOfBufferTime Time in seconds representing the end of the stored buffer by the audio player
   */
  readBuffer(buffer, currentTime, endOfBufferTime) {
    this._readPosition = 0;

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
          this._bytesToRead = this._readData(buffer)[0] * 16; // calculate length of metadata
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
    this._stream = new Uint8Array();
    this._readPosition = 0;
    this._step = 0;
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

    this._bytesToRead || this._nextStep();

    return data;
  }

  _appendStream(data) {
    const newStream = new Uint8Array(this._stream.length + data.length);
    newStream.set(this._stream, 0);
    newStream.set(data, this._stream.length);
    this._stream = newStream;
  }

  _getMetadataBitrateOffset() {
    // attempts to synchronize the metadata to bitrate of the audio stream
    return this._icyBr ? this._readPosition / (this._icyBr * 125) : 0;
  }

  _enqueueMetadata(meta) {
    this._metadataQueue.push(meta);
    if (this._onMetadataQueue)
      this._onMetadataQueue({ metadata: meta.metadata, time: meta.time });
  }

  _dequeueMetadata() {
    const meta = this._metadataQueue.shift();
    if (this._onMetadataUpdate)
      this._onMetadataUpdate({ metadata: meta.metadata, time: meta.time });
  }

  _addMetadata(data, playTime, readTime) {
    // decode and push the metadata to the queue
    const time = readTime + this._getMetadataBitrateOffset();

    const metadataTriggerTime = (time - playTime) * 1000;

    const metadata = this._dec
      .decode(data) // "StreamTitle='The Stream Title';      "
      .replace(/.*StreamTitle='/, "") // "The Stream Title';      "
      .replace(/';.*/, ""); // "The Stream Title"

    this._enqueueMetadata({
      _timeoutId: setTimeout(() => {
        this._dequeueMetadata();
      }, metadataTriggerTime),
      metadata,
      time,
    });
  }

  _getLastMP3HeaderIndex(data) {
    // NOTE: This currently not used, and un-tested; however, it is kept here for future needs
    // Enhancements would need to be made to calculate the frame length to ensure the result is actually a header
    let i = data.length - 4;

    while (i > 0) {
      // 1st byte must be 255
      // 11111111
      // ^^^^^^^^
      //  (sync)

      // 2nd byte:
      // (111)(x0)(01)(x) <- checksum
      //  ^^^  ^^  ^^
      //  |    |   layer III
      //  |    mpeg 2 or mpeg 2.5
      //  sync

      // 3rd byte must not have these bits
      // (1111)(11)(xx)
      //  ^^^^  ^^
      //  |     invalid sample rate
      //  invalid bitrate

      // 4th byte must have these bits
      // (??)(xx)(x)(x)(00) <- no pre-emphasis
      //  ^^            ^^
      //  |
      //  00 - Stereo
      //  01 - Joint stereo (Stereo)
      //  10 - Dual channel (2 mono channels)
      //  11 - Single channel (Mono)

      if (!(data[i] ^ 255)) {
        if (!((data[i + 1] & 238) ^ 226)) {
          // must be a sync byte
          if (
            (data[i + 2] & 240) ^ 240 && // must be MPEG 2 or 2.5 and layer 3
            (data[i + 2] & 12) ^ 12 && // must have a valid sample rate
            !((data[i + 3] & 3) ^ 0)
          ) {
            // must not have pre-emphasis
            // && !((data[i+3] & 192) ^ this.streamFormat.channelMode * 64)
            break;
          }
        }
      }
      i--;
    }

    console.log(
      data[i].toString(2).padStart(8, "0"),
      data[i + 1].toString(2).padStart(8, "0"),
      data[i + 2].toString(2).padStart(8, "0"),
      data[i + 3].toString(2).padStart(8, "0")
    );

    return i;
  }
}

module.exports = IcecastMetadataParser;
