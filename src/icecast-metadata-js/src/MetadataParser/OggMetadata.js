export default class OggMetadata {
  constructor() {
    this._oggHeader = null;
    this._generator = this.readOgg();
    this._generator.next();
  }

  async asyncReadAll(chunk) {
    for (
      let i = this._generator.next(chunk);
      i.value;
      i = this._generator.next()
    ) {}
  }

  getUint32(data, offset) {
    let bytes = [];
    for (let i = offset; i < offset + 4; i++) {
      bytes.push(data[i]);
    }
    const view = new DataView(Uint8Array.from(bytes).buffer);

    return view.getUint32(0, true);
  }

  startsWith(bytes, string) {
    return [...string].every((char, idx) => char.charCodeAt(0) === bytes[idx]);
  }

  syncOggPage(data) {
    let pages = [];

    for (let offset = 0; offset < data.length - 28; offset++) {
      // Bytes (1-4 of 28)
      // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
      if (this.startsWith(data.subarray(offset), "OggS")) {
        // Byte (6 of 28)
        // * `00000...`: All zeros
        if (data[offset + 5] & 0b11111000) continue;

        // Byte (27 of 28)
        // * `JJJJJJJJ`: Number of page segments in the segment table
        const numberPageSegments = data[offset + 26];

        const headerLength = numberPageSegments + 27;
        if (offset + headerLength > data.length) throw new Error("out of data");

        const dataLength = data
          .subarray(offset + 27, offset + 27 + numberPageSegments)
          .reduce((acc, octet) => acc + octet, 0);

        pages.push({
          dataLength,
          headerLength,
          offset: offset,
          isComplete: data.length >= offset + headerLength + dataLength,
        });
        offset += headerLength + dataLength - 1;
      }
    }

    return pages;
  }

  identifyCodec(data) {
    if (this.startsWith(data, "\x01vorbis")) {
      this._codec = "vorbis";
    } else if (this.startsWith(data, "OpusHead")) {
      this._codec = "opus";
    } else if (this.startsWith(data, "\x7fFLAC")) {
      this._codec = "flac";
    }
    console.log(this._codec);
  }

  readMetadata(data) {
    switch (this._codec) {
      case "vorbis": {
        /*
        1) [packet_type] : 8 bit value // should equal 1??
          0x01 = identification header
          0x03 = comment header
          0x05 = setup header
        2) 0x76, 0x6f, 0x72, 0x62, 0x69, 0x73: the characters ’v’,’o’,’r’,’b’,’i’,’s’ as six octets
        */
        return (
          this.startsWith(data, "\x03vorbis") && this.readVorbisComment(data, 7)
        );
      }
      case "opus": {
        return (
          this.startsWith(data, "OpusTags") && this.readVorbisComment(data, 8)
        );
      }
    }
  }

  readVorbisComment(data, offset) {
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
    const dec = new TextDecoder("utf8");

    const vendorStringLength = this.getUint32(data, offset);
    offset += 4;

    const vendorString = dec.decode(
      data.subarray(offset, offset + vendorStringLength)
    );
    offset += vendorStringLength;

    const commentListLength = this.getUint32(data, offset);
    offset += 4;

    let comments = [];
    for (let i = 0; i < commentListLength; i++) {
      const commentLength = this.getUint32(data, offset);
      offset += 4;
      comments.push(dec.decode(data.subarray(offset, offset + commentLength)));
      offset += commentLength;
    }

    console.log(vendorString, comments);
  }

  *readOgg() {
    while (true) {
      const data = yield* this._readData();

      const pages = this.syncOggPage(data);
      pages.forEach(({ headerLength, offset }) => {
        this._codec || this.identifyCodec(data.subarray(headerLength + offset));
        this.readMetadata(data.subarray(headerLength + offset));
      });
    }
  }

  *_readData() {
    let data;

    do {
      data = yield; // if out of data, accept new data in the .next() call
    } while (!data || data.length === 0);

    return data;
  }
}
