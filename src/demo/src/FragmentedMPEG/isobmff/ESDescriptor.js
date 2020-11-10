import Box from "./Box";
import ESTag from "./ESTag";

export default class ESDescriptor extends Box {
  // https://stackoverflow.com/questions/3987850/mp4-atom-how-to-discriminate-the-audio-codec-is-it-aac-or-mp3
  /*
  0x40 - MPEG-4 Audio
  0x6b - MPEG-1 Audio (MPEG-1 Layers 1, 2, and 3)
  0x69 - MPEG-2 Backward Compatible Audio (MPEG-2 Layers 1, 2, and 3)
  0x67 - MPEG-2 AAC LC
  */
  static codecs = {
    "audio/aac": 0x40,
    "audio/mpeg": 0x6b,
  };

  constructor(header) {
    super("esds", {
      contents: [0x00, 0x00, 0x00, 0x00],
    });

    const descriptorTag = new ESTag(4, {
      /* prettier-ignore */
      contents: [
        ESDescriptor.codecs[header.mimeType],
        0x15, // stream type(6bits)=5 audio, flags(2bits)=1
        0x00,0x00,0x00, // 24bit buffer size
        0x00,0x00,0x00,0x00, // max bitrate
        0x00,0x00,0x00,0x00, // avg bitrate
      ],
    });

    if (header.audioSpecificConfig) {
      descriptorTag.addTag(
        new ESTag(5, {
          contents: [...header.audioSpecificConfig],
        })
      );
    }

    this.addObject(
      new ESTag(3, {
        contents: [
          0x00,
          0x01, // ES_ID = 1
          0x00, // flags etc = 0
        ],
        tags: [
          descriptorTag,
          new ESTag(6, {
            contents: [0x02],
          }),
        ],
      })
    );
  }
}
