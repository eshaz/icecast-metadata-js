import { state, event, fireEvent } from "../global.js";
import Player from "./Player.js";

export default class HTML5Player extends Player {
  constructor(icecast) {
    super(icecast);

    this._audioElement.crossOrigin = "anonymous";
    this._audioElement.loop = false;
    this._audioElement.preload = "none";

    this._icecast.addEventListener(event.STREAM_START, () => {
      if (!this._playReady) this.end();
    });

    this.end();
  }

  static canPlayType(mimeType) {
    if (!HTML5Player.isSupported) return "";

    return super.canPlayType((type) => new Audio().canPlayType(type), mimeType);
  }

  static get isSupported() {
    return Boolean(window.Audio);
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

  async end() {
    super.end();

    this._frame = null;
    this._metadataLoadedTimestamp = performance.now();
    this._audioLoadedTimestamp = 0;
    this._metadataTimestampOffset = 0;
    this._playReady = false;

    this._audioElement.src = null;
    this._audioElement.srcObject = null;
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

          this._startMetadata();
          this._icecast[fireEvent](event.PLAY);
        },
        { once: true }
      );

      this._icecast[fireEvent](event.PLAY_READY);
      this._playReady = true;
    }
  }

  onStream(frames) {
    this._frame = frames[frames.length - 1] || this._frame;
  }
}
