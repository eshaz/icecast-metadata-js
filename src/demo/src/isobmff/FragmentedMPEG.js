import MP3Parser from "./MP3Parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._frames = [];
    this._totalLength = 0;
    this._partialFrame = [];
    this._sampleRate = 0;

    this._generator = this._generator();
    this._generator.next();
  }

  getHeader(sampleRate = 44100) {
    return FragmentedISOBMFFBuilder.getMp3MovieBox({ sampleRate });
  }

  next(data) {
    return this._generator.next(data);
  }

  *_readFrames() {
    const mpegData = yield* this._sendReceiveData();

    let { frame, offset } = MP3Parser.readFrame(mpegData);

    while (frame?.isComplete) {
      this._frames.push(frame.data);
      this._totalLength += frame.data.length;

      offset += frame.header.frameByteLength;
      frame = MP3Parser.readFrame(mpegData, offset).frame;
    }

    this._partialFrame = mpegData.subarray(offset);
  }

  *_generator() {
    while (true) {
      yield* this._readFrames();
    }
  }

  *_sendReceiveData() {
    let fragment, mpegData;

    if (this._frames.length > 1 && this._totalLength > 1022) {
      fragment = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(this._frames);
      this._frames = [];
      this._totalLength = 0;
    }

    do {
      mpegData = yield fragment;
    } while (!mpegData);

    const newData = Uint8Array.from([...this._partialFrame, ...mpegData]);
    this._partialFrame = [];

    return newData;
  }
}
