import { state, event, fireEvent, NOT_SYNCED } from "../global.js";
import Player from "./Player.js";

export default class HTML5Player extends Player {
  constructor(icecast, endpoint) {
    super(icecast, endpoint);

    this._audioElement.crossOrigin = "anonymous";
    this._audioElement.loop = false;
    this._audioElement.preload = "none";

    this._icecast.addEventListener(event.STREAM_START, () => {
      if (!this._playReady) this.end();
    });

    this._init();
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

  get waiting() {
    return new Promise((resolve) => {
      this._audioElement.addEventListener("waiting", resolve, { once: true });
    });
  }

  async _init() {
    super._init();

    this._frame = null;
    this._audioLoadedTimestamp = 0;
    this._metadataTimestampOffset = 0;
    this._playReady = false;
  }

  async start(metadataOffset) {
    const playing = super.start(metadataOffset);

    this._metadataLoadedTimestamp = performance.now();
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

          this._startMetadataQueues();
          this._icecast[fireEvent](event.PLAY);
        },
        { once: true },
      );

      this._icecast[fireEvent](event.PLAY_READY);
      this._playReady = true;
    }

    await playing;
  }

  async end() {
    super.end();

    this._audioElement.src = null;
    this._audioElement.srcObject = null;

    this._init();
  }

  onStream(frames) {
    this._frame = frames[frames.length - 1] || this._frame;

    if (this.syncState === NOT_SYNCED) {
      // syncing not implemented in html5 playback method
      this.syncState = NOT_SYNCED;
    }
  }
}
