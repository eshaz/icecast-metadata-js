const { EventEmitter } = require("events");
const MetadataBuffer = require("./MetadataBuffer");

class Stats {
  constructor() {
    this._metadataBytesRead = 0;
    this._streamBytesRead = 0;
    this._totalBytesRead = 0;
  }

  get stats() {
    return {
      metadataBytesRead: this._metadataBytesRead,
      streamBytesRead: this._streamBytesRead,
      totalBytesRead: this._totalBytesRead,
    };
  }

  set addMetadataBytes(bytes) {
    this._metadataBytesRead += bytes;
  }

  set addStreamBytes(bytes) {
    this._streamBytesRead += bytes;
  }

  set addBytes(bytes) {
    this._totalBytesRead += bytes;
  }
}

/**
 * @description Splits Icecast raw response into stream bytes and metadata key / value pairs.
 * @param {number} icyMetaInt Interval in bytes of metadata updates returned by the Icecast server
 * @fires IcecastMetadataReader#metadata
 * @fires IcecastMetadataReader#stream
 */
class IcecastMetadataReader extends EventEmitter {
  constructor(icyMetaInt) {
    super();

    this._icyMetaInt = icyMetaInt;
    this._remainingData = 0;
    this._currentPosition = 0;
    this._buffer = null;
    this._stats = new Stats();

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
      /(?<key>[ -~]+?)='(?<val>[ -~]*?)(;$|';|'$|$)/g
    )) {
      metadata[match["groups"]["key"]] = match["groups"]["val"];
    }
    // {StreamTitle: "The Stream Title", StreamUrl: "https://example.com"}
    return metadata;
  }

  /**
   * @description Parses Icecast metadata bytes into key value pairs.
   * @param {Uint8Array} metadataBytes Bytes containing Icecast metadata.
   * @returns {object} Parsed metadata key value pairs. (i.e. {StreamTitle: "A Title"})
   */
  static parseMetadata(metadataBytes) {
    return IcecastMetadataReader.parseMetadataString(
      String.fromCharCode(...metadataBytes)
    );
  }

  /**
   * @description Reads through an icecast response and emits stream and metadata events.
   * @param {Uint8Array} chunk Bytes to split into stream and metadata
   */
  readAll(chunk) {
    for (let i = this._generator.next(chunk); i.value; i = this._generator.next()) {}
  }

  /**
   * @description Generator next function.
   * @param {Uint8Array} data Next chunk of data to read
   * @returns {object} Object containing stream or metadata. Returns undefined when out of data to read.
   */
  next(data) {
    return this._generator.next(data);
  }

  *_generator() {
    do {
      yield* this._getStream();
      yield* this._getMetadataLength();
      this._remainingData && (yield* this._getMetadata());
    } while (true);
  }

  *_getStream() {
    this._remainingData = this._icyMetaInt;

    do {
      const stream = yield* this._getNextValue();
      this._stats.addStreamBytes = stream.length;

      const streamPayload = { stream, stats: this._stats.stats };
      /**
       * Stream event.
       *
       * @event IcecastMetadataReader#stream
       * @type {object}
       * @property {Uint8Array} stream Stream bytes.
       * @property {object} stats Statistics on bytes read.
       */
      this.emit("stream", streamPayload);

      yield streamPayload;
    } while (this._remainingData);
  }

  *_getMetadataLength() {
    this._remainingData = 1;

    do {
      this._remainingData = (yield* this._getNextValue())[0] * 16;
    } while (this._remainingData === 1);
  }

  *_getMetadata() {
    let metadata = yield* this._getNextValue();
    if (this._remainingData) metadata = yield* this._storeMetadata(metadata);

    this._stats.addMetadataBytes = metadata.length;

    const metadataPayload = {
      metadata: IcecastMetadataReader.parseMetadata(metadata),
      stats: this._stats.stats,
    };
    /**
     * Metadata event.
     *
     * @event IcecastMetadataReader#metadata
     * @type {object}
     * @property {object} metadata Metadata key value pairs..
     * @param {property} [metadata.StreamTitle] Title of the metadata update.
     * @param {property} [metadata.StreamUrl] Url (usually album art) of the metadata update.
     * @property {object} stats Statistics on bytes read.
     */
    this.emit("metadata", metadataPayload);

    yield metadataPayload;
  }

  *_storeMetadata(currentMetadata) {
    // Store any partial metadata updates until a full metadata chunk can be parsed.
    const metadataBuffer = new MetadataBuffer(
      this._remainingData + currentMetadata.length
    );
    metadataBuffer.push(currentMetadata);

    do {
      metadataBuffer.push(yield* this._getNextValue());
    } while (this._remainingData);

    return metadataBuffer.pop();
  }

  *_getNextValue() {
    while (!this._buffer || this._currentPosition === this._buffer.length) {
      this._buffer = yield; // if out of data, accept new data in the .next() call
      this._currentPosition = 0;
    }
    const value = this._buffer.subarray(
      this._currentPosition,
      this._remainingData + this._currentPosition
    );

    this._remainingData -= value.length;
    this._currentPosition += value.length;
    this._stats.addBytes = value.length;

    return value;
  }
}

module.exports = IcecastMetadataReader;
