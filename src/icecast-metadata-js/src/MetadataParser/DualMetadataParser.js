const IcyMetadataParser = require("./IcyMetadataParser");
const OggMetadataParser = require("./OggMetadataParser");

class DualMetadataParser {
  constructor(rest) {
    this._oggMetadataParser = new OggMetadataParser(rest);
    this._icyMetadataParser = new IcyMetadataParser({
      ...rest,
      onStream: undefined,
    });
  }

  *iterator(chunk) {
    for (const value of this._icyMetadataParser.iterator(chunk)) {
      if (value.stream) {
        yield* this._oggMetadataParser.iterator(value.stream);
      } else {
        yield value;
      }
    }
  }

  readAll(chunk) {
    for (const value of this._icyMetadataParser.iterator(chunk)) {
      if (value.stream) {
        this._oggMetadataParser.readAll(value.stream);
      }
    }
  }

  async *asyncIterator(chunk) {
    for await (const value of this._icyMetadataParser.asyncIterator(chunk)) {
      if (value.stream) {
        yield* this._oggMetadataParser.asyncIterator(value.stream);
      } else {
        yield value;
      }
    }
  }

  async asyncReadAll(chunk) {
    for await (const value of this._icyMetadataParser.iterator(chunk)) {
      if (value.stream) {
        await this._oggMetadataParser.asyncReadAll(value.stream);
      }
    }
  }
}

module.exports = DualMetadataParser;
