import CodecParser from "../CodecParser";
import FlacFrame from "../flac/FlacFrame";

export default class FlacParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 26;
  }

  parseFrames(data) {
    return this.variableLengthFrame(FlacFrame, data);
  }
}
