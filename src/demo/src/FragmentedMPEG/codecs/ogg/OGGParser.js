import CodecParser from "../CodecParser";
import OGGPage from "./OGGPage";
import FlacFrame from "../flac/FlacFrame";

export default class OGGParser extends CodecParser {
  constructor() {
    super();
    this._maxHeaderLength = 283;
    this._codec = null;
  }

  setCodec(oggPage) {
    // FLAC
    if (oggPage.data[0] === 0x7F &&
      oggPage.data[1] === 0x46 &&
      oggPage.data[2] === 0x4c &&
      oggPage.data[3] === 0x41 &&
      oggPage.data[4] === 0x43) {
        this._codec = 'audio/flac';
        this._frameClass = FlacFrame;
        this._maxHeaderLength = 309;
      }
  }

  parseFrames(data) {
    const oggPages = this.fixedLengthFrame(OGGPage, data);

    if (!this._codec && oggPages.frames.length) this.setCodec(oggPages.frames[0]);
    
    const frames = oggPages.frames.flatMap(
      ({ data }) => this.variableLengthFrame(this._frameClass, data, true).frames
    );

    return { frames, remainingData: oggPages.remainingData };
  }
}
