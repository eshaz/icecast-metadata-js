import FrameBuffer from "../icecast/metadata-js/MetadataBuffer";
import MP3Parser from "./MP3Parser";
import FragmentedISOBMFFBuilder from "./FragmentedISOBMFFBuilder";

export default class FragmentedMPEG {
  constructor() {
    this._frames = [];
    this._totalLength = 0;
    this._partialFrame = new Uint8Array(0);

    this._generator = this._generator();
    this._generator.next();
  }

  getHeader(sampleRate = 44100) {
    return FragmentedISOBMFFBuilder.getMp3MovieBox({ sampleRate });
  }

  next(data) {
    return this._generator.next(data);
  }

  _appendPartialFrame() {
    this._partialFrame = this._buffer.subarray(this._currentPosition);

    console.log(this._partialFrame);
    this._currentPosition = this._buffer.length;
  }

  *_generator() {
    // yield* this._getFramesWithMoov();
    // let execCount = 0;
    while (true) {
      if (this._frames.length > 1 && this._totalLength > 1022) {
        yield* this._getMoreData(
          FragmentedISOBMFFBuilder.wrapMp3InMovieFragment(this._frames)
        );
        this._frames = [];
        this._totalLength = 0;
      } else {
        yield* this._getMoreData();
      }

      let { offset, frame } = MP3Parser.readFrame(
        this._buffer,
        this._currentPosition
      );
      this._currentPosition = offset;

      while (frame && frame.isComplete) {
        this._partialFrame = new Uint8Array(0);

        this._frames.push(frame.data);
        this._totalLength += frame.data.length;
        this._currentPosition += frame.header.frameByteLength;
        frame = MP3Parser.readFrame(this._buffer, this._currentPosition).frame;
      }

      this._appendPartialFrame();

      // execCount++;
      //if (execCount === 10) break;
    }
  }

  *_getMoreData(frames) {
    while (!this._buffer || this._currentPosition >= this._buffer.length) {
      const data = yield frames; // if out of data, accept new data in the .next() call
      this._buffer = Uint8Array.from([...this._partialFrame, ...data]);
      this._currentPosition = 0;
    }

    return this._buffer.subarray(this._currentPosition);
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
