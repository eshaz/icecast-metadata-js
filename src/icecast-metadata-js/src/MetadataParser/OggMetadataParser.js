const MetadataParser = require("./MetadataParser");

class OggMetadataParser extends MetadataParser {
  constructor(params) {
    super(params);
    this._generator = this.readOgg();
    this._generator.next();
  }

  getUint32(data, offset = 0) {
    return new DataView(
      Uint8Array.from([...data.subarray(offset, offset + 4)]).buffer
    ).getUint32(0, true);
  }

  _matchBytes(matchString, bytes) {
    return String.fromCharCode(...bytes).match(matchString);
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

  *_getMetadata({ regex, length }) {
    if (this._matchBytes(regex, yield* this._getNextValue(length))) {
      const metadataPayload = {
        metadata: yield* this._readVorbisComment(),
        stats: this._stats.stats,
      };

      this._onMetadataPromise = this._onMetadata(metadataPayload);
      yield metadataPayload;
    }
  }

  *_getStream() {
    while (this._remainingData) {
      yield* this._getNextValue();
    }
  }

  *_readVorbisComment() {
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

  *_identifyCodec() {
    const data = yield* this._getNextValue(8);

    yield* this._getStream();

    if (this._matchBytes(/\x7fFLAC/, data.subarray(0, 5))) {
      return { regex: /^[\x84|\x04]/, length: 4 };
    } else if (this._matchBytes(/OpusHead/, data.subarray(0, 8))) {
      return { regex: /OpusTags/, length: 8 };
    } else if (this._matchBytes(/\x01vorbis/, data.subarray(0, 7))) {
      return { regex: /\x03vorbis/, length: 7 };
    }
  }

  *readOgg() {
    const hasOggPage = yield* this._readOggPage();
    const codecMatcher = yield* this._identifyCodec();

    if (hasOggPage && codecMatcher) {
      while (yield* this._readOggPage()) {
        yield* this._getMetadata(codecMatcher);
        yield* this._getStream();
      }
    } else {
      this._remainingData = Infinity;
      yield* this._getStream();
    }
  }
}

module.exports = OggMetadataParser;
