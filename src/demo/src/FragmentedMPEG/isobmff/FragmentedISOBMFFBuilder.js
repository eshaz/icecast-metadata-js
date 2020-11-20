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

import Box from "./Box";
import ESTag from "./ESTag";

/**
 * @description Fragmented ISO Base Media File Format Builder is a class to
 * wrap codec frames in a MP4 container for streaming MP3 / AAC compatibility in Firefox.
 */
export default class FragmentedISOBMFFBuilder {
  static getBoxContents(boxes) {
    return Uint8Array.from(
      boxes.reduce((acc, box) => acc.concat(box.contents), [])
    );
  }

  /**
   * @description Codec mapping for `esds` box
   * https://stackoverflow.com/questions/3987850/mp4-atom-how-to-discriminate-the-audio-codec-is-it-aac-or-mp3
   * 0x40 - MPEG-4 Audio
   * 0x6b - MPEG-1 Audio (MPEG-1 Layers 1, 2, and 3)
   * 0x69 - MPEG-2 Backward Compatible Audio (MPEG-2 Layers 1, 2, and 3)
   * 0x67 - MPEG-2 AAC LC
   */
  static mp4aEsdsCodecs = {
    "audio/aac": 0x40,
    "audio/mpeg": 0x6b,
  };

  getFlaC(header) {
    // https://github.com/xiph/flac/blob/master/doc/isoflac.txt
    return new Box("fLaC", {
      /* prettier-ignore */
      contents: [
        0x00,0x00,0x00,0x00,0x00,0x00, // reserved
        0x00,0x01, // data reference index
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00, // reserved
        0x00,header.channels, // channel count
        0x00,header.sampleSize, // PCM bitrate (16bit)
        0x00,0x00, // predefined
        0x00,0x00, // reserved
        ...Box.getUint16(header.sampleRate),0x00,0x00, // sample rate 16.16 fixed-point
        /*
        When the bitstream's native sample rate is greater
        than the maximum expressible value of 65535 Hz,
        the samplerate field shall hold the greatest
        expressible regular division of that rate. I.e.
        the samplerate field shall hold 48000.0 for
        native sample rates of 96 and 192 kHz. In the
        case of unusual sample rates which do not have
        an expressible regular division, the maximum value
        of 65535.0 Hz should be used.
        */
      ],
      boxes: [
        new Box("dfLa", {
          /* prettier-ignore */
          contents: [0x00, // version
            0x00,0x00,0x00, // flags
            // * `A........` Last metadata block flag
            // * `.BBBBBBBB` BlockType
            0x80, // last metadata block, stream info
            0x00,0x00,0x22, // Length
            ...Box.getUint16(header.blockSize), // maximum block size
            ...Box.getUint16(header.blockSize), // minimum block size
            0x00,0x00,0x00, // maximum frame size
            0x00,0x00,0x00, // minimum frame size
            ...Box.getUint32((header.sampleRate << 12) | (header.channels << 8) | ((header.sampleSize - 1) << 4)), // 20bits sample rate, 3bits channels, 5bits samplesize - 1
            0x00,0x00,0x00,0x00, // total samples
            0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00 // md5 of stream
          ],
        }),
      ],
    });
  }

