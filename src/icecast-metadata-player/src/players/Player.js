import {
  p,
  audioElement,
  bufferLength,
  icecastMetadataQueue,
  codecUpdateQueue,
  endpoint,
} from "../global.js";

export default class Player {
  constructor(icecast, inputMimeType, codec) {
    const instanceVariables = p.get(icecast);

    this._icecast = icecast;
    this._inputMimeType = inputMimeType;
    this._codec = codec;

    this._audioElement = instanceVariables[audioElement];
    this._icecastMetadataQueue = instanceVariables[icecastMetadataQueue];
    this._codecUpdateQueue = instanceVariables[codecUpdateQueue];
    this._endpoint = instanceVariables[endpoint];
    this._bufferLength = instanceVariables[bufferLength];

    this._codecUpdateTimestamp = 0;
    this._codecUpdateOffset = 0;

    // set the audio element an empty source to enable the play button
    try {
      this._audioElement.removeAttribute("src");
      this._audioElement.srcObject = null;

      if (window.MediaSource) {
        // MediaSourcePlayer
        this._audioElement.src = URL.createObjectURL(new MediaSource());
      } else {
        // WebAudioPlayer
        this._mediaStream = new MediaStream();
        this._audioElement.srcObject = this._mediaStream;
      }
    } catch {
      // HTML5Player
      // mp3 32kbs silence
      this._audioElement.src =
        "data:audio/mpeg;base64,//sQxAAABFgC/SCEYACCgB9AAAAAppppVCAHBAEIgBByw9WD5+J8ufwxiDED" +
        "sMfE+D4fwG/RUGCx6VO4awVxV3qDtQNPiXKnZUNSwKuUDR6IgaeoGg7Fg6pMQU1FMy4xMDCqqqqqqqr/+xL" +
        "EB4PAAAGkAAAAIAAANIAAAASqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq" +
        "qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqo=";

      this._audioElement.loop = true;
    }
  }

  static parseMimeType(mimeType) {
    return mimeType.match(
      /^(?:application\/|audio\/|)(?<mime>[a-zA-Z]+)(?:$|;[ ]*codecs=(?:\'|\")(?<codecs>[a-zA-Z,]+)(?:\'|\"))/
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

  /**
   * @interface
   */
  async reset() {}

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
      this.currentTime
    );
  }

  /**
   * @abstract
   */
  onCodecUpdate(codecData, updateTimestamp) {
    const currentTime = this.currentTime;

    // add previous offset when reconnecting
    if (updateTimestamp < currentTime)
      this._codecUpdateOffset += this._codecUpdateTimestamp;

    this._codecUpdateTimestamp = updateTimestamp;

    this._codecUpdateQueue.addMetadata(
      { metadata: codecData, stats: {} },
      (updateTimestamp + this._codecUpdateOffset) / 1000,
      currentTime
    );
  }
}
