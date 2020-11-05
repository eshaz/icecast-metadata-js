import MPEGParser from "./mpeg/MPEGParser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  static MIN_FRAMES = 2;
  static MIN_FRAMES_LENGTH = 1022;

  constructor() {
    this._mpegParser = new MPEGParser();
    this._frames = [];
    this._mpegData = new Uint8Array(0);

    this._generator = this._generator();
    this._generator.next();
  }

  static appendBuffers(buf1, buf2) {
    const buf = new Uint8Array(buf1.length + buf2.length);
    buf.set(buf1);
    buf.set(buf2, buf1.length);

    return buf;
  }

  next(data) {
    return this._generator.next(data);
  }

  *_generator() {
    let frames;
    while (!frames) {
      frames = yield* this._getFrames();
    }
    // append the movie box for the first yield result
    frames = FragmentedMPEG.appendBuffers(
      FragmentedISOBMFFBuilder.getMp3MovieBox(),
      frames
    );

    while (true) {
      frames = yield* this._getFrames(frames);
    }
  }

  *_getFrames(frames) {
    yield* this._sendReceiveData(frames);
    this._parseFrames();
    return this._readOrStoreFrames();
  }

  *_sendReceiveData(frames) {
    let mpegData = yield frames;

    while (!mpegData) {
      mpegData = yield;
    }

    this._mpegData = FragmentedMPEG.appendBuffers(this._mpegData, mpegData);
  }

  _parseFrames() {
    let currentFrame = this._mpegParser.readFrame(this._mpegData);

    while (currentFrame.frame) {
      this._frames.push(currentFrame.frame.data);

      currentFrame = this._mpegParser.readFrame(
        this._mpegData,
        currentFrame.offset + currentFrame.frame.header.frameByteLength
      );
    }

    this._mpegData = this._mpegData.subarray(currentFrame.offset);
  }

  _readOrStoreFrames() {
    if (
      this._frames.length >= FragmentedMPEG.MIN_FRAMES &&
      this._frames.reduce((acc, frame) => acc + frame.length, 0) >=
        FragmentedMPEG.MIN_FRAMES_LENGTH
    ) {
      const frames = FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(
        this._frames
      );

      this._frames = [];
      return frames;
    }
  }
}
