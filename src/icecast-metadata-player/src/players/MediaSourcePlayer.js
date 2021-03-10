const MSEAudioWrapper = require("mse-audio-wrapper").default;

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer

class MediaSourcePlayer {
  constructor(options) {
    this._audioElement = options.audioElement;
    this._endpoint = options.endpoint;
    this._hasIcy = options.hasIcy;
    this._enableLogging = options.enableLogging;
    this._icecastMetadataQueue = options.icecastMetadataQueue;
    this._fireEvent = options.fireEvent;
    this._state = options.state;
    this._events = options.events;

    this._createMediaSource();
  }

  static isSupported() {
    try {
      new MediaSource();
    } catch {
      return false;
    }

    return true;
  }

  async reset() {
    await this._createMediaSource();
  }

  async fetchStream(abortController) {
    const res = await fetch(this._endpoint, {
      method: "GET",
      headers: this._hasIcy ? { "Icy-MetaData": 1 } : {},
      signal: abortController.signal,
    });

    if (!res.ok) {
      const error = new Error(`${res.status} received from ${res.url}`);
      error.name = "HTTP Response Error";
      throw error;
    }

    return res;
  }

  getOnMetadata() {
    return (value) => {
      this._icecastMetadataQueue.addMetadata(
        value,
        (this._mediaSource &&
          this._mediaSource.sourceBuffers.length &&
          Math.max(
            // work-around for WEBM reporting a negative timestampOffset
            this._mediaSource.sourceBuffers[0].timestampOffset,
            this._mediaSource.sourceBuffers[0].buffered.length
              ? this._mediaSource.sourceBuffers[0].buffered.end(0)
              : 0
          )) ||
          0,
        this._audioElement.currentTime
      );
    };
  }

  getOnStream(res) {
    const sourceBufferPromise = this._getMimeType(
      res.headers.get("content-type")
    ).then((mimeType) => this._createSourceBuffer(mimeType));

    const onStream = async ({ stream }) => {
      this._fireEvent(this._events.STREAM, stream);
      await sourceBufferPromise;
      await this._appendSourceBuffer(stream);
    };

    return this._mseAudioWrapper
      ? async ({ stream }) => {
          for await (const fragment of this._mseAudioWrapper.iterator(stream)) {
            await onStream({ stream: fragment });
          }
        }
      : onStream;
  }

  async _getMimeType(inputMimeType) {
    if (MediaSource.isTypeSupported(inputMimeType)) {
      return inputMimeType;
    } else {
      const mimeType = await new Promise((onMimeType) => {
        this._mseAudioWrapper = new MSEAudioWrapper(inputMimeType, {
          onCodecUpdate: (...args) =>
            this._fireEvent(this._events.CODEC_UPDATE, ...args),
          onMimeType,
        });
      });

      if (!MediaSource.isTypeSupported(mimeType)) {
        this._fireEvent(
          this._events.ERROR,
          `Media Source Extensions API in your browser does not support ${inputMimeType} or ${mimeType}`,
          "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
        );
        const error = new Error(`Unsupported Media Source Codec ${mimeType}`);
        error.name = "CodecError";
        throw error;
      }

      return mimeType;
    }
  }

  async _createSourceBuffer(mimeType) {
    await this._mediaSourcePromise;

    this._sourceBufferRemoved = 0;
    this._mediaSource.addSourceBuffer(mimeType).mode = "sequence";
  }

  async _createMediaSource() {
    this._mediaSource = new MediaSource();

    this._audioElement.src = URL.createObjectURL(this._mediaSource);
    this._mediaSourcePromise = new Promise((resolve) => {
      this._mediaSource.addEventListener("sourceopen", resolve, {
        once: true,
      });
    });
    return this._mediaSourcePromise;
  }

  async _waitForSourceBuffer() {
    return new Promise((resolve) => {
      this._mediaSource.sourceBuffers[0].addEventListener(
        "updateend",
        resolve,
        {
          once: true,
        }
      );
    });
  }

  async _appendSourceBuffer(chunk) {
    if (this._state() !== "stopping") {
      this._mediaSource.sourceBuffers[0].appendBuffer(chunk);
      await this._waitForSourceBuffer();

      if (
        this._audioElement.currentTime > BUFFER &&
        this._sourceBufferRemoved + BUFFER_INTERVAL * 1000 < Date.now()
      ) {
        this._sourceBufferRemoved = Date.now();
        this._mediaSource.sourceBuffers[0].remove(
          0,
          this._audioElement.currentTime - BUFFER
        );
        await this._waitForSourceBuffer();
      }
    }
  }
}

module.exports = MediaSourcePlayer;
