import {
  p,
  event,
  state,
  audioElement,
  bufferLength,
  SYNCED,
  NOT_SYNCED,
} from "../global.js";
import FrameQueue from "../FrameQueue.js";

export default class Player {
  constructor(icecast, endpoint, inputMimeType, codec, codecHeader) {
    this._icecast = icecast;
    this._endpoint = endpoint;
    this._inputMimeType = inputMimeType;
    this._codec = codec;
    this._codecHeader = codecHeader;

    const instanceVariables = p.get(this._icecast);

    this._audioElement = instanceVariables[audioElement];
    this._bufferLength = instanceVariables[bufferLength];

    this._codecUpdateTimestamp = 0;
    this._codecUpdateOffset = 0;

    this._notSyncedHandler = () => {
      this.syncState = NOT_SYNCED;
    };
  }

  static parseMimeType(mimeType) {
    return mimeType.match(
      /^(?:application\/|audio\/|)(?<mime>[a-zA-Z]+)(?:$|;[ ]*codecs=(?:\'|\")(?<codecs>[a-zA-Z,]+)(?:\'|\"))/,
    );
  }

  static canPlayType(codecChecker, mimeType, mapping) {
    const matches = Player.parseMimeType(mimeType);

    const checkCodecs = (codecs) =>
      codecs.reduce((acc, codec) => {
        if (acc === "") return "";

        const result = codecChecker(codec);

        if (!result) return "";
        if (result === "maybe" || acc === "maybe") return "maybe";
        if (result === true || result === "probably") return "probably";
      }, null);

    if (matches) {
      const { mime, codecs } = matches.groups;

      const mimeMapping = mapping && mapping[mime];

      // mapping is a raw codec
      if (!mimeMapping || Array.isArray(mimeMapping)) {
        return (
          checkCodecs(mimeMapping || [mimeType]) || // check with the codec
          checkCodecs([`audio/${mime}`]) // check as a raw mimetype
        );
      }

      // mapping ia a container
      if (typeof mimeMapping === "object") {
        if (codecs) {
          const mimeCodecs = codecs.split(",");

          // multiple codecs are not supported
          if (mimeCodecs.length > 1) return "";
          if (!mimeMapping[mimeCodecs[0]]) return "";

          return checkCodecs(mimeMapping[mimeCodecs[0]]);
        }
        // container exists in list but no codecs were specified
        return "maybe";
      }
    }

    // codec not in the list
    return "";
  }

  enablePlayButton() {
    // set the audio element an empty source to enable the play button
    this._audioElement.removeAttribute("src");
    this._audioElement.src = null;
    this._audioElement.srcObject = null;
    // mp3 32kbs silence
    this._audioElement.src =
      "data:audio/mpeg;base64,//sQxAAABFgC/SCEYACCgB9AAAAAppppVCAHBAEIgBByw9WD5+J8ufwxiDED" +
      "sMfE+D4fwG/RUGCx6VO4awVxV3qDtQNPiXKnZUNSwKuUDR6IgaeoGg7Fg6pMQU1FMy4xMDCqqqqqqqr/+xL" +
      "EB4PAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" +
      "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=";

    this._audioElement.loop = true;
  }

  get syncStateUpdate() {
    return this._syncStatePromise;
  }

  get syncState() {
    return this._syncState;
  }

  set syncState(newState) {
    this._syncState = newState;

    if (this._syncStateResolve) this._syncStateResolve(newState);

    this._syncStatePromise = new Promise((resolve) => {
      this._syncStateResolve = resolve;
    });
  }

  /**
   * @abstract
   */
  get isSupported() {
    return false;
  }

  /**
   * @abstract
   */
  get isAudioPlayer() {
    return false;
  }

  /**
   * @interface
   */
  get metadataTimestamp() {
    return 0;
  }

  /**
   * @interface
   */
  get currentTime() {
    return 0;
  }

  get waiting() {
    return Promise.resolve();
  }

  get icecastMetadataQueue() {
    return this._icecastMetadataQueue;
  }

  set icecastMetadataQueue(icecastMetadataQueue) {
    this._icecastMetadataQueue = icecastMetadataQueue;
  }

  get codecUpdateQueue() {
    return this._codecUpdateQueue;
  }

  set codecUpdateQueue(codecUpdateQueue) {
    this._codecUpdateQueue = codecUpdateQueue;
  }

  get metadataQueue() {
    return this._icecastMetadataQueue
      ? this._icecastMetadataQueue.metadataQueue
      : [];
  }

  _startMetadataQueues() {
    this._icecastMetadataQueue.startQueue(this._metadataOffset);
    this._codecUpdateQueue.startQueue(this._metadataOffset);
  }

  /**
   * @abstract
   */
  async _init() {
    this.syncState = SYNCED;
    this.syncFrames = [];
    this.syncDelay = null;
    this._frameQueue = new FrameQueue(this._icecast, this);
  }

  /**
   * @abstract
   */
  async start(metadataOffset) {
    this._metadataOffset = metadataOffset;

    [event.RETRY, event.SWITCH].forEach((e) =>
      this._icecast.addEventListener(e, this._notSyncedHandler),
    );

    let resolve;
    const playing = new Promise((r) => {
      resolve = r;
      [state.PLAYING, state.STOPPING].forEach((s) =>
        this._icecast.addEventListener(s, resolve, { once: true }),
      );
    }).finally(() => {
      [state.PLAYING, state.STOPPING].forEach((s) =>
        this._icecast.removeEventListener(s, resolve),
      );
    });

    await playing;
  }

  /**
   * @abstract
   */
  async end() {
    [event.RETRY, event.SWITCH].forEach((e) =>
      this._icecast.removeEventListener(e, this._notSyncedHandler),
    );

    this._icecastMetadataQueue.purgeMetadataQueue();
    this._codecUpdateQueue.purgeMetadataQueue();
  }

  /**
   * @abstract
   */
  onStream(frames) {
    return frames;
  }

  /**
   * @abstract
   */
  onMetadata(metadata) {
    this._icecastMetadataQueue.addMetadata(
      metadata,
      this.metadataTimestamp,
      this.currentTime,
    );
  }

  /**
   * @abstract
   */
  onCodecUpdate(metadata, updateTimestamp) {
    const currentTime = this.currentTime;

    // add previous offset when reconnecting
    if (updateTimestamp < currentTime)
      this._codecUpdateOffset += this._codecUpdateTimestamp;

    this._codecUpdateTimestamp = updateTimestamp;

    this._codecUpdateQueue.addMetadata(
      { metadata },
      (updateTimestamp + this._codecUpdateOffset) / 1000,
      currentTime,
    );
  }
}
