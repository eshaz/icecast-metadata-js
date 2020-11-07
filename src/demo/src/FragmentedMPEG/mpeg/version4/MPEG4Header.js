/*
https://wiki.multimedia.cx/index.php/ADTS

AAAAAAAA AAAABCCD EEFFFFGH HHIJKLMM MMMMMMMM MMMOOOOO OOOOOOPP (QQQQQQQQ QQQQQQQQ)

MPEG4Header consists of 7 or 9 bytes (without or with CRC).
Letter 	Length (bits) 	Description
A 	12 	syncword 0xFFF, all bits must be 1
B 	1 	MPEG Version: 0 for MPEG-4, 1 for MPEG-2
C 	2 	Layer: always 0
D 	1 	protection absent, Warning, set to 1 if there is no CRC and 0 if there is CRC
E 	2 	profile, the MPEG-4 Audio Object Type minus 1
F 	4 	MPEG-4 Sampling Frequency Index (15 is forbidden)
G 	1 	private bit, guaranteed never to be used by MPEG, set to 0 when encoding, ignore when decoding
H 	3 	MPEG-4 Channel Configuration (in the case of 0, the channel configuration is sent via an inband PCE)
I 	1 	originality, set to 0 when encoding, ignore when decoding
J 	1 	home, set to 0 when encoding, ignore when decoding
K 	1 	copyrighted id bit, the next bit of a centrally registered copyright identifier, set to 0 when encoding, ignore when decoding
L 	1 	copyright id start, signals that this frame's copyright id bit is the first bit of the copyright id, set to 0 when encoding, ignore when decoding
M 	13 	frame length, this value must include 7 or 9 bytes of header length: FrameLength = (ProtectionAbsent == 1 ? 7 : 9) + size(AACFrame)
O 	11 	Buffer fullness
P 	2 	Number of AAC frames (RDBs) in ADTS frame minus 1, for maximum compatibility always use 1 AAC frame per ADTS frame
Q 	16 	CRC if protection absent is 0 
*/

export default class MPEG4Header {
  static headerByteLength = 7;

  static mpegVersion = {
    0b00000000: "MPEG-4",
    0b00001000: "MPEG-2",
  };

  static layer = {
    0b00000000: "valid",
    0b00000010: "bad",
    0b00000100: "bad",
    0b00000110: "bad",
  };

  static protection = {
    0b00000000: "16bit CRC",
    0b00000001: "none",
  };

  static objectTypes = {
    0b00000000: "AAC Main",
    0b01000000: "AAC LC (Low Complexity)",
    0b10000000: "AAC SSR (Scalable Sample Rate)",
    0b11000000: "AAC LTP (Long Term Prediction)",
  };

  static sampleRates = {
    0b00000000: "96000",
    0b00000100: "88200",
    0b00001000: "64000",
    0b00001100: "48000",
    0b00010000: "44100",
    0b00010100: "32000",
    0b00011000: "24000",
    0b00011100: "22050",
    0b00100000: "16000",
    0b00100100: "12000",
    0b00101000: "11025",
    0b00101100: "8000",
    0b00110000: "7350",
    0b00110100: "reserved",
    0b00111000: "reserved",
    0b00111100: "frequency is written explictly",
  };

  static channelConfiguration = {
    0b000000000: { channels: 0, description: "Defined in AOT Specifc Config" },
    0b001000000: { channels: 1, description: "front-center" },
    0b010000000: { channels: 2, description: "front-left, front-right" },
    0b011000000: {
      channels: 3,
      description: "front-center, front-left, front-right",
    },
    0b100000000: {
      channels: 4,
      description: "front-center, front-left, front-right, back-center",
    },
    0b101000000: {
      channels: 5,
      description:
        "front-center, front-left, front-right, back-left, back-right",
    },
    0b110000000: {
      channels: 6,
      description:
        "front-center, front-left, front-right, back-left, back-right, LFE-channel",
    },
    0b111000000: {
      channels: 8,
      description:
        "front-center, front-left, front-right, side-left, side-right, back-left, back-right, LFE-channel",
    },
  };

