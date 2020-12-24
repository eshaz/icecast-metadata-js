const MetadataParser = require("./MetadataParser");

class OggMetadataParser extends MetadataParser {
  constructor() {
    super();
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

  startsWith(bytes, string) {
    return [...string].every((char, idx) => char.charCodeAt(0) === bytes[idx]);
  }

  *_identifyCodec() {
    const data = yield* this._getNextValue(8);

    yield* this._readStream();

    if (this.startsWith(data, "\x01vorbis")) {
      return "vorbis";
    } else if (this.startsWith(data, "OpusHead")) {
      return "opus";
    } else if (this.startsWith(data, "\x7fFLAC")) {
      return "flac";
    }
  }

  *_readMetadata(matchString) {
    if (
      this.startsWith(
        yield* this._getNextValue(matchString.length),
        matchString
      )
    ) {
      const metadata = yield* this.readVorbisComment();
      console.log(metadata);
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
    this._remainingData = 27;
    const baseOggPage = yield* this._getNextValue(27); // OGG Page header without page segments

    // Bytes (1-4 of 28)
    // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
    // Byte (6 of 28)
    // * `00000...`: All zeros
    if (
      this.startsWith(baseOggPage, "OggS") &&
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
    } else {
      console.log("not an ogg stream...");
      throw new Error();
    }
  }

  *readOgg() {
    yield* this._readOggPage();

    switch (yield* this._identifyCodec()) {
      case "vorbis":
        while (true) {
          yield* this._readStream();
          yield* this._readOggPage();
          yield* this._readMetadata("\x03vorbis");
        }
      case "opus":
        while (true) {
          yield* this._readStream();
          yield* this._readOggPage();
          yield* this._readMetadata("OpusTags");
        }
    }
  }
}

module.exports = OggMetadataParser;
