import { state } from "../global.js";
import Player from "./Player.js";

export default class HTML5Player extends Player {
  constructor(icecast) {
    super(icecast);

    this._audioElement.crossOrigin = "anonymous";
    this._audioElement.loop = false;
    this._audioElement.preload = "none";

    this.reset();
  }

  static canPlayType(mimeType) {
    return new Audio().canPlayType(mimeType);
  }

  get isAudioPlayer() {
    return true;
  }

  get metadataTimestamp() {
    return this._frame ? (this._frame.totalDuration + this._offset) / 1000 : 0;
  }

  get currentTime() {
    return this._audioLoaded && (performance.now() - this._audioLoaded) / 1000;
  }

  async reset() {
    this._frame = null;
    this._metadataLoaded = performance.now();
    this._audioLoaded = 0;
    this._offset = 0;

    this._audioElement.removeAttribute("src");
    this._audioElement.src = this._endpoint;

    if (
      this._icecast.state !== state.STOPPING &&
      this._icecast.state !== state.STOPPED
    ) {
      this._audioElement.addEventListener(
        "playing",
        () => {
          this._audioLoaded = performance.now();
          this._offset = performance.now() - this._metadataLoaded;
        },
        { once: true }
      );

      this._audioElement.play();
    }
  }

  onStream(frames) {
    this._frame = frames[frames.length - 1] || this._frame;
  }
}
