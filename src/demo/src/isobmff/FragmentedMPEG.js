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
    let offset = 0;

    try {
      for (
        let frame = mp3parser.readFrame(newBufferView, offset, true);
        frame;
        frame = mp3parser.readFrame(newBufferView, offset, true)
      ) {
        const nextFrame = frame._section.nextFrameIndex;
        this._frames.push(newBuffer.subarray(offset, nextFrame));
        offset = nextFrame;
      }
    } catch {}

    this._partialFrame = newBuffer.subarray(offset);

    //console.log(this._partialFrame.length, this._frames.length)

    if (this._frames.length > 1) {
      const fragments = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );
      this._frames = [];
      return fragments;
    }
    return new Uint8Array(0);
  }
}
