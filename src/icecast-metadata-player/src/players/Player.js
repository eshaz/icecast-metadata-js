import {
  p,
  audioElement,
  endpoint,
  metadataTypes,
  icyMetaInt,
  icyDetectionTimeout,
  hasIcy,
  icecastMetadataQueue,
} from "../global.js";

export default class Player {
  constructor(icecast, inputMimeType, codec) {
    const instanceVariables = p.get(icecast);

    this._icecast = icecast;
    this._audioElement = instanceVariables[audioElement];
    this._endpoint = instanceVariables[endpoint];
    this._metadataTypes = instanceVariables[metadataTypes];
    this._icyMetaInt = instanceVariables[icyMetaInt];
    this._icyDetectionTimeout = instanceVariables[icyDetectionTimeout];

    this._hasIcy = instanceVariables[hasIcy];
    this._icecastMetadataQueue = instanceVariables[icecastMetadataQueue];

    this._inputMimeType = inputMimeType;
    this._codec = codec;

    // mp3 32kbs silence
    this._audioElement.src =
      "data:audio/mpeg;base64,//sQxAAABFgC/SCEYACCgB9AAAAAppppVCAHBAEIgBByw9WD5+J8ufwxiDED" +
      "sMfE+D4fwG/RUGCx6VO4awVxV3qDtQNPiXKnZUNSwKuUDR6IgaeoGg7Fg6pMQU1FMy4xMDCqqqqqqqr/+xL" +
      "EB4PAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" +
      "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=";

    this._audioElement.loop = true;
  }

  get isAudioPlayer() {
    return false;
  }

  get icyMetaInt() {
    return (
      this._icecastReadableStream && this._icecastReadableStream.icyMetaInt
    );
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

  /**
   * @interface
   */
  async reset() {}

  /**
   * @abstract
   */
  async play() {}

  /**
   * @abstract
   */
  onStream(frames) {
    return frames;
  }

  onMetadata(metadata) {
    this._icecastMetadataQueue.addMetadata(
      metadata,
      this.metadataTimestamp,
      this.currentTime
    );
  }
}
