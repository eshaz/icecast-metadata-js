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

AAAAAAAA AAAAAAAA AAAAAAAA AAAAAAAA BBBBBBBB 00000CDE

(LSB)                                                             (MSB)
FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF FFFFFFFF
GGGGGGGG GGGGGGGG GGGGGGGG GGGGGGGG
HHHHHHHH HHHHHHHH HHHHHHHH HHHHHHHH
IIIIIIII IIIIIIII IIIIIIII IIIIIIII

JJJJJJJJ
LLLLLLLL...

OGG Page Header
Letter 	Length (bits) 	Description
A 	32 	0x4f676753, "OggS"
B 	8 	stream_structure_version
C 	1 	(0 no, 1 yes) continued packet
D 	1 	(0 no, 1 yes) first page of logical bitstream (bos)
E 	1 	(0 no, 1 yes) last page of logical bitstream (eos)

F 	64 	absolute granule position
        Sample Count??
G   32  stream serial number
H   32  page sequence no
I   32  page checksum
J   8   Number of page segments in the segment table
L   n   Segment table (n=page_segments+26).
        Segment table values sum to the total length of the packet.
        Last value is always < 0xFF. Last lacing value will be 0x00 if evenly divisible by 0xFF.
        
*/

import CodecHeader from "../CodecHeader";

export default class OGGPageHeader extends CodecHeader {
  static OggS = 0x4f676753;

  static getHeader(buffer) {
    // Must be at least 28 bytes.
    if (buffer.length < 28) return null;

    let headerBytes = [];
    for (let i = 0; i < 28; i++) {
      headerBytes.push(buffer[i]);
    }
    const view = new DataView(Uint8Array.from(headerBytes).buffer);

    // Bytes (1-4 of 28)
    // Frame sync (must equal OggS): `AAAAAAAA|AAAAAAAA|AAAAAAAA|AAAAAAAA`:
    if (view.getUint32(0) !== OGGPageHeader.OggS) {
      return null;
    }

    const header = {};

    // Byte (5 of 28)
    // * `BBBBBBBB`: stream_structure_version
    header.streamStructureVersion = buffer[4];

    // Byte (6 of 28)
    // * `00000CDE`
    // * `00000...`: All zeros
    // * `.....C..`: (0 no, 1 yes) continued packet
    // * `......D.`: (0 no, 1 yes) first page of logical bitstream (bos)
    // * `.......E`: (0 no, 1 yes) last page of logical bitstream (eos)
    const zeros = buffer[5] & 0b11111000;
    const continuePacketBit = buffer[5] & 0b00000100;
    const firstPageBit = buffer[5] & 0b00000010;
    const lastPageBit = buffer[5] & 0b00000001;

    if (zeros) return null;
    header.isContinuedPacket = !!(continuePacketBit >> 2);
    header.isFirstPage = !!(firstPageBit >> 1);
    header.isLastPage = !!lastPageBit;

    // Byte (7-14 of 28)
    // * `FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF|FFFFFFFF`
    // * Absolute Granule Position
    header.absoluteGranulePosition = view.getBigInt64(6, true);

    // Byte (15-18 of 28)
    // * `GGGGGGGG|GGGGGGGG|GGGGGGGG|GGGGGGGG`
    // * Stream Serial Number
    header.streamSerialNumber = view.getInt32(14, true);

    // Byte (19-22 of 28)
    // * `HHHHHHHH|HHHHHHHH|HHHHHHHH|HHHHHHHH`
    // * Page Sequence Number
    header.pageSequenceNumber = view.getInt32(18, true);

    // Byte (23-26 of 28)
    // * `IIIIIIII|IIIIIIII|IIIIIIII|IIIIIIII`
    // * Page Checksum
    header.pageChecksum = view.getInt32(22, true);

    // Byte (27 of 28)
    // * `JJJJJJJJ`: Number of page segments in the segment table
    header.numberPageSegments = buffer[26];
    header.length = header.numberPageSegments + 27;

    if (header.length > buffer.length) return null;

    header.dataByteLength = 0;
    for (let i = 0; i < header.numberPageSegments; i++) {
      header.dataByteLength += buffer[i + 27];
    }

    return new OGGPageHeader(header);
  }

  /**
   * @private
   * Call OGGPageHeader.getHeader(Array<Uint8>) to get instance
   */
  constructor(header) {
    super(header);
    this._absoluteGranulePosition = header.absoluteGranulePosition;
    this._isContinuedPacket = header.isContinuedPacket;
    this._isFirstPage = header.isFirstPage;
    this._isLastPage = header.isLastPage;
    this._numberPageSegments = header.numberPageSegments;
    this._pageSequenceNumber = header.pageSequenceNumber;
    this._pageChecksum = header.pageChecksum;
    this._streamSerialNumber = header.streamSerialNumber;
  }

  get absoluteGranulePosition() {
    return this._absoluteGranulePosition;
  }
}