  static buildHeader(buffer) {
    // Must be at least seven bytes.
    if (buffer.length < MPEG4Header.headerByteLength) return null;

    // Frame sync (all bits must be set): `11111111|1111`:
    if (buffer[0] !== 0xff || buffer[1] < 0xf0) return null;

    // Byte (2 of 7)
    // * `1111BCCD`
    // * `....B...`: MPEG Version: 0 for MPEG-4, 1 for MPEG-2
    // * `.....CC.`: Layer: always 0
    // * `.......D`: protection absent, Warning, set to 1 if there is no CRC and 0 if there is CRC
    const mpegVersionBits = buffer[1] & 0b00001000;
    const layerBits = buffer[1] & 0b00000110;
    const protectionBit = buffer[1] & 0b00000001;

    const header = {};
    header.mpegVersion = MPEG4Header.mpegVersion[mpegVersionBits];

    header.layer = MPEG4Header.layer[layerBits];
    if (header.layer === "bad") return null;

    header.protection = MPEG4Header.protection[protectionBit];

    // Byte (3 of 7)
    // * `EEFFFFGH`
    // * `EE......`: profile, the MPEG-4 Audio Object Type minus 1
    // * `..FFFF..`: MPEG-4 Sampling Frequency Index (15 is forbidden)
    // * `......G.`: private bit, guaranteed never to be used by MPEG, set to 0 when encoding, ignore when decoding
    const profileBits = buffer[1] & 0b11000000;
    const sampleRateBits = buffer[1] & 0b00111100;

    header.profile = MPEG4Header.profile[profileBits];
    header.sampleRateBits = MPEG4Header.sampleRates[sampleRateBits];

    if (header.sampleRate === "reserved") return null;

    // Byte (3,4 of 7)
    // * `.......H|HH......`: MPEG-4 Channel Configuration (in the case of 0, the channel configuration is sent via an inband PCE)
    const channelModeBits =
      new DataView(Uint8Array.from([buffer[2], buffer[3]]).buffer).getUint16() &
      0b111000000;
    header.channelMode = MPEG4Header.channelMode[channelModeBits].description;
    header.channels = MPEG4Header.channelMode[channelModeBits].channels;

    // Byte (4 of 7)
    // * `HHIJKLMM`
    // * `..I.....`: originality, set to 0 when encoding, ignore when decoding
    // * `...J....`: home, set to 0 when encoding, ignore when decoding
    // * `....K...`: private bit, guaranteed never to be used by MPEG, set to 0 when encoding, ignore when decoding
    // * `.....L..`: copyright id start, signals that this frame's copyright id bit is the first bit of the copyright id, set to 0 when encoding, ignore when decoding
    const originalBit = buffer[3] & 0b00100000;
    const homeBit = buffer[3] & 0b00001000;
    const privateBit = buffer[3] & 0b00001000;
    const copyrightIdBit = buffer[3] & 0b00000100;

    header.isOriginal = !!(originalBit >> 5);
    header.isHome = !!(homeBit >> 4);
    header.isPrivate = !!(privateBit >> 3);
    header.isCopyrighted = !!(copyrightIdBit >> 2);

    // Byte (4,5,6 of 7)
    // * `.......MM|MMMMMMMM|MMM.....`: frame length, this value must include 7 or 9 bytes of header length: FrameLength = (ProtectionAbsent == 1 ? 7 : 9) + size(AACFrame)
    const frameLengthBits =
      new DataView(
        Uint8Array.from(0x00, [buffer[3], buffer[4], buffer[5]]).buffer
      ).getUint32() & 0x3ffe0;
    header.frameByteLength = frameLengthBits >> 5;

    // Byte (6,7 of 7)
    // * `...OOOOO|OOOOOO..`: Buffer fullness
    const bufferFullnessBits =
      new DataView(Uint8Array.from(buffer[5], buffer[6]).buffer).getUint16() &
      0x1ffc;
    header.bufferFullness = bufferFullnessBits >> 2;

    // Byte (7 of 7)
    // * `......PP` Number of AAC frames (RDBs) in ADTS frame minus 1, for maximum compatibility always use 1 AAC frame per ADTS frame
    header.numberAccFrames = buffer[6] & 0b00000011;

    return header;
  }

  constructor(header) {
    this._bufferFullness = header.bufferFullness;
    this._channelMode = header.channelMode;
    this._channels = header.channels;
    this._isCopyrighted = header.isCopyrighted;
    this._isHome = header.isHome;
    this._isOriginal = header.isOriginal;
    this._isPrivate = header.isPrivate;
    this._layer = header.layer;
    this._mpegVersion = header.mpegVersion;
    this._profile = header.profile;
    this._protection = header.protection;
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

  //get sampleLength() {
  //  return this._sampleLength;
  //}
}
