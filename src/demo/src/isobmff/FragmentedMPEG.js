// import mp3parser from "mp3-parser";
import MP3Parser from "./MP3Parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._frames = [];
    this._totalLength = 0;
    this._partialFrame = new Uint8Array(0);
  }

  getHeader(sampleRate = 44100) {
    return FragmentedISOBMFFBuilder.getMp3MovieBox({ sampleRate });
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
      this._totalLength += frame.data.length;
      frame = MP3Parser.readFrame(newBuffer, offset).frame;
    }

    this._partialFrame = newBuffer.subarray(offset);

    // Allow for +-511 bytes for bit reservoir
    if (this._frames.length > 1 && this._totalLength > 1022) {
      //console.log(this._frames)
      const fragments = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );
      //console.log(this._partialFrame.length, this._frames.length);
      this._frames = [];
      this._totalLength = 0;
      return fragments;
    }
    return new Uint8Array(0);
  }
}
