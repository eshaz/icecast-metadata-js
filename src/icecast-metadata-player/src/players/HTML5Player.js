import { state, event, fireEvent } from "../global.js";
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
    return super.canPlayType((type) => new Audio().canPlayType(type), mimeType);
  }

  static get name() {
    return "html5";
  }

  get isAudioPlayer() {
    return true;
  }

  get metadataTimestamp() {
    return this._frame
      ? (this._frame.totalDuration + this._metadataTimestampOffset) / 1000
      : 0;
  }

  get currentTime() {
    return (
      this._audioLoadedTimestamp &&
      (performance.now() - this._audioLoadedTimestamp) / 1000
    );
  }

  async reset() {
    this._frame = null;
    this._metadataLoadedTimestamp = performance.now();
    this._audioLoadedTimestamp = 0;
    this._metadataTimestampOffset = 0;
    this._firedPlay = false;

    this._audioElement.removeAttribute("src");
    this._audioElement.src = this._endpoint;

    if (
      this._icecast.state !== state.STOPPING &&
      this._icecast.state !== state.STOPPED
    ) {
      this._audioElement.addEventListener(
        "playing",
        () => {
          this._audioLoadedTimestamp = performance.now();
          this._metadataTimestampOffset =
            performance.now() - this._metadataLoadedTimestamp;
        },
        { once: true }
      );

      if (!this._firedPlay) {
        this._icecast[fireEvent](event.PLAY);
        this._firedPlay = true;
      }
    }
  }

  onStream(frames) {
    this._frame = frames[frames.length - 1] || this._frame;
  }
}
