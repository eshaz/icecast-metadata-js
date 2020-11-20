import CodecParser from "../CodecParser";
import MPEGFrame from "./MPEGFrame";

export default class MPEGParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 4;
  }

  parseFrames(data) {
    return this.fixedLengthFrame(MPEGFrame, data);
  }
}
