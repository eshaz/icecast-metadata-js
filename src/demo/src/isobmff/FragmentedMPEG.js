import MP3Parser from "./MP3Parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._frames = [];
    this._mpegData = [];

    this._generator = this._generator();
    this._generator.next();
  }

  next(data) {
    return this._generator.next(data);
  }

  _parseFrames() {
    let { frame, offset } = MP3Parser.readFrame(this._mpegData);

    while (frame?.isComplete) {
      this._frames.push(frame.data);

      offset += frame.header.frameByteLength;
      frame = MP3Parser.readFrame(this._mpegData, offset).frame;
    }

    this._mpegData = this._mpegData.subarray(offset);
  }

  _readOrStoreFrames() {
    if (
      this._frames.length > 1 &&
      this._frames.reduce((acc, frame) => acc + frame.length, 0) > 1022
    ) {
      const frames = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );

      this._frames = [];
      return frames;
    }
  }

  *_generator() {
    let frames;
    while (!frames) {
      frames = yield* this._getFrames();
    }

    frames = Uint8Array.from([
      ...FragmentedISOBMFFBuilder.getMp3MovieBox(),
      ...frames,
    ]);

    while (true) {
      frames = yield* this._getFrames(frames);
    }
  }

  *_getFrames(frames) {
    yield* this._sendReceiveData(frames);
    frames = this._parseFrames();
    return this._readOrStoreFrames();
  }

  *_sendReceiveData(frames) {
    let mpegData = yield frames;

    while (!mpegData) {
      mpegData = yield;
    }

    this._mpegData = Uint8Array.from([...this._mpegData, ...mpegData]);
  }
}
