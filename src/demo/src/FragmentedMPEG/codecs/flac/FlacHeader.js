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

/*
https://xiph.org/ogg/doc/framing.html

AAAAAAAA AAAAAABC DDDDEEEE FFFFGGGH 
(IIIIIIII...)
(JJJJJJJJ|JJJJJJJJ)
(KKKKKKKK|KKKKKKKK)
LLLLLLLLL

Flac Frame Header
Letter 	Length (bits) 	Description
A 	13 	11111111|11111
B   1   Reserved 0 - mandatory, 1 - reserved
C 	1 	Blocking strategy, 0 - fixed, 1 - variable
D 	4   Block size in inter-channel samples
E 	4 	Sample rate
F   4   Channel assignment
G   3   Sample size in bits
H   1   Reserved 0 - mandatory, 1 - reserved
I   ?   if(variable blocksize)
           <8-56>:"UTF-8" coded sample number (decoded number is 36 bits) [4]
        else
           <8-48>:"UTF-8" coded frame number (decoded number is 31 bits) [4]
J   ?   if(blocksize bits == 011x)
            8/16 bit (blocksize-1)
K   ?   if(sample rate bits == 11xx)
            8/16 bit sample rate
L   8   CRC-8 (polynomial = x^8 + x^2 + x^1 + x^0, initialized with 0) of everything before the crc, including the sync code
        
*/

import CodecHeader from "../CodecHeader";
import crc8 from "../../crc8";

export default class FlacHeader extends CodecHeader {
  static blockingStrategy = {
    0b00000000: "Fixed",
    0b00000001: "Variable",
  };

  static blockSize = {
    0b00000000: "reserved",
    0b00010000: 192,
    0b00100000: 576,
    0b00110000: 1152,
    0b01000000: 2304,
    0b01010000: 4608,
    0b01100000: "8-bit (blocksize-1) end of header",
    0b01110000: "16-bit (blocksize-1) end of header",
    0b10000000: 256,
    0b10010000: 512,
    0b10100000: 1024,
    0b10110000: 2048,
    0b11000000: 4096,
    0b11010000: 8192,
    0b11100000: 16384,
    0b11110000: 32768,
  };

  static sampleRate = {
    0b00000000: "invalid", // (unsupported) get from STREAMINFO metadata block
    0b00000001: 88200,
    0b00000010: 176400,
    0b00000011: 192000,
    0b00000100: 8000,
    0b00000101: 16000,
    0b00000110: 22050,
    0b00000111: 24000,
    0b00001000: 32000,
    0b00001001: 44100,
    0b00001010: 48000,
    0b00001011: 96000,
    0b00001100: "get 8 bit sample rate (in kHz) from end of header",
    0b00001101: "get 16 bit sample rate (in Hz) from end of header",
    0b00001110: "get 16 bit sample rate (in tens of Hz) from end of header",
    0b00001111: "invalid",
  };

  /* prettier-ignore */
  static channelAssignment = {
    0b00000000: {channels: 1, description: "mono"},
    0b00010000: {channels: 2, description: "left, right"},
    0b00100000: {channels: 3, description: "left, right, center"},
    0b00110000: {channels: 4, description: "front left, front right, back left, back right"},
    0b01000000: {channels: 5, description: "front left, front right, front center, back/surround left, back/surround right"},
    0b01010000: {channels: 6, description: "front left, front right, front center, LFE, back/surround left, back/surround right"},
    0b01100000: {channels: 7, description: "front left, front right, front center, LFE, back center, side left, side right"},
    0b01110000: {channels: 8, description: "front left, front right, front center, LFE, back left, back right, side left, side right"},
    0b10000000: {channels: 2, description: "left/side stereo: channel 0 is the left channel, channel 1 is the side(difference) channel"},
    0b10010000: {channels: 2, description: "right/side stereo: channel 0 is the side(difference) channel, channel 1 is the right channel"},
    0b10100000: {channels: 2, description: "mid/side stereo: channel 0 is the mid(average) channel, channel 1 is the side(difference) channel"},
    0b10110000: "reserved",
    0b11000000: "reserved",
    0b11010000: "reserved",
    0b11100000: "reserved",
    0b11110000: "reserved",
  }

  static sampleSize = {
    0b00000000: "get from STREAMINFO metadata block",
    0b00000010: 8,
    0b00000100: 12,
    0b00000110: "reserved",
    0b00001000: 16,
    0b00001010: 20,
    0b00001100: 24,
    0b00001110: "reserved",
  };

  static decodeUTF8Int(data) {
    if (data[0] < 0x80) return { value: data[0], next: 1 };

    // invalid
    if (data === 0xff) return null;

    let next = 2,
      mask = 0xe0,
      value;

    // determine length of utf-8 character
    while ((data[0] & mask) !== ((mask << 1) & 0xff)) {
      next++;
      mask |= mask >> 1;
    }

    if (data.length < next) return null; // not enough data

    const offset = (next - 1) * 6;

    // set value for the remaining bits in the length character
    value = data[0] & ((mask ^ 0xff) << offset);

    // set the remaining values
    for (let idx = 1; idx < next; idx++) {
      value |= (data[idx] & 0x3f) << (offset - 6 * idx);
    }

    return { value, next };
  }

