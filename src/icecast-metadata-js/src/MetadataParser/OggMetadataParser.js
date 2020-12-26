const MetadataParser = require("./MetadataParser");

const FLAC = Symbol();
const OPUS = Symbol();
const VORBIS = Symbol();

class OggMetadataParser extends MetadataParser {
  constructor(params) {
    super(params);
    this._generator = this.readOgg();
    this._generator.next();
  }

  getUint32(data, offset = 0) {
    let bytes = [];
    for (let i = offset; i < offset + 4; i++) {
      bytes.push(data[i]);
    }
    const view = new DataView(Uint8Array.from(bytes).buffer);

    return view.getUint32(0, true);
  }

  getInt32(data, offset) {
    let bytes = [];
    for (let i = offset; i < offset + 4; i++) {
      bytes.push(data[i]);
    }
    const view = new DataView(Uint8Array.from(bytes).buffer);

    return view.getInt32(0, true);
  }

  _matchBytes(matchString, bytes) {
    return String.fromCharCode(...bytes).match(matchString);
  }

  *_identifyCodec() {
    const data = yield* this._getNextValue(8);

    yield* this._readStream();

    if (this._matchBytes(/\x7fFLAC/, data.subarray(0, 5))) {
      return FLAC;
    } else if (this._matchBytes(/OpusHead/, data.subarray(0, 8))) {
      return OPUS;
    } else if (this._matchBytes(/\x01vorbis/, data.subarray(0, 7))) {
      return VORBIS;
    }
  }

  *_getNextValue(length) {
    const streamPayload = {
      stream: yield* super._getNextValue(length),
      stats: this._stats.stats,
    };

    this._onStreamPromise = this._onStream(streamPayload);
    yield streamPayload;
    return streamPayload.stream;
  }

  *_readMetadata(matchString, length) {
    if (this._matchBytes(matchString, yield* this._getNextValue(length))) {
      const metadataPayload = {
        metadata: yield* this.readVorbisComment(),
        stats: this._stats.stats,
      };

      console.log(metadataPayload.metadata);

      this._onMetadataPromise = this._onMetadata(metadataPayload);
      yield metadataPayload;
    }
  }

  *_readStream() {
    while (this._remainingData) {
      yield* this._getNextValue();
    }
  }

  *readVorbisComment() {
    /*
    1) [vendor_length] = read an unsigned integer of 32 bits
    2) [vendor_string] = read a UTF-8 vector as [vendor_length] octets
    3) [user_comment_list_length] = read an unsigned integer of 32 bits
    4) iterate [user_comment_list_length] times {
       5) [length] = read an unsigned integer of 32 bits
       6) this iteration's user comment = read a UTF-8 vector as [length] octets
    }
    7) [framing_bit] = read a single bit as boolean
    8) if ( [framing_bit] unset or end of packet ) then ERROR
    9) done.
    */
    const vendorStringLength = this.getUint32(yield* this._getNextValue(4));

    const vendorString = this._decoder.decode(
      yield* this._getNextValue(vendorStringLength)
    );

    console.log(vendorString);

    const commentListLength = this.getUint32(yield* this._getNextValue(4));

    let comments = [];
    for (let i = 0; i < commentListLength; i++) {
      const commentLength = this.getUint32(yield* this._getNextValue(4));
      comments.push(
        this._decoder.decode(yield* this._getNextValue(commentLength))
      );
    }

    return comments;
  }

  *_readOggPage() {
    const baseOggPage = yield* this._getNextValue(27); // OGG Page header without page segments

    // Bytes (1-4 of 28)
    // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
    // Byte (6 of 28)
    // * `00000...`: All zeros
    if (
      this._matchBytes(/OggS/, baseOggPage.subarray(0, 4)) &&
      !(baseOggPage[5] & 0b11111000)
    ) {
      //console.log(this.getInt32(baseOggPage, 18));
      // Byte (27 of 28)
      // * `JJJJJJJJ`: Number of page segments in the segment table
      const oggPageSegments = yield* this._getNextValue(baseOggPage[26]);

      this._remainingData = oggPageSegments.reduce(
        (acc, octet) => acc + octet,
        0
      );
      return true;
    } else {
      console.log("not an ogg stream...");
      return false;
    }
  }

  *readOgg() {
    if (yield* this._readOggPage()) {
      switch (yield* this._identifyCodec()) {
        case FLAC:
          while (true) {
            yield* this._readStream();
            yield* this._readOggPage();
            yield* this._readMetadata(/^[\x84|\x04]/, 4);
          }
        case OPUS:
          while (true) {
            yield* this._readStream();
            yield* this._readOggPage();
            yield* this._readMetadata(/OpusTags/, 8);
          }
        case VORBIS:
          while (true) {
            yield* this._readStream();
            yield* this._readOggPage();
            yield* this._readMetadata(/\x03vorbis/, 7);
          }
      }
    }

    this._remainingData = Infinity;
    yield* this._readStream();
  }
}

module.exports = OggMetadataParser;
