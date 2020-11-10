import Box from "./Box";
import ISOBMFFObject from "./ISOBMFFObject";

class Tag extends ISOBMFFObject {
  constructor(tagNumber, { contents = [], tags = [] } = {}) {
    super(tagNumber, { contents, objects: tags });
    this.lengthSize = 1;
  }

  get contents() {
    const contents = super.contents;

    /* prettier-ignore */
    return Uint8Array.from([
      this._name,
      0x80,0x80,0x80,
      contents.length,
      ...contents,
    ]);
  }

  addTag(tag) {
    this._objects.push(tag);
  }
}

export default class ElementaryStreamDescriptor extends Box {
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

  static getStreamDescriptorTag(header) {
    const streamDescriptorTag = new Tag(4, {
      /* prettier-ignore */
      contents: [
        ElementaryStreamDescriptor.codecs[header.mimeType],
        0x15, // stream type(6bits)=5 audio, flags(2bits)=1
        0x00,0x00,0x00, // 24bit buffer size
        0x00,0x00,0xf8,0xfa, // max bitrate
        0x00,0x00,0x00,0x00, // avg bitrate
      ],
    });

    if (header.audioSpecificConfig) {
      streamDescriptorTag.addTag(
        new Tag(5, {
          contents: [...header.audioSpecificConfig],
        })
      );
    }

    return streamDescriptorTag;
  }

  constructor(header) {
    super("esds", {
      contents: [0x00, 0x00, 0x00, 0x00],
      boxes: [
        new Tag(3, {
          contents: [
            0x00,
            0x01, // ES_ID = 1
            0x00, // flags etc = 0
          ],
          tags: [
            ElementaryStreamDescriptor.getStreamDescriptorTag(header),
            new Tag(6, {
              contents: [0x02],
            }),
          ],
        }),
      ],
    });
  }
}
