/*
This class is heavily inspired by https://github.com/biril/mp3-parser.
*/

/*
Copyright (c) 2013-2016 Alex Lambiris

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
documentation files (the "Software"), to deal in the Software without restriction, including without limitation
the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and
to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of
the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO
THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

export default class Header {
  static v1l1Bitrates = {
    0b00000000: "free",
    0b00010000: 32,
    0b00100000: 64,
    0b00110000: 96,
    0b01000000: 128,
    0b01010000: 160,
    0b01100000: 192,
    0b01110000: 224,
    0b10000000: 256,
    0b10010000: 288,
    0b10100000: 320,
    0b10110000: 352,
    0b11000000: 384,
    0b11010000: 416,
    0b11100000: 448,
    0b11110000: "bad",
  };

  static v1l2Bitrates = {
    0b00000000: "free",
    0b00010000: 32,
    0b00100000: 48,
    0b00110000: 56,
    0b01000000: 64,
    0b01010000: 80,
    0b01100000: 96,
    0b01110000: 112,
    0b10000000: 128,
    0b10010000: 160,
    0b10100000: 192,
    0b10110000: 224,
    0b11000000: 256,
    0b11010000: 320,
    0b11100000: 384,
    0b11110000: "bad",
  };

  static v1l3Bitrates = {
    0b00000000: "free",
    0b00010000: 32,
    0b00100000: 40,
    0b00110000: 48,
    0b01000000: 56,
    0b01010000: 64,
    0b01100000: 80,
    0b01110000: 96,
    0b10000000: 112,
    0b10010000: 128,
    0b10100000: 160,
    0b10110000: 192,
    0b11000000: 224,
    0b11010000: 256,
    0b11100000: 320,
    0b11110000: "bad",
  };

  static v2l1Bitrates = {
    0b00000000: "free",
    0b00010000: 32,
    0b00100000: 48,
    0b00110000: 56,
    0b01000000: 64,
    0b01010000: 80,
    0b01100000: 96,
    0b01110000: 112,
    0b10000000: 128,
    0b10010000: 144,
    0b10100000: 160,
    0b10110000: 176,
    0b11000000: 192,
    0b11010000: 224,
    0b11100000: 256,
    0b11110000: "bad",
  };

  static v2l2Bitrates = {
    0b00000000: "free",
    0b00010000: 8,
    0b00100000: 16,
    0b00110000: 24,
    0b01000000: 32,
    0b01010000: 40,
    0b01100000: 48,
    0b01110000: 56,
    0b10000000: 64,
    0b10010000: 80,
    0b10100000: 96,
    0b10110000: 112,
    0b11000000: 128,
    0b11010000: 144,
    0b11100000: 160,
    0b11110000: "bad",
  };
  static v2l3Bitrates = Header.v2l2Bitrates;

  static channelModes = {
    "00": "Stereo",
    "01": "Joint stereo (Stereo)",
    10: "Dual channel (Stereo)",
    11: "Single channel (Mono)",
  };

  static v1Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrates: Header.v1l3Bitrates,
      sampleLength: 1152,
    },
    0b00000100: {
      description: "Layer II",
      bitrates: Header.v1l2Bitrates,
      sampleLength: 1152,
    },
    0b00000110: {
      description: "Layer I",
      bitrates: Header.v1l1Bitrates,
      sampleLength: 384,
    },
  };

  static v2Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrates: Header.v2l3Bitrates,
      sampleLength: 576,
    },
    0b00000100: {
      description: "Layer II",
      bitrates: Header.v2l2Bitrates,
      sampleLength: 1152,
    },
    0b00000110: {
      description: "Layer I",
      bitrates: Header.v2l1Bitrates,
      sampleLength: 384,
    },
  };

  static mpegVersions = {
    0b00000000: {
      description: "MPEG Version 2.5 (unofficial)",
      layers: Header.v2Layers,
      sampleRates: {
        0b00000000: 11025,
        0b00000100: 12000,
        0b00001000: 8000,
        0b00001100: "reserved",
      },
      sampleLengths: Header.v2SampleLengths,
    },
    0b00001000: { description: "reserved" },
    0b00010000: {
      description: "MPEG Version 2 (ISO/IEC 13818-3)",
      layers: Header.v2Layers,
      sampleRates: {
        0b00000000: 22050,
        0b00000100: 24000,
        0b00001000: 16000,
        0b00001100: "reserved",
      },
      sampleLengths: Header.v2SampleLengths,
    },
    0b00011000: {
      description: "MPEG Version 1 (ISO/IEC 11172-3)",
      layers: Header.v1Layers,
      sampleRates: {
        0b00000000: 44100,
        0b00000100: 48000,
        0b00001000: 32000,
        0b00001100: "reserved",
      },
      sampleLengths: Header.v1SampleLengths,
    },
  };

  // Produce octet's binary representation as a string
  static octetToBinRep(octet) {
    let b = [];
    b[0] = (octet & 128) === 128 ? "1" : "0";
    b[1] = (octet & 64) === 64 ? "1" : "0";
    b[2] = (octet & 32) === 32 ? "1" : "0";
    b[3] = (octet & 16) === 16 ? "1" : "0";
    b[4] = (octet & 8) === 8 ? "1" : "0";
    b[5] = (octet & 4) === 4 ? "1" : "0";
    b[6] = (octet & 2) === 2 ? "1" : "0";
    b[7] = (octet & 1) === 1 ? "1" : "0";
    return b.join("");
  }

  constructor(headerValues) {
    this._values = headerValues;
  }

  get values() {
    return this._values;
  }

  static _buildHeader(buffer) {
    // Header's first (out of four) octet: `11111111`: Frame sync (all bits must be set)
    if (buffer[0] ^ 0b11111111) return null;

    // Header's second (out of four) octet: `111xxxxx`
    //
    // * `111.....`: Rest of frame sync (all bits must be set)
    // * `...BB...`: MPEG Audio version ID (11 -> MPEG Version 1 (ISO/IEC 11172-3))
    // * `.....CC.`: Layer description (01 -> Layer III)
    // * `.......1`: Protection bit (1 = Not protected)
    const frameSync = buffer[1] & 0b11100000;
    const mpegVersionBits = buffer[1] & 0b00011000;
    const layerBits = buffer[1] & 0b00000110;
    const protectionBit = buffer[1] & 0b00000001;

    // Require the three most significant bits to be `111` (>= 224)
    if (frameSync !== 0b11100000) return null;

    const mpegVersion = Header.mpegVersions[mpegVersionBits];
    const layer = mpegVersion.layers[layerBits];

    const header = {
      mpegVersion: mpegVersion.description,
      layer: layer.description,
      sampleLength: layer.sampleLength,
      isProtected: !!protectionBit, // Just check if last bit is set
    };

    if (header.mpegVersion === "reserved") {
      return null;
    }

    if (header.layer === "reserved") {
      return null;
    }

    // Header's third (out of four) octet: `EEEEFFGH`
    //
    // * `EEEE....`: Bitrate index. 1111 is invalid, everything else is accepted
    // * `....FF..`: Sample rate, 00=44100, 01=48000, 10=32000, 11=reserved
    // * `......G.`: Padding bit, 0=frame not padded, 1=frame padded
    // * `.......H`: Private bit. This is informative
    const bitrateBits = buffer[2] & 0b11110000;
    const sampleRateBits = buffer[2] & 0b00001100;
    const paddingBit = buffer[2] & 0b00000010;
    const privateBit = buffer[2] & 0b00000001;

    header.bitrate = layer.bitrates[bitrateBits];
    if (header.bitrate === "bad") {
      return null;
    }

    header.sampleRate = mpegVersion.sampleRates[sampleRateBits];
    if (header.sampleRate === "reserved") {
      return null;
    }

    header.framePadding = paddingBit >> 1;
    header.isPrivate = !!privateBit;

    // Header's fourth (out of four) octet: `IIJJKLMM`
    //
    // * `II......`: Channel mode
    // * `..JJ....`: Mode extension (only if joint stereo)
    // * `....K...`: Copyright
    // * `.....L..`: Original
    // * `......MM`: Emphasis
    const b4 = buffer[3];
    header.channelModeBits = Header.octetToBinRep(b4).substr(0, 2);
    header.channelMode = Header.channelModes[header.channelModeBits];

    return header;
  }

  // Get the number of bytes in a frame given its `bitrate`, `sampleRate` and `padding`.
  //  Based on [magic formula](http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm)
  get frameByteLength() {
    const sampleLength = this._values.sampleLength;
    const paddingSize = this._values.framePadding
      ? this._values.layer === "Layer I"
        ? 4
        : 1
      : 0;
    const byteRate = (this._values.bitrate * 1000) / 8;
    return Math.floor(
      (sampleLength * byteRate) / this._values.sampleRate + paddingSize
    );
  }
}
