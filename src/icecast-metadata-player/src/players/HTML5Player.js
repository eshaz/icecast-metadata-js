import CodecParser from "codec-parser";
import { p, state, event, fireEvent, abortController } from "../global.js";
import Player from "./Player.js";

export default class HTML5Player extends Player {
  constructor(icecast) {
    super(icecast);

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

  get isAudioPlayer() {
    return true;
  }

  async reset() {
    if (this._icecast.state !== state.PLAYING) {
      this._frame = null;
      this._audioLoaded = 0;
      this._offset = 0;
      this._audioElement.removeAttribute("src");
      this._audioElement.load();
      this._audioElement.src = this._endpoint;
    }
  }

  async play() {
    const audioPromise = new Promise((resolve, reject) => {
      this._icecast.addEventListener(state.STOPPING, resolve, { once: true }); // short circuit when user has stopped the stream
      this._audioElement.addEventListener("playing", resolve, { once: true });
      this._audioElement.addEventListener("error", reject, { once: true });
    });

    this._audioElement.src = this._endpoint;
    this._audioElement.load();

    if (this._metadataTypes.length) {
      return audioPromise.then(async () => {
        const audioLoaded = performance.now();

        const res = await super.play();
        this._offset = performance.now() - audioLoaded;

        return res;
      });
    }

    // don't fetch metadata if there are no metadata types
    return new Promise((_, reject) => {
      const abort = () => reject(new DOMException("Aborted", "AbortError"));

      const controller = p.get(this._icecast)[abortController];

      controller.aborted
        ? abort()
        : controller.signal.addEventListener("abort", abort, { once: true });
    });
  }

  get metadataTimestamp() {
    return this._frame ? (this._frame.totalDuration + this._offset) / 1000 : 0;
  }

  get currentTime() {
    return this._audioElement.currentTime;
  }

  onStream(frames) {
    this._frame = frames.flatMap((frame) => frame.codecFrames || frame)[
      frames.length - 1
    ];
  }
}