  static getHeader(buffer) {
    // Must be at least 6 bytes.
    if (buffer.length < 6) return null;

    // Bytes (1-2 of 6)
    // Frame sync: `11111111|111111..|`:
    if (buffer[0] !== 0xff || buffer[1] > 0xfc) {
      return null;
    }

    const header = {};
    header.length = 5;

    // Byte (2 of 6)
    // * `......B.`: Reserved 0 - mandatory, 1 - reserved
    // * `.......C`: Blocking strategy, 0 - fixed, 1 - variable
    if (buffer[1] & 0b00000010) return null;
    const blockingStrategyBits = buffer[1] & 0b00000001;

    header.blockingStrategy = FlacHeader.blockingStrategy[blockingStrategyBits];

    // Byte (3 of 6)
    // * `DDDD....`: Block size in inter-channel samples
    // * `....EEEE`: Sample rate
    const blockSizeBits = buffer[2] & 0b11110000;
    const sampleRateBits = buffer[2] & 0b00001111;

    header.blockSize = FlacHeader.blockSize[blockSizeBits];
    if (header.blockSize === "reserved") return null;

    header.sampleRate = FlacHeader.sampleRate[sampleRateBits];
    if (header.sampleRate === "invalid") return null;

    // Byte (4 of 6)
    // * `FFFF....`: Channel assignment
    // * `....GGG.`: Sample size in bits
    // * `.......H`: Reserved 0 - mandatory, 1 - reserved
    if (buffer[3] & 0b00000001) return null;
    const channelAssignmentBits = buffer[3] & 0b11110000;
    const sampleSizeBits = buffer[3] & 0b00001110;

    const channelAssignment =
      FlacHeader.channelAssignment[channelAssignmentBits];
    if (channelAssignment === "reserved") return null;

    header.channels = channelAssignment.channels;
    header.channelMode = channelAssignment.description;

    header.sampleSize = FlacHeader.sampleSize[sampleSizeBits];
    if (header.sampleSize === "reserved") return null;

    // Byte (5...)
    // * `IIIIIIII|...`: VBR block size ? sample number : frame number
    const decodedUtf8 = FlacHeader.decodeUTF8Int(buffer.subarray(4));
    if (!decodedUtf8) return null;

    if (blockingStrategyBits) {
      header.sampleNumber = decodedUtf8.value;
    } else {
      header.frameNumber = decodedUtf8.value;
    }

    header.length += decodedUtf8.next;

    // Byte (...)
    // * `JJJJJJJJ|(JJJJJJJJ)`: Blocksize (8/16bit custom value)
    if (typeof header.blockSize === "string") {
      if (blockSizeBits === 0b01100000) {
        // 8 bit
        if (buffer.length < header.length) return null; // out of data
        header.blockSize = buffer[header.length - 1] - 1;
        header.length += 1;
      } else if (blockSizeBits === 0b01110000) {
        // 16 bit
        if (buffer.length <= header.length) return null; // out of data
        header.blockSize =
          (buffer[header.length - 1] << 8) + buffer[header.length] - 1;
        header.length += 2;
      }
    }

    // Byte (...)
    // * `KKKKKKKK|(KKKKKKKK)`: Sample rate (8/16bit custom value)
    if (typeof header.sampleRate === "string") {
      if (sampleRateBits === 0b00001100) {
        // 8 bit
        if (buffer.length < header.length) return null; // out of data
        header.sampleRate = buffer[header.length - 1] - 1;
        header.length += 1;
      } else if (sampleRateBits === 0b00001101) {
        // 16 bit
        if (buffer.length <= header.length) return null; // out of data
        header.sampleRate =
          (buffer[header.length - 1] << 8) + buffer[header.length] - 1;
        header.length += 2;
      } else if (sampleRateBits === 0b00001110) {
        // 16 bit
        if (buffer.length <= header.length) return null; // out of data
        header.sampleRate =
          (buffer[header.length - 1] << 8) + buffer[header.length] - 1;
        header.length += 2;
      }
    }

    // Byte (...)
    // * `LLLLLLLL`: CRC-8
    if (buffer.length < header.length) return null; // out of data

    header.crc = buffer[header.length - 1];
    if (header.crc !== crc8(buffer.subarray(0, header.length - 1))) {
      console.error("flac crc failure");
      return null;
    }

    return new FlacHeader(header);
  }

  /**
   * @private
   * Call FlacHeader.getHeader(Array<Uint8>) to get instance
   */
  constructor(header) {
    super(header);
    this._blockingStrategy = header.blockingStrategy;
    this._blockSize = header.blockSize;
    this._crc = header.crc;
    this._frameNumber = header.frameNumber;
    this._mimeType = "audio/flac";
    this._sampleSize = header.sampleSize;
    this._sampleNumber = header.sampleNumber;
  }
}
