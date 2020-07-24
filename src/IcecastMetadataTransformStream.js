const IcecastMetadataParser = require("./IcecastMetadataParser");
const { Transform } = require("stream");

class IcecastMetadataTransformStream extends Transform {
  constructor(params) {
    super();

    this.icecastMetadataParser = new IcecastMetadataParser(params);
    this._totalReadBytes = 0;
    this._icyBr = params.icyBr;
  }

  _getTotalTime() {
    return this._totalReadBytes / (this._icyBr * 125);
  }

  _transform(chunk, encoding, callback) {
    this.icecastMetadataParser.readBuffer(chunk, 0, this._getTotalTime());

    const stream = this.icecastMetadataParser.getStream();
    this._totalReadBytes += stream.length;

    callback(null, stream);
  }
}

module.exports = IcecastMetadataTransformStream;
