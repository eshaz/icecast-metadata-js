// import mp3parser from "mp3-parser";
import MP3Parser from "./MP3Parser";
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

    let { offset, frame } = MP3Parser.readFrame(newBuffer);

    while (frame && frame.isComplete) {
      this._frames.push(frame.data);
      offset += frame.data.length;
      frame = MP3Parser.readFrame(newBuffer, offset).frame;
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
