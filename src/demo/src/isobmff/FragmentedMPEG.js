import mp3parser from "mp3-parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._buffer = new Uint8Array(0);
  }

  get header() {
    return FragmentedISOBMFFBuilder.mp3MovieBox;
  }

  getMp4(mpegFrames) {
    const newBuffer = new Uint8Array(this._buffer.length + mpegFrames.length);
    newBuffer.set(this._buffer);
    newBuffer.set(mpegFrames, this._buffer.length);

    const newBufferView = new DataView(newBuffer.buffer);

    let frames = [];
    let offset = 0;

    while (offset < newBuffer.length) {
      try {
        const frame = mp3parser.readFrame(newBufferView, offset, true);
        if (!frame) break;
        frames.push(frame);
        offset = frame._section.nextFrameIndex;
      } catch (e) {
        break;
      }
    }

    if (frames.length > 1) {
      this._buffer = newBuffer.subarray(offset);

      return FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        frames.map((frame) => frame._section.byteLength),
        newBuffer.subarray(0, offset)
      );
    } else {
      this._buffer = newBuffer;
      return new Uint8Array(0);
    }
  }
}
