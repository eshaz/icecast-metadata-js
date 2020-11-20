import CodecParser from "../CodecParser";
import AACFrame from "./AACFrame";

export default class AACParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 9;
  }

  parseFrames(data) {
    return this.fixedLengthFrame(AACFrame, data);
  }
}
