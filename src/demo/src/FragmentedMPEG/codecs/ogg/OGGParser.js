import CodecParser from "../CodecParser";
import OGGPage from "./OGGPage";
import FlacFrame from "../flac/FlacFrame";

export default class OGGParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 309; // flac 26, ogg 283
  }

  parseFrames(data) {
    const oggPages = this.fixedLengthFrame(OGGPage, data);

    const frames = oggPages.frames.flatMap(
      ({ data }) => this.variableLengthFrame(FlacFrame, data, 0, true).frames
    );

    return { frames, remainingData: oggPages.remainingData };
  }
}
