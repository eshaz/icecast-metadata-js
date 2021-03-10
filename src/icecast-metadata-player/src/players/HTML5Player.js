const CodecParser = require("codec-parser").default;

class HTML5Player {
  constructor(options) {
    this._audioElement = options.audioElement;
    this._endpoint = options.endpoint;
    this._hasIcy = options.hasIcy;
    this._enableLogging = options.enableLogging;
    this._icecastMetadataQueue = options.icecastMetadataQueue;
    this._fireEvent = options.fireEvent;
    this._events = options.events;

    this._audioLoaded = 0;
    this._offset = 0;

    this._audioElement.crossOrigin = "anonymous";
  }

  isSupported() {}

  async reset() {
    this._frame = null;
    this._audioLoaded = 0;
    this._offset = 0;
    this._audioElement.removeAttribute("src");
    this._audioElement.load();
  }

  async fetchStream(abortController) {
    const playing = new Promise((resolve) => {
      this._audioElement.addEventListener(
        "playing",
        async () => {
          this._audioLoaded = Date.now();
          console.log("playing");
          resolve();
        },
        { once: true }
      );
    });

    this._audioElement.src = this._endpoint;
    await playing;

    return fetch(this._endpoint, {
      method: "GET",
      headers: this._hasIcy ? { "Icy-MetaData": 1 } : {},
      signal: abortController.signal,
    }).then((res) => {
      this._offset = Date.now() - this._audioLoaded;

      if (!res.ok) {
        const error = new Error(`${res.status} received from ${res.url}`);
        error.name = "HTTP Response Error";
        throw error;
      }

      return res;
    });
  }

  getOnMetadata() {
    return (value) => {
      const timestamp = this._frame
        ? (this._frame.totalDuration + this._offset) / 1000
        : 0;
      const audioTime = Math.max(this._audioElement.currentTime, 0);

      this._icecastMetadataQueue.addMetadata(value, timestamp, audioTime);
    };
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

module.exports = HTML5Player;
