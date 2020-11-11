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
    return Uint8Array.from(boxes.flatMap((box) => [...box.contents]));
  }

  /**
   * @description Codec mapping for `esds` box
   * https://stackoverflow.com/questions/3987850/mp4-atom-how-to-discriminate-the-audio-codec-is-it-aac-or-mp3
   * 0x40 - MPEG-4 Audio
   * 0x6b - MPEG-1 Audio (MPEG-1 Layers 1, 2, and 3)
   * 0x69 - MPEG-2 Backward Compatible Audio (MPEG-2 Layers 1, 2, and 3)
   * 0x67 - MPEG-2 AAC LC
   */
  static esdsCodecs = {
    "audio/aac": 0x40,
    "audio/mpeg": 0x6b,
  };

  /**
   * @param {Header} header Codec header
   * @returns {Uint8Array} Filetype and Movie Box information for the codec
   */
  getMovieBox(header) {
    const channels = header.channels;
    const mimeType = header.mimeType;
    const sampleRate = Box.getUint32(header.sampleRate);

    const streamDescriptorTag = new ESTag(4, {
      /* prettier-ignore */
      contents: [
        FragmentedISOBMFFBuilder.esdsCodecs[mimeType],
        0x15, // stream type(6bits)=5 audio, flags(2bits)=1
        0x00,0x00,0x00, // 24bit buffer size
        0x00,0x00,0x00,0x00, // max bitrate
        0x00,0x00,0x00,0x00, // avg bitrate
      ],
    });

    const boxes = [
      new Box("ftyp", {
        /* prettier-ignore */
        contents: [0x69,0x73,0x6F,0x6D,0x00,0x00,0x02,0x00,
          0x69,0x73,0x6F,0x6D,0x69,0x73,0x6F,0x32,
          0x69,0x73,0x6F,0x36,0x6D,0x70,0x34,0x31],
      }),
      new Box("moov", {
        boxes: [
          new Box("mvhd", {
            /* prettier-ignore */
            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x03,0xe8,
              0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
              0x00,0x00,0x00,0x02],
          }),
          new Box("trak", {
            boxes: [
              new Box("tkhd", {
                /* prettier-ignore */
                contents: [0x00,0x00,0x00,0x03,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,
                  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                  0x00,0x00,0x00,0x01,0x01,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,
                  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,
                  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x40,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                  0x00,0x00,0x00,0x00],
              }),
              new Box("mdia", {
                boxes: [
                  new Box("mdhd", {
                    /* prettier-ignore */
                    contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                      0x00,0x00,0x00,0x00,
                      ...sampleRate,
                      0x00,0x00,0x00,0x00,0x55,0xc4,0x00,0x00],
                  }),
                  new Box("hdlr", {
                    /* prettier-ignore */
                    contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x73,0x6f,0x75,0x6e,0x00,0x00,0x00,0x00,
                      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x53,0x6f,0x75,0x6e,0x64,0x48,0x61,0x6e,
                      0x64,0x6c,0x65,0x72,0x00],
                  }),
                  new Box("minf", {
                    /* prettier-ignore */
                    contents: [0x00,0x00,0x00,0x10,0x73,0x6d,0x68,0x64,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                      0x00,0x00,0x00,0x24,0x64,0x69,0x6e,0x66,0x00,0x00,0x00,0x1c,0x64,0x72,0x65,0x66,
                      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x0c,0x75,0x72,0x6c,0x20,
                      0x00,0x00,0x00,0x01],
                    boxes: [
                      new Box("stbl", {
                        boxes: [
                          new Box("stsd", {
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01],
                            boxes: [
                              new Box("mp4a", {
                                /* prettier-ignore */
                                contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                                  0x00,channels, // channel count
                                  0x00,0x10, // PCM bitrate (16bit)
                                  0x00,0x00,
                                  ...sampleRate, // sample rate
                                  0x00,0x00],
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
                              }),
                            ],
                          }),
                          new Box("stts", {
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                          }),
                          new Box("stsc", {
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                          }),
                          new Box("stsz", {
                            /* prettier-ignore */
                            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                              0x00,0x00,0x00,0x00],
                          }),
                          new Box("stco", {
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
            /* prettier-ignore */
            contents: [0x00,0x00,0x00,0x20,0x74,0x72,0x65,0x78,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01,
              0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
          }),
          new Box("udta", {
            boxes: [
              new Box("meta", {
                /* prettier-ignore */
                contents: [0x00,0x00,0x00,0x00],
                boxes: [
                  new Box("hdlr", {
                    /* prettier-ignore */
                    contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x6d,0x64,0x69,0x72,0x61,0x70,0x70,0x6c,
                      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00],
                  }),
                  new Box("ilst", {
                    /* prettier-ignore */
                    contents: [0x00,0x00,0x00,0x25,0xa9,0x74,0x6f,0x6f,0x00,0x00,0x00,0x1d,0x64,0x61,0x74,0x61,
                      0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x00,0x4c,0x61,0x76,0x66,0x35,0x38,0x2e,0x32,
                      0x39,0x2e,0x31,0x30,0x30],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ];

    if (mimeType === "audio/aac") {
      streamDescriptorTag.addTag(
        new ESTag(5, {
          contents: [...header.audioSpecificConfig],
        })
      );
    }

    const contents = FragmentedISOBMFFBuilder.getBoxContents(boxes);

    this._moovLength = contents.length;

    return contents;
  }

  /**
   * @description Wraps codec frames into a Movie Fragment
   * @param {Array<Frame>} frames Frames to contain in this Movie Fragment
   * @returns {Uint8Array} Movie Fragment containing the frames
   */
  wrapFrames(frames) {
    const trun = new Box("trun", {
      /* prettier-ignore */
      contents: [
        0x00,0x00,0x02,0x01, //flags
        ...Box.getUint32(frames.length), // number of frames
        ...frames.flatMap((frame) => [...Box.getUint32(frame.data.length)]), // samples lengths per frame
      ],
    });

    const boxes = [
      new Box("moof", {
        boxes: [
          new Box("mfhd", {
            /* prettier-ignore */
            contents: [0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x01],
          }),
          new Box("traf", {
            boxes: [
              new Box("tfhd", {
                /* prettier-ignore */
                contents: [0x00,0x00,0x00,0x39,0x00,0x00,0x00,0x01,
                  0x00,0x00,0x00,0x00,
                  ...Box.getUint32(this._moovLength), // base data offset (length of moov box)
                  ...Box.getUint32(frames[0].header.sampleLength), // default sample duration
                  ...Box.getUint32(frames[0].data.length), // default sample size
                  0x02,0x00,0x00,0x00],
              }),
              new Box("tfdt", {
                /* prettier-ignore */
                contents: [0x01,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
                  0x00,0x00,0x00,0x00],
              }),
              trun,
            ],
          }),
        ],
      }),
      new Box("mdat", {
        contents: frames.flatMap((frame) => [...frame.data]),
      }),
    ];

    trun.insertBytes(Box.getUint32(boxes[0].length + 12), 8); // data offset (moof length + mdat length + mdat)

    return FragmentedISOBMFFBuilder.getBoxContents(boxes);
  }
}
