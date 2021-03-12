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

  async fetchStream(abortController) {
    const audioPromise = new Promise((resolve, reject) => {
      this._icecast.addEventListener("stopping", resolve, { once: true }); // short circuit when user has stopped the stream
      this._audioElement.addEventListener("playing", resolve, { once: true });
      this._audioElement.addEventListener("error", reject, { once: true });
    });

    this._audioElement.src = this._endpoint;
    this._audioElement.load();

    return audioPromise.then(async () => {
      const audioLoaded = performance.now();

      const res = await super.fetchStream(abortController);
      this._offset = performance.now() - audioLoaded;

      return res;
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
