import Player from "./Player";
import CodecParser from "codec-parser";

export default class HTML5Player extends Player {
  constructor(options) {
    super(options);

    this._frame = null;
    this._audioLoaded = 0;
    this._offset = 0;

    this._audioElement.crossOrigin = "anonymous";
    this._audioElement.preload = "none";
    this._audioElement.src = this._endpoint;
  }

  static canPlayType(mimeType) {
    return new Audio().canPlayType(mimeType);
  }

  async reset() {
    if (this._state() !== "playing") {
      this._frame = null;
      this._audioLoaded = 0;
      this._offset = 0;
      this._audioElement.removeAttribute("src");
      this._audioElement.load();
      this._audioElement.src = this._endpoint;
    }
  }

  async play(abortController) {
    const audioPromise = new Promise((resolve, reject) => {
      this._icecast.addEventListener("stopping", resolve, { once: true }); // short circuit when user has stopped the stream
      this._audioElement.addEventListener("playing", resolve, { once: true });
      this._audioElement.addEventListener("error", reject, { once: true });
    });

    this._audioElement.src = this._endpoint;
    this._audioElement.load();

    if (this._metadataTypes.length) {
      return audioPromise.then(async () => {
        const audioLoaded = performance.now();

        const res = await super.play(abortController);
        this._offset = performance.now() - audioLoaded;

        return res;
      });
    }

    // don't fetch metadata if there are no metadata types
    return new Promise((_, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));

      abortController.aborted
        ? abort()
        : abortController.signal.addEventListener("abort", abort);
    });
  }

  get metadataTimestamp() {
    return this._frame ? (this._frame.totalDuration + this._offset) / 1000 : 0;
  }

  getOnStream(res) {
    this._codecParser = new CodecParser(res.headers.get("content-type"), {
      onCodecUpdate: (...args) =>
        this._fireEvent(this._events.CODEC_UPDATE, ...args),
    });

    return ({ stream }) => {
      this._fireEvent(this._events.STREAM, stream);

      for (const frame of this._codecParser.iterator(stream)) {
        this._frame = frame;
      }
    };
  }
}