  getMp4a(header) {
    const streamDescriptorTag = new ESTag(4, {
      /* prettier-ignore */
      contents: [
        FragmentedISOBMFFBuilder.mp4aEsdsCodecs[header.mimeType],
        0x15, // stream type(6bits)=5 audio, flags(2bits)=1
        0x00,0x00,0x00, // 24bit buffer size
        0x00,0x00,0x00,0x00, // max bitrate
        0x00,0x00,0x00,0x00, // avg bitrate
      ],
    });

    if (header.mimeType === "audio/aac") {
      streamDescriptorTag.addTag(
        new ESTag(5, {
          contents: [...header.audioSpecificConfig],
        })
      );
    }

    return new Box("mp4a", {
      /* prettier-ignore */
      contents: [0x00,0x00,0x00,0x00,0x00,0x00, // reserved
        0x00,0x01, // data reference index
        0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00, // reserved
        0x00,header.channels, // channel count
        0x00,0x10, // PCM bitrate (16bit)
        0x00,0x00, // Compression ID
        0x00,0x00, // Packet size
        ...Box.getUint16(header.sampleRate),0x00,0x00], // sample rate unsigned floating point
      boxes: [
        new Box("esds", {
          contents: [0x00, 0x00, 0x00, 0x00],
          boxes: [
            new ESTag(3, {
              contents: [
                0x00,
                0x01, // ES_ID = 1
                0x00, // flags etc = 0
              ],
              tags: [
                streamDescriptorTag,
                new ESTag(6, {
                  contents: [0x02],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  }

  /**
   * @param {Header} header Codec header
   * @returns {Uint8Array} Filetype and Movie Box information for the codec
   */
  getMovieBox(header) {
    const sampleRate = Box.getUint32(header.sampleRate);
    const codecBox =
      header.mimeType === "audio/flac"
        ? this.getFlaC(header)
        : this.getMp4a(header);

    const boxes = [
      new Box("ftyp", {
        /* prettier-ignore */
        contents: [...Box.stringToByteArray("iso5"), // major brand
          0x00,0x00,0x02,0x00, // minor version
          ...Box.stringToByteArray("iso6mp41")], // compatible brands
      }),
      new Box("moov", {
        boxes: [
          new Box("mvhd", {
            /* prettier-ignore */
            contents: [0x00, // version
              0x00,0x00,0x00, // flags
              0x00,0x00,0x00,0x00, // creation time
              0x00,0x00,0x00,0x00, // modification time
              0x00,0x00,0x03,0xe8, // timescale
              0x00,0x00,0x00,0x00, // duration
              0x00,0x01,0x00,0x00, // rate
              0x01,0x00, // volume
              0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00, // reserved
              0x00,0x01,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, // a b u (matrix structure)
              0x00,0x00,0x00,0x00, 0x00,0x01,0x00,0x00, 0x00,0x00,0x00,0x00, // c d v
              0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x40,0x00,0x00,0x00, // x y w
              0x00,0x00,0x00,0x00, // preview time
              0x00,0x00,0x00,0x00, // preview duration
              0x00,0x00,0x00,0x00, // poster time
              0x00,0x00,0x00,0x00, // selection time
              0x00,0x00,0x00,0x00, // selection duration
              0x00,0x00,0x00,0x00, // current time
              0x00,0x00,0x00,0x02], // next track
          }),
          new Box("trak", {
            boxes: [
              new Box("tkhd", {
                /* prettier-ignore */
                contents: [0x00, // version
                  0x00,0x00,0x03, // flags (0x01 - track enabled, 0x02 - track in movie, 0x04 - track in preview, 0x08 - track in poster)
                  0x00,0x00,0x00,0x00, // creation time
                  0x00,0x00,0x00,0x00, // modification time
                  0x00,0x00,0x00,0x01, // track id
                  0x00,0x00,0x00,0x00, // reserved
                  0x00,0x00,0x00,0x00, // duration
                  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00, // reserved
                  0x00,0x00, // layer
                  0x00,0x01, // alternate group
                  0x01,0x00, // volume
                  0x00,0x00, // reserved
                  0x00,0x01,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, // a b u (matrix structure)
                  0x00,0x00,0x00,0x00, 0x00,0x01,0x00,0x00, 0x00,0x00,0x00,0x00, // c d v 
                  0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x40,0x00,0x00,0x00, // x y w
                  0x00,0x00,0x00,0x00, // track width
                  0x00,0x00,0x00,0x00], // track height
              }),
              new Box("mdia", {
                boxes: [
                  new Box("mdhd", {
                    /* prettier-ignore */
                    contents: [0x00, // version
                      0x00,0x00,0x00, // flags
                      0x00,0x00,0x00,0x00, // creation time (in seconds since midnight, January 1, 1904)
                      0x00,0x00,0x00,0x00, // modification time
                      ...sampleRate, // time scale
                      0x00,0x00,0x00,0x00, // duration
                      0x55,0xc4, // language
                      0x00,0x00], // quality
                  }),
                  new Box("hdlr", {
                    /* prettier-ignore */
                    contents: [0x00, // version
                      0x00,0x00,0x00, // flags
                      ...Box.stringToByteArray('mhlr'), // component type (mhlr, dhlr)
                      ...Box.stringToByteArray('soun'), // component subtype (vide' for video data, 'soun' for sound data or ‘subt’ for subtitles)
                      0x00,0x00,0x00,0x00, // component manufacturer
                      0x00,0x00,0x00,0x00, // component flags
                      0x00,0x00,0x00,0x00, // component flags mask
                      0x00], // String that specifies the name of the component, ended by a null character
                  }),
                  new Box("minf", {
                    boxes: [
                      new Box("stbl", {
                        boxes: [
                          new Box("stsd", {
                            // Sample description atom
                            /* prettier-ignore */
                            contents: [0x00, // version
                              0x00,0x00,0x00, // flags
                              0x00,0x00,0x00,0x01], // entry count
                            boxes: [codecBox],
                          }),
                          new Box("stts", {
                            // Time-to-sample atom
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                          }),
                          new Box("stsc", {
                            // Sample-to-chunk atom
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                          }),
                          new Box("stsz", {
                            // Sample Size atom
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                              0x00,0x00,0x00,0x00],
                          }),
                          new Box("stco", {
                            // Chunk Offset atom
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
          new Box("mvex", {
            boxes: [
              new Box("trex", {
                /* prettier-ignore */
                contents: [0x00,0x00,0x00,0x00, // flags
                  0x00,0x00,0x00,0x01, // track id
                  0x00,0x00,0x00,0x01, // default_sample_description_index
                  0x00,0x00,0x00,0x00, // default_sample_duration
                  0x00,0x00,0x00,0x00, // default_sample_size;
                  0x00,0x00,0x00,0x00], // default_sample_flags;
              }),
            ],
          }),
        ],
      }),
    ];

    return FragmentedISOBMFFBuilder.getBoxContents(boxes);
  }

  static getMediaDataBox(frames) {
    let offset = 8;
    const framesLength =
      frames.reduce((acc, { data }) => acc + data.length, 0) + offset;

    const frameData = new Uint8Array(framesLength);
    frameData.set([
      ...Box.getUint32(framesLength),
      ...Box.stringToByteArray("mdat"),
    ]);

    for (const { data } of frames) {
      frameData.set(data, offset);
      offset += data.length;
    }

    return frameData;
  }

  /**
   * @description Wraps codec frames into a Movie Fragment
   * @param {Array<Frame>} frames Frames to contain in this Movie Fragment
   * @returns {Uint8Array} Movie Fragment containing the frames
   */
  wrapFrames(frames) {
    const trun = new Box("trun", {
      /* prettier-ignore */
      contents: [0x00, // version
        0x00,0x02,0x01, // flags
        // * `ABCD|00000E0F`
        // * `A...|........` sample‐composition‐time‐offsets‐present
        // * `.B..|........` sample‐flags‐present
        // * `..C.|........` sample‐size‐present
        // * `...D|........` sample‐duration‐present
        // * `....|.....E..` first‐sample‐flags‐present
        // * `....|.......G` data-offset-present
        ...Box.getUint32(frames.length), // number of samples
        ...frames.flatMap(({data}) => [...Box.getUint32(data.length)]), // samples lengths per frame
      ],
    });

    const boxes = [
      new Box("moof", {
        boxes: [
          new Box("mfhd", {
            /* prettier-ignore */
            contents: [0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x00], // sequence number
          }),
          new Box("traf", {
            boxes: [
              new Box("tfhd", {
                /* prettier-ignore */
                contents: [0x00, // version
                  0x02,0x00,0x08, // flags
                  // * `AB|00000000|00CDE0FG`
                  // * `A.|........|........` default-base-is-moof
                  // * `.B|........|........` duration-is-empty
                  // * `..|........|..C.....` default-sample-flags-present
                  // * `..|........|...D....` default-sample-size-present
                  // * `..|........|....E...` default-sample-duration-present
                  // * `..|........|......F.` sample-description-index-present
                  // * `..|........|.......G` base-data-offset-present
                  0x00,0x00,0x00,0x01, // track id
                  ...Box.getUint32(frames[0].header.sampleLength), // default sample duration
                ],
              }),
              new Box("tfdt", {
                /* prettier-ignore */
                contents: [0x00, // version
                  0x00,0x00,0x00, // flags
                  0x00,0x00,0x00,0x00], // base media decode time
              }),
              trun,
            ],
          }),
        ],
      }),
    ];

    trun.insertBytes([...Box.getUint32(boxes[0].length + 12)], 8); // data offset (moof length + mdat length + mdat)

    const moof = FragmentedISOBMFFBuilder.getBoxContents(boxes);
    const mdat = FragmentedISOBMFFBuilder.getMediaDataBox(frames);

    const fragment = new Uint8Array(moof.length + mdat.length);
    fragment.set(moof);
    fragment.set(mdat, moof.length);

    return fragment;
  }
}
