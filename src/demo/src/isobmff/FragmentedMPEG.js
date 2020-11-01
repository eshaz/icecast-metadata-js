import mp3parser from "mp3-parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._frames = [];
    this._partialFrame = new Uint8Array(0);
  }

  get header() {
    return FragmentedISOBMFFBuilder.mp3MovieBox;
  }

  getMp4(mpegData) {
    const newBuffer = new Uint8Array(
      this._partialFrame.length + mpegData.length
    );
    newBuffer.set(this._partialFrame);
    newBuffer.set(mpegData, this._partialFrame.length);

    const newBufferView = new DataView(newBuffer.buffer);

    // loop through the buffer until the
    // next index + current frame length is greater than buffer length

    let nextFrame = 0,
      offset = 0,
      frame;

    while (offset + nextFrame + 32 <= newBuffer.length) {
      frame = mp3parser.readFrame(newBufferView, offset);
      if (frame && frame._section.byteLength <= newBuffer.length) {
        nextFrame = frame._section.byteLength;
        this._frames.push(newBuffer.subarray(offset, offset + nextFrame));
        offset += nextFrame;
      } else {
        break;
      }
    }

    this._partialFrame = newBuffer.subarray(offset);

    if (this._frames.length > 1) {
      const fragments = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );
      console.log(this._partialFrame.length, this._frames.length);
      this._frames = [];
      return fragments;
    }
    return new Uint8Array(0);
  }
}
