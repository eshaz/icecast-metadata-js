/*
This class is heavily inspired by https://github.com/biril/mp3-parser.
*/

// http://www.mp3-tech.org/programmer/frame_header.html

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
  static bitrateMatrix = {
    // bits | V1,L1 | V1,L2 | V1,L3 | V2,L1 | V2, L2 & L3
    0b00000000: ["free", "free", "free", "free", "free"],
    0b00010000: [32, 32, 32, 32, 8],
    0b00100000: [64, 48, 40, 48, 16],
    0b00110000: [96, 56, 48, 56, 24],
    0b01000000: [128, 64, 56, 64, 32],
    0b01010000: [160, 80, 64, 80, 40],
    0b01100000: [192, 96, 80, 96, 48],
    0b01110000: [224, 112, 96, 112, 56],
    0b10000000: [256, 128, 112, 128, 64],
    0b10010000: [288, 160, 128, 144, 80],
    0b10100000: [320, 192, 160, 160, 96],
    0b10110000: [352, 224, 192, 176, 112],
    0b11000000: [384, 256, 224, 192, 128],
    0b11010000: [416, 320, 256, 224, 144],
    0b11100000: [448, 384, 320, 256, 160],
    0b11110000: ["bad", "bad", "bad", "bad", "bad"],
  };

  static v1Layer1 = 0;
  static v1Layer2 = 1;
  static v1Layer3 = 2;
  static v2Layer1 = 3;
  static v2Layer23 = 4;

  static channelModes = {
    0b00000000: "Stereo",
    0b01000000: "Joint stereo (Stereo)",
    0b10000000: "Dual channel (Stereo)",
    0b11000000: "Single channel (Mono)",
  };

  static v1Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrateIndex: Header.v1Layer3,
      sampleLength: 1152,
      framePadding: 1,
    },
    0b00000100: {
      description: "Layer II",
      bitrateIndex: Header.v1Layer2,
      sampleLength: 1152,
      framePadding: 1,
    },
    0b00000110: {
      description: "Layer I",
      bitrateIndex: Header.v1Layer1,
      sampleLength: 384,
      framePadding: 4,
    },
  };

  static v2Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrateIndex: Header.v2Layer23,
      sampleLength: 576,
      framePadding: 1,
    },
    0b00000100: {
      description: "Layer II",
      bitrateIndex: Header.v2Layer23,
      sampleLength: 1152,
      framePadding: 1,
    },
    0b00000110: {
      description: "Layer I",
      bitrateIndex: Header.v2Layer1,
      sampleLength: 384,
      framePadding: 4,
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

    const header = {};

    const mpegVersion = Header.mpegVersions[mpegVersionBits];
    header.mpegVersion = mpegVersion.description;
    if (header.mpegVersion === "reserved") return null;

    header.mpegVersion = mpegVersion.description;

    const layer = mpegVersion.layers[layerBits];
    header.layer = layer.description;
    if (header.layer === "reserved") return null;

    header.sampleLength = layer.sampleLength;
    header.isProtected = !!protectionBit;

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

    header.bitrate = Header.bitrateMatrix[bitrateBits][layer.bitrateIndex];
    if (header.bitrate === "bad") return null;

    header.sampleRate = mpegVersion.sampleRates[sampleRateBits];
    if (header.sampleRate === "reserved") return null;

    header.framePadding = paddingBit >> 1 && layer.framePadding;
    header.isPrivate = !!privateBit;

    // Header's fourth (out of four) octet: `IIJJKLMM`
    //
    // * `II......`: Channel mode
    // * `..JJ....`: Mode extension (only if joint stereo)
    // * `....K...`: Copyright
    // * `.....L..`: Original
    // * `......MM`: Emphasis
    const channelModeBits = buffer[3] & 0b11000000;
    header.channelMode = Header.channelModes[channelModeBits];

    return header;
  }

  // Get the number of bytes in a frame given its `bitrate`, `sampleRate` and `padding`.
  //  Based on [magic formula](http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm)
  get frameByteLength() {
    const sampleLength = this._values.sampleLength;
    const byteRate = (this._values.bitrate * 1000) / 8;
    return Math.floor(
      (sampleLength * byteRate) / this._values.sampleRate +
        this._values.framePadding
    );
  }
}
