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

// http://www.mp3-tech.org/programmer/frame_header.html

export default class Header {
  static headerByteLength = 4;

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

  static layer12ModeExtensions = {
    0b00000000: "bands 4 to 31",
    0b00010000: "bands 8 to 31",
    0b00100000: "bands 12 to 31",
    0b00110000: "bands 16 to 31",
  };

  static layer3ModeExtensions = {
    0b00000000: "Intensity stereo off, MS stereo off",
    0b00010000: "Intensity stereo on, MS stereo off",
    0b00100000: "Intensity stereo off, MS stereo on",
    0b00110000: "Intensity stereo on, MS stereo on",
  };

  static layers = {
    0b00000000: { description: "reserved" },
    0b00000010: {
      description: "Layer III",
      framePadding: 1,
      modeExtensions: Header.layer3ModeExtensions,
      v1: {
        bitrateIndex: Header.v1Layer3,
        sampleLength: 1152,
      },
      v2: {
        bitrateIndex: Header.v2Layer23,
        sampleLength: 576,
      },
    },
    0b00000100: {
      description: "Layer II",
      framePadding: 1,
      modeExtensions: Header.layer12ModeExtensions,
      sampleLength: 1152,
      v1: {
        bitrateIndex: Header.v1Layer2,
      },
      v2: {
        bitrateIndex: Header.v2Layer23,
      },
    },
    0b00000110: {
      description: "Layer I",
      framePadding: 4,
      modeExtensions: Header.layer12ModeExtensions,
      sampleLength: 384,
      v1: {
        bitrateIndex: Header.v1Layer1,
      },
      v2: {
        bitrateIndex: Header.v2Layer1,
      },
    },
  };

  static mpegVersions = {
    0b00000000: {
      description: "MPEG Version 2.5 (later extension of MPEG 2)",
      layers: "v2",
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
      layers: "v2",
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
      layers: "v1",
      sampleRates: {
        0b00000000: 44100,
        0b00000100: 48000,
        0b00001000: 32000,
        0b00001100: "reserved",
      },
      sampleLengths: Header.v1SampleLengths,
    },
  };

  static protection = {
    0b00000000: "16bit CRC",
    0b00000001: "none",
  };

  static emphasis = {
    0b00000000: "none",
    0b00000001: "50/15 ms",
    0b00000010: "reserved",
    0b00000011: "CCIT J.17",
  };

  static channelModes = {
    0b00000000: { channels: 2, description: "Stereo" },
    0b01000000: { channels: 2, description: "Joint stereo" },
    0b10000000: { channels: 2, description: "Dual channel" },
    0b11000000: { channels: 1, description: "Single channel (Mono)" },
  };

  static getHeader(buffer) {
    // Must be at least four bytes.
    if (buffer.length < 4) return null;

    // Frame sync (all bits must be set): `11111111|111`:
    if (buffer[0] !== 0xff || buffer[1] < 0xe0) return null;

    // Header's second (out of four) octet: `111xxxxx`
    //
    // * `...BB...`: MPEG Audio version ID
    // * `.....CC.`: Layer description
    // * `.......1`: Protection bit (0 - Protected by CRC (16bit CRC follows header), 1 = Not protected)
    const mpegVersionBits = buffer[1] & 0b00011000;
    const layerBits = buffer[1] & 0b00000110;
    const protectionBit = buffer[1] & 0b00000001;

    const header = {};

    // Mpeg version (1, 2, 2.5)
    const mpegVersion = Header.mpegVersions[mpegVersionBits];
    if (mpegVersion.description === "reserved") return null;

    // Layer (I, II, III)
    if (Header.layers[layerBits].description === "reserved") return null;
    const layer = {
      ...Header.layers[layerBits],
      ...Header.layers[layerBits][mpegVersion.layers],
    };

    header.mpegVersion = mpegVersion.description;
    header.layer = layer.description;
    header.sampleLength = layer.sampleLength;
    header.protection = Header.protection[protectionBit];

    // Header's third (out of four) octet: `EEEEFFGH`
    //
    // * `EEEE....`: Bitrate index. 1111 is invalid, everything else is accepted
    // * `....FF..`: Sample rate
    // * `......G.`: Padding bit, 0=frame not padded, 1=frame padded
    // * `.......H`: Private bit.
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

    header.frameByteLength = Math.floor(
      (125 * header.bitrate * header.sampleLength) / header.sampleRate +
        header.framePadding
    );
    if (!header.frameByteLength) return null;

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

    header.channelMode = Header.channelModes[channelModeBits].description;
    header.channels = Header.channelModes[channelModeBits].channels;
    header.modeExtension = layer.modeExtensions[modeExtensionBits];
    header.isCopyrighted = !!(copyrightBits >> 3);
    header.isOriginal = !!(originalBits >> 2);

    header.emphasis = Header.emphasis[emphasisBits];
    if (header.emphasis === "reserved") return null;

    return new Header(header);
  }

  constructor(header) {
    this._bitrate = header.bitrate;
    this._channelMode = header.channelMode;
    this._channels = header.channels;
    this._emphasis = header.emphasis;
    this._framePadding = header.framePadding;
    this._isCopyrighted = header.isCopyrighted;
    this._isOriginal = header.isOriginal;
    this._isPrivate = header.isPrivate;
    this._layer = header.layer;
    this._modeExtension = header.modeExtension;
    this._mpegVersion = header.mpegVersion;
    this._protection = header.protection;
    this._sampleLength = header.sampleLength;
    this._sampleRate = header.sampleRate;
    this._frameByteLength = header.frameByteLength;
  }

  get channels() {
    return this._channels;
  }

  get frameByteLength() {
    return this._frameByteLength;
  }

  get sampleRate() {
    return this._sampleRate;
  }

  get sampleLength() {
    return this._sampleLength;
  }
}
