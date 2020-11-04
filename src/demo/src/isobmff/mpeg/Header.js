/*
This class is heavily inspired by https://github.com/biril/mp3-parser.
*/

// http://www.mp3-tech.org/programmer/frame_header.html

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

  static emphasis = {
    0b00000000: "none",
    0b00000001: "50/15 ms",
    0b00000010: "reserved",
    0b00000011: "CCIT J.17",
  };

  static layer12ModeExtension = {
    0b00000000: "bands 4 to 31",
    0b00010000: "bands 8 to 31",
    0b00100000: "bands 12 to 31",
    0b00110000: "bands 16 to 31",
  };

  static layer3ModeExtension = {
    0b00000000: "Intensity stereo off, MS stereo off",
    0b00010000: "Intensity stereo on, MS stereo off",
    0b00100000: "Intensity stereo off, MS stereo on",
    0b00110000: "Intensity stereo on, MS stereo on",
  };

  static v1Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrateIndex: Header.v1Layer3,
      framePadding: 1,
      modeExtensions: Header.layer3ModeExtension,
      sampleLength: 1152,
    },
    0b00000100: {
      description: "Layer II",
      bitrateIndex: Header.v1Layer2,
      framePadding: 1,
      modeExtensions: Header.layer12ModeExtension,
      sampleLength: 1152,
    },
    0b00000110: {
      description: "Layer I",
      bitrateIndex: Header.v1Layer1,
      framePadding: 4,
      modeExtensions: Header.layer12ModeExtension,
      sampleLength: 384,
    },
  };

  static v2Layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      bitrateIndex: Header.v2Layer23,
      framePadding: 1,
      modeExtensions: Header.layer3ModeExtension,
      sampleLength: 576,
    },
    0b00000100: {
      description: "Layer II",
      bitrateIndex: Header.v2Layer23,
      framePadding: 1,
      modeExtensions: Header.layer12ModeExtension,
      sampleLength: 1152,
    },
    0b00000110: {
      description: "Layer I",
      bitrateIndex: Header.v2Layer1,
      framePadding: 4,
      modeExtensions: Header.layer12ModeExtension,
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

  constructor(header) {
    this._bitrate = header.bitrate;
    this._channelMode = header.channelMode;
    this._emphasis = header.emphasis;
    this._framePadding = header.framePadding;
    this._isCopyrighted = header.isCopyrighted;
    this._isOriginal = header.isOriginal;
    this._isPrivate = header.isPrivate;
    this._isProtected = header.isProtected;
    this._layer = header.layer;
    this._modeExtension = header.modeExtension;
    this._mpegVersion = header.mpegVersion;
    this._sampleLength = header.sampleLength;
    this._sampleRate = header.sampleRate;
  }

  static getHeader(buffer) {
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
    const modeExtensionBits = buffer[3] & 0b00110000;
    const copyrightBits = buffer[3] & 0b00001000;
    const originalBits = buffer[3] & 0b00000100;
    const emphasisBits = buffer[3] & 0b00000011;

    header.channelMode = Header.channelModes[channelModeBits];
    header.modeExtension = layer.modeExtensions[modeExtensionBits];
    header.isCopyrighted = !!(copyrightBits >> 3);
    header.isOriginal = !!(originalBits >> 2);

    header.emphasis = Header.emphasis[emphasisBits];
    if (header.emphasis === "reserved") return null;

    return new Header(header);
  }

  // Get the number of bytes in a frame given its `bitrate`, `sampleRate` and `padding`.
  //  Based on [magic formula](http://mpgedit.org/mpgedit/mpeg_format/mpeghdr.htm)
  get frameByteLength() {
    const byteRate = (this._bitrate * 1000) / 8;
    return Math.floor(
      (this._sampleLength * byteRate) / this._sampleRate + this._framePadding
    );
  }
}
