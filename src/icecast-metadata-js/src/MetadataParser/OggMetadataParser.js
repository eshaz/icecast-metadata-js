const MetadataParser = require("./MetadataParser");

class OggMetadataParser extends MetadataParser {
  constructor(params) {
    super(params);
    this._generator = this._generator();
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

  *_generator() {
    if (yield* this._hasOggPage()) {
      const codecMatcher = yield* this._identifyCodec();
      if (codecMatcher) {
        while (yield* this._hasOggPage()) {
          yield* this._getMetadata(codecMatcher);
          yield* this._getStream();
        }
      }
    }

    this._remainingData = Infinity;
    yield* this._getStream();
  }

  *_hasOggPage() {
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
      console.warn(
        "icecast-metadata-js",
        "\n  This stream is not an OGG stream. No OGG metadata will be returned.",
        "\n  See https://github.com/eshaz/icecast-metadata-js for information on OGG metadata."
      );
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

  *_getMetadata({ regex, length }) {
    if (this._matchBytes(regex, yield* this._getNextValue(length))) {
      yield* this._sendMetadata(yield* this._readVorbisComment());
    }
  }

  *_getStream() {
    while (this._remainingData) {
      yield* this._getNextValue();
    }
  }

  *_getNextValue(length) {
    const value = yield* super._getNextValue(length);

    this._stats.currentStreamBytesRemaining = value.length;

    yield* this._sendStream(value);
    return value;
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
    let bytesRead = 0;
    const vendorStringLength = this.getUint32(yield* this._getNextValue(4));
    bytesRead += 4 + vendorStringLength;

    const vendorString = this._decoder.decode(
      yield* this._getNextValue(vendorStringLength)
    );

    const comments = [];

    const commentListLength = this.getUint32(yield* this._getNextValue(4));
    bytesRead += 4;

    for (let i = 0; i < commentListLength; i++) {
      const commentLength = this.getUint32(yield* this._getNextValue(4));
      bytesRead += 4 + commentLength;

      comments.push(yield* this._getNextValue(commentLength));
    }

    this._stats.addMetadataBytes(bytesRead);

    return comments.reduce(
      (metadata, comment) => {
        const delimiter = comment.indexOf(0x3d);
        // prettier-ignore
        const key = String.fromCharCode(...comment.subarray(0, delimiter)).toUpperCase();
        const val = this._decoder.decode(comment.subarray(delimiter + 1));

        metadata[key] = metadata[key] ? `${metadata[key]}; ${val}` : val;
        return metadata;
      },
      { VENDOR_STRING: vendorString }
    );
  }
}

module.exports = OggMetadataParser;
