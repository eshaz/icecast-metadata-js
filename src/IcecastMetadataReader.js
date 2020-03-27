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

class IcecastMetadataReader {
  /**
   * @description Reads, parses, and schedules updates for Icecast Metadata from the response body of an Icecast stream mountpoint
   * @param {Object} IcecastMetadataReader constructor parameter
   * @param {number} IcecastMetadataReader.icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
   * @param {number} [IcecastMetadataReader.icyBr] Bitrate of audio stream used to estimate when to update metadata
   * @param {function} [IcecastMetadataReader.onMetadataUpdate] Callback executed when metadata is scheduled to update
   * @param {function} [IcecastMetadataReader.onMetadataQueue] Callback executed when metadata is discovered and queued for update
   */
  constructor({ icyMetaInt, icyBr, onMetadataUpdate, onMetadataQueue }) {
    this._dec = new TextDecoder("utf-8");
    this._icyMetaInt = icyMetaInt;
    this._icyBr = icyBr;
    this._onMetadataUpdate = onMetadataUpdate;
    this._onMetadataQueue = onMetadataQueue;

    this._stream = new Uint8Array();
    this._metadataQueue = [];
    this._position = 0;
    this._status = 0;
  }

  /**
   * @description Reads a byte array and extracts metadata chunks
   * @param {UInt8Array} buffer Byte array from the Icecast stream response body
   * @param {number} currentTime Time in seconds representing current time the audio player is reporting
   * @param {number} endOfBufferTime Time in seconds representing the end of the stored buffer by the audio player
   */
  readBuffer(buffer, currentTime, endOfBufferTime) {
    // reads the incoming byte array and saves the metadata and stream data
    // save any partial chunks of metadata or stream data so it can be used
    this._position = 0;

    do {
      switch (this._status) {
        case 0: // read stream length
          this._bytesToRead = this._icyMetaInt;
          this._next();
          break;
        case 1: // read stream chunk
          this._setStream(this._readData(buffer));
          break;
        case 2: // read metadata length
          this._bytesToRead = 1; // metadata length is stored in one byte
          this._bytesToRead = this._readData(buffer)[0] * 16; // calculate length of metadata
          if (!this._bytesToRead) this._next(); // skip the metadata read step if there is nothing to read
          break;
        case 3: // read metadata chunk
          this._setMetadata(
            this._readData(buffer),
            currentTime,
            endOfBufferTime
          );
          break;
      }
    } while (this._position < buffer.length);
  }

  /**
   * @description Resets the internal state of the IcecastMetadataReader
   */
  reset() {
    // clear all state
    this._stream = new Uint8Array();
    this._position = 0;
    this._status = 0;
    this.purgeMetadataQueue();
  }

  /**
   * @description Returns and clears the stored buffer of streaming audio data
   * @returns {UInt8Array} Stored bytes of stream data
   */
  getStream() {
    // returns the icecast stream and reset the buffer
    const oldStream = this._stream;
    this._stream = new Uint8Array();
    return oldStream;
  }

  /**
   * @description Returns the metadata queued for updates
   * @returns {{metadata: string, time: number}[]} Queued metadata
   */
  getMetadataQueue() {
    return this._metadataQueue.map(({ metadata, time }) => ({
      metadata,
      time,
    }));
  }

  /**
   * @description Clears all metadata updates and empties the queue
   */
  purgeMetadataQueue() {
    // clears all of the pending metadata updates and resets the queue
    this._metadataQueue.forEach((i) => clearTimeout(i._timeoutId));
    this._metadataQueue = [];
  }

  _next() {
    // cycle through the steps to parse icecast data
    this._status = (this._status + 1) % 4;
  }

  _readData(value) {
    const readTo = this._bytesToRead + this._position;

    const data =
      readTo < value.length
        ? value.subarray(this._position, readTo)
        : value.subarray(this._position);

    this._position += data.length;
    this._bytesToRead -= data.length;

    if (this._bytesToRead === 0) this._next();

    return data;
  }

  _setStream(data) {
    const newStream = new Uint8Array(this._stream.length + data.length);
    newStream.set(this._stream, 0);
    newStream.set(data, this._stream.length);
    this._stream = newStream;
  }

  _getMetadataBitrateOffset() {
    // attempts to synchronize the metadata to bitrate of the audio stream
    return this._icyBr ? this._position / (this._icyBr * 125) : 0;
  }

  _enqueueMetadata(meta) {
    this._metadataQueue.push(meta);
    if (this._onMetadataQueue) this._onMetadataQueue(meta.metadata);
  }

  _dequeueMetadata() {
    const meta = this._metadataQueue.shift();
    if (this._onMetadataQueue) this._onMetadataQueue(meta.metadata);
    return meta;
  }

  _setMetadata(data, playTime, readTime) {
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
        if (this._onMetadataUpdate) this._onMetadataUpdate(metadata);
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
