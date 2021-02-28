/**
 * @license
 * @see https://github.com/eshaz/icecast-metadata-js
 * @copyright 2021 Ethan Halsall
 *  This file is part of icecast-metadata-player.
 *
 *  icecast-metadata-player free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  icecast-metadata-player distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>
 */
const {
  IcecastReadableStream,
  IcecastMetadataQueue,
} = require("icecast-metadata-js");
const MSEAudioWrapper = require("mse-audio-wrapper").default;
const EventTargetPolyfill = require("./EventTargetPolyfill");

const noOp = () => {};
const p = new WeakMap();

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer
const DEFAULT_RETRY_INTERVAL = 2; // seconds before retrying the fetch request
const DEFAULT_RETRY_TIMEOUT = 10; // seconds before giving up on retries

// State
const LOADING = "loading";
const PLAYING = "playing";
const STOPPING = "stopping";
const STOPPED = "stopped";
const RETRYING = "retrying";

// Events
const PLAY = "play";
const LOAD = "load";
const STREAM_START = "streamstart";
const STREAM = "stream";
const STREAM_END = "streamend";
const METADATA = "metadata";
const METADATA_ENQUEUE = "metadataenqueue";
const CODEC_UPDATE = "codecupdate";
const STOP = "stop";
const RETRY = "retry";
const RETRY_TIMEOUT = "retrytimeout";
const WARN = "warn";
const ERROR = "error";

// options
const metadataTypes = Symbol();
const audioElement = Symbol();
const icyMetaInt = Symbol();
const icyDetectionTimeout = Symbol();
const enableLogging = Symbol();
const endpoint = Symbol();
const retryInterval = Symbol();
const retryTimeout = Symbol();

// variables
const hasIcy = Symbol();
const icecastReadableStream = Symbol();
const icecastMetadataQueue = Symbol();
const abortController = Symbol();
const mediaSource = Symbol();
const sourceBufferRemoved = Symbol();
const events = Symbol();
const state = Symbol();
const onAudioPause = Symbol();
const onAudioPlay = Symbol();
const onAudioCanPlay = Symbol();
const onAudioError = Symbol();
const mseAudioWrapper = Symbol();
const mediaSourcePromise = Symbol();

// private methods
const fireEvent = Symbol();
const fallbackToAudioSrc = Symbol();
const createMediaSource = Symbol();
const createSourceBuffer = Symbol();

const getMimeType = Symbol();
const waitForSourceBuffer = Symbol();
const appendSourceBuffer = Symbol();
const fetchStream = Symbol();
const playResponse = Symbol();
const getOnStream = Symbol();
const attachAudioElement = Symbol();
const shouldRetry = Symbol();

class IcecastMetadataPlayer extends EventTargetPolyfill {
  /**
   * @constructor
   * @param {string} endpoint Endpoint of the Icecast compatible stream
   * @param {object} options Options object
   * @param {HTMLAudioElement} options.audioElement Audio element to play the stream
   * @param {Array} options.metadataTypes Array of metadata types to parse
   * @param {number} options.icyMetaInt ICY metadata interval
   * @param {number} options.icyDetectionTimeout ICY metadata detection timeout
   *
   * @callback options.onMetadata Called with metadata when synchronized with the audio
   * @callback options.onMetadataEnqueue Called with metadata when discovered on the response
   * @callback options.onError Called with message(s) when a fallback or error condition is met
   * @callback options.onWarn Called with message(s) when a warning condition is met
   * @callback options.onPlay Called when the audio element begins playing
   * @callback options.onLoad Called when stream request is started
   * @callback options.onStreamStart Called when stream requests begins to return data
   * @callback options.onStream Called when stream data is sent to the audio element
   * @callback options.onStreamEnd Called when the stream request completes
   * @callback options.onStop Called when the stream is completely stopped and all cleanup operations are complete
   * @callback options.onRetry Called when a connection retry is attempted
   * @callback options.onRetryTimeout Called when when connections attempts have timed out
   * @callback options.onCodecUpdate Called when the audio codec information has changed
   */
  constructor(url, options = {}) {
    super();

    p.set(this, {});
    p.get(this)[endpoint] = url;

    // options
    p.get(this)[audioElement] = options.audioElement || new Audio();
    p.get(this)[icyMetaInt] = options.icyMetaInt;
    p.get(this)[icyDetectionTimeout] = options.icyDetectionTimeout;
    p.get(this)[metadataTypes] = options.metadataTypes || ["icy"];
    p.get(this)[hasIcy] = p.get(this)[metadataTypes].includes("icy");
    p.get(this)[enableLogging] = options.enableLogging || false;
    p.get(this)[retryInterval] =
      options.retryInterval || DEFAULT_RETRY_INTERVAL;
    p.get(this)[retryTimeout] = options.retryTimeout || DEFAULT_RETRY_TIMEOUT;

    // callbacks
    p.get(this)[events] = {
      [PLAY]: options.onPlay || noOp,
      [LOAD]: options.onLoad || noOp,
      [STREAM_START]: options.onStreamStart || noOp,
      [STREAM]: options.onStream || noOp,
      [STREAM_END]: options.onStreamEnd || noOp,
      [METADATA]: options.onMetadata || noOp,
      [METADATA_ENQUEUE]: options.onMetadataEnqueue || noOp,
      [CODEC_UPDATE]: options.onCodecUpdate || noOp,
      [STOP]: options.onStop || noOp,
      [RETRY]: options.onRetry || noOp,
      [RETRY_TIMEOUT]: options.onRetryTimeout || noOp,
      [WARN]: (...messages) => {
        if (p.get(this)[enableLogging]) {
          console.warn(
            "icecast-metadata-js",
            messages.reduce((acc, message) => acc + "\n  " + message, "")
          );
        }
        if (options.onWarn) options.onWarn(...messages);
      },
      [ERROR]: (...messages) => {
        if (p.get(this)[enableLogging]) {
          console.error(
            "icecast-metadata-js",
            messages.reduce((acc, message) => acc + "\n  " + message, "")
          );
        }
        if (options.onError) options.onError(...messages);
      },
    };

    this._log = {
      [PLAY]: (args) => console.log("PLAY", ...args),
      [LOAD]: (args) => console.log("LOAD", ...args),
      [STREAM_START]: (args) => console.log("STREAM_START", ...args),
      [STREAM]: noOp, //(args) => console.log("STREAM", ...args),
      [STREAM_END]: (args) => console.log("STREAM_END", ...args),
      [METADATA]: noOp, //(args) => console.log("METADATA", ...args),
      [METADATA_ENQUEUE]: noOp, //(args) => console.log("METADATA_ENQUEUE", ...args),
      [CODEC_UPDATE]: noOp, //(args) => console.log("CODEC_UPDATE", ...args),
      [STOP]: (args) => console.log("STOP", ...args),
      [RETRY]: (args) => console.log("RETRY", ...args),
      [RETRY_TIMEOUT]: (args) => console.log("RETRY_TIMEOUT", ...args),
      [WARN]: (args) => console.log("WARN", ...args),
      [ERROR]: (args) => console.log("ERROR", ...args),
    };

    p.get(this)[icecastMetadataQueue] = new IcecastMetadataQueue({
      onMetadataUpdate: (...args) => this[fireEvent](METADATA, ...args),
      onMetadataEnqueue: (...args) =>
        this[fireEvent](METADATA_ENQUEUE, ...args),
    });

    // audio element event handlers
    p.get(this)[onAudioPlay] = () => {
      this.play();
    };
    p.get(this)[onAudioPause] = () => {
      this.stop();
    };
    p.get(this)[onAudioCanPlay] = () => {
      p.get(this)[audioElement].play();
      this[state] = PLAYING;
      this[fireEvent](PLAY);
    };
    p.get(this)[onAudioError] = (e) => {
      const errors = {
        1: "MEDIA_ERR_ABORTED The fetching of the associated resource was aborted by the user's request.",
        2: "MEDIA_ERR_NETWORK Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available.",
        3: "MEDIA_ERR_DECODE Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error.",
        4: "MEDIA_ERR_SRC_NOT_SUPPORTED The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable.",
        5: "MEDIA_ERR_ENCRYPTED",
      };
      this[fireEvent](
        ERROR,
        "The audio element encountered an error",
        errors[e.target.error.code] || `Code: ${e.target.error.code}`,
        `Message: ${e.target.error.message}`
      );
    };

    this[attachAudioElement]();

    this[state] = STOPPED;
    this[createMediaSource]();
    p.get(this)[icecastReadableStream] = {}; // prevents getters from erroring when in a fallback state
  }

  /**
   * @returns {HTMLAudioElement} The audio element associated with this instance
   */
  get audioElement() {
    return p.get(this)[audioElement];
  }

  /**
   * @returns {number} The ICY metadata interval in number of bytes for this instance
   */
  get icyMetaInt() {
    return p.get(this)[icecastReadableStream].icyMetaInt;
  }

  /**
   * @returns {Array<Metadata>} Array of enqueued metadata objects in FILO order
   */
  get metadataQueue() {
    return p.get(this)[icecastMetadataQueue].metadataQueue;
  }

  /**
   * @returns {string} The current state ("loading", "playing", "stopping", "stopped", "retrying")
   */
  get state() {
    return p.get(this)[state];
  }

  set [state](_state) {
    this.dispatchEvent(new CustomEvent(_state));
    p.get(this)[state] = _state;
  }

  [attachAudioElement]() {
    // audio events
    const audio = p.get(this)[audioElement];
    audio.addEventListener("pause", p.get(this)[onAudioPause]);
    audio.addEventListener("play", p.get(this)[onAudioPlay]);
    audio.addEventListener("error", p.get(this)[onAudioError]);
  }

  /**
   * @description Remove event listeners from the audio element and this instance
   */
  detachAudioElement() {
    const audio = p.get(this)[audioElement];
    audio.removeEventListener("pause", p.get(this)[onAudioPause]);
    audio.removeEventListener("play", p.get(this)[onAudioPlay]);
    audio.removeEventListener("canplay", p.get(this)[onAudioCanPlay]);
    audio.removeEventListener("error", p.get(this)[onAudioError]);
  }

  /**
   * @description Plays the Icecast stream
   * @async Resolves when the audio element is playing
   */
  async play() {
    if (this.state === STOPPED) {
      p.get(this)[abortController] = new AbortController();
      this[state] = LOADING;
      this[fireEvent](LOAD);

      let error;

      const tryFetching = () =>
        this[fetchStream]()
          .then(async (res) => {
            this[fireEvent](STREAM_START);

            return this[playResponse](res).finally(() => {
              this[fireEvent](STREAM_END);
            });
          })
          .catch(async (e) => {
            if (e.name !== "AbortError") {
              if (await this[shouldRetry](e)) {
                return tryFetching();
              }

              p.get(this)[abortController].abort(); // stop fetch if is wasn't aborted

              if (
                p.get(this)[state] !== STOPPING &&
                p.get(this)[state] !== STOPPED
              ) {
                this[fireEvent](ERROR, e);
                error = e;
              }
            }
          });

      this.reset = () => {
        clearTimeout(this._retryTimeout);
        this.removeEventListener(STREAM_START, this.reset);

        p.get(this)[audioElement].removeEventListener(
          "canplay",
          p.get(this)[onAudioCanPlay]
        );
        p.get(this)[audioElement].pause();
        p.get(this)[icecastMetadataQueue].purgeMetadataQueue();
        this[createMediaSource]();
      };

      tryFetching().finally(() => {
        this.reset();

        if (error) {
          console.log(error, "falling back");
          this[fallbackToAudioSrc]();
        }

        this[fireEvent](STOP);
        this[state] = STOPPED;
      });

      await new Promise((resolve) => {
        this.addEventListener("play", resolve, { once: true });
      });
    }
  }

  /**
   * @description Stops playing the Icecast stream
   * @async Resolves the icecast stream has stopped
   */
  async stop() {
    if (this.state !== STOPPED && this.state !== STOPPING) {
      this[state] = STOPPING;
      p.get(this)[abortController].abort();

      await new Promise((resolve) => {
        this.addEventListener("stop", resolve, { once: true });
      });
    }
  }

  async [shouldRetry](error) {
    if (p.get(this)[state] === RETRYING) {
      // wait for retry interval
      await new Promise((resolve) => {
        this.addEventListener(STOPPING, resolve, { once: true });

        setTimeout(() => {
          this.removeEventListener(STOPPING, resolve);
          resolve();
        }, p.get(this)[retryInterval] * 1000);
      });

      // ensure the retry hasn't been cancelled while waiting
      if (p.get(this)[state] === RETRYING) {
        this[fireEvent](RETRY);
        p.get(this)[abortController] = new AbortController();

        return true;
      }
    } else if (
      (p.get(this)[state] !== STOPPING &&
        p.get(this)[state] !== STOPPED &&
        error.message.match(/network|fetch|offline|Error in body stream/i)) ||
      error.name === "HTTP Response Error"
    ) {
      this[fireEvent](ERROR, error);
      this[state] = RETRYING;

      this.addEventListener(STREAM_START, this.reset, { once: true });
      this._retryTimeout = setTimeout(() => {
        this[fireEvent](RETRY_TIMEOUT);
        this.stop();
      }, p.get(this)[retryTimeout] * 1000);

      return true;
    }

    return false;
  }

  async [fetchStream]() {
    const res = await fetch(p.get(this)[endpoint], {
      method: "GET",
      headers: p.get(this)[hasIcy] ? { "Icy-MetaData": 1 } : {},
      signal: p.get(this)[abortController].signal,
    });

    if (!res.ok) {
      const error = new Error(`${res.status} received from ${res.url}`);
      error.name = "HTTP Response Error";
      throw error;
    }

    return res;
  }

  async [playResponse](res) {
    p.get(this)[audioElement].addEventListener(
      "canplay",
      p.get(this)[onAudioCanPlay],
      { once: true }
    );

    p.get(this)[icecastReadableStream] = new IcecastReadableStream(res, {
      onMetadata: (value) => {
        p.get(this)[icecastMetadataQueue].addMetadata(
          value,
          (p.get(this)[mediaSource] &&
            p.get(this)[mediaSource].sourceBuffers.length &&
            Math.max(
              // work-around for WEBM reporting a negative timestampOffset
              p.get(this)[mediaSource].sourceBuffers[0].timestampOffset,
              p.get(this)[mediaSource].sourceBuffers[0].buffered.length
                ? p.get(this)[mediaSource].sourceBuffers[0].buffered.end(0)
                : 0
            )) ||
            0,
          p.get(this)[audioElement].currentTime
        );
      },
      onStream: this[getOnStream](res.headers.get("content-type")),
      onError: (...args) => this[fireEvent](WARN, ...args),
      metadataTypes: p.get(this)[metadataTypes],
      icyMetaInt: p.get(this)[icyMetaInt],
      icyDetectionTimeout: p.get(this)[icyDetectionTimeout],
    });

    await p.get(this)[icecastReadableStream].startReading();
  }

  async [getMimeType](inputMimeType) {
    if (MediaSource.isTypeSupported(inputMimeType)) {
      return inputMimeType;
    } else {
      const mimeType = await new Promise((onMimeType) => {
        p.get(this)[mseAudioWrapper] = new MSEAudioWrapper(inputMimeType, {
          onCodecUpdate: (...args) => this[fireEvent](CODEC_UPDATE, ...args),
          onMimeType,
        });
      });

      if (!MediaSource.isTypeSupported(mimeType)) {
        this[fireEvent](
          ERROR,
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

  async [createSourceBuffer](mimeType) {
    await p.get(this)[mediaSourcePromise];

    p.get(this)[sourceBufferRemoved] = 0;
    p.get(this)[mediaSource].addSourceBuffer(mimeType).mode = "sequence";
  }

  async [createMediaSource]() {
    try {
      const ms = (p.get(this)[mediaSource] = new MediaSource());

      p.get(this)[audioElement].src = URL.createObjectURL(ms);
      p.get(this)[mediaSourcePromise] = new Promise((resolve) => {
        ms.addEventListener("sourceopen", resolve, {
          once: true,
        });
      });
    } catch (e) {
      this[fireEvent](
        ERROR,
        `Media Source Extensions API in your browser is not supported`,
        "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API",
        e
      );
      p.get(this)[mediaSourcePromise] = new Promise(noOp);

      this[fallbackToAudioSrc]();
    }
  }

  [getOnStream](mimeType) {
    const sourceBufferPromise = this[getMimeType](mimeType).then((mimeType) =>
      this[createSourceBuffer](mimeType)
    );

    const onStream = async ({ stream }) => {
      this[fireEvent](STREAM, stream);
      await sourceBufferPromise;
      await this[appendSourceBuffer](stream);
    };

    const wrapper = p.get(this)[mseAudioWrapper];

    return wrapper
      ? async ({ stream }) => {
          for await (const fragment of wrapper.iterator(stream)) {
            await onStream({ stream: fragment });
          }
        }
      : onStream;
  }

  async [waitForSourceBuffer]() {
    return new Promise((resolve) => {
      p.get(this)[mediaSource].sourceBuffers[0].addEventListener(
        "updateend",
        resolve,
        {
          once: true,
        }
      );
    });
  }

  async [appendSourceBuffer](chunk) {
    if (this.state !== STOPPING) {
      p.get(this)[mediaSource].sourceBuffers[0].appendBuffer(chunk);
      await this[waitForSourceBuffer]();

      if (
        p.get(this)[audioElement].currentTime > BUFFER &&
        p.get(this)[sourceBufferRemoved] + BUFFER_INTERVAL * 1000 < Date.now()
      ) {
        p.get(this)[sourceBufferRemoved] = Date.now();
        p.get(this)[mediaSource].sourceBuffers[0].remove(
          0,
          p.get(this)[audioElement].currentTime - BUFFER
        );
        await this[waitForSourceBuffer]();
      }
    }
  }

  [fireEvent](event, ...args) {
    this._log[event](args);
    this.dispatchEvent(new CustomEvent(event, { detail: args }));
    p.get(this)[events][event](...args);
  }

  [fallbackToAudioSrc]() {
    this[fireEvent](
      ERROR,
      "Falling back to HTML5 audio with no metadata updates. See the console for details on the error."
    );

    const audio = p.get(this)[audioElement];
    audio.crossOrigin = "anonymous";

    this.play = async () => {
      if (p.get(this)[state] !== PLAYING) {
        audio.addEventListener("canplay", p.get(this)[onAudioCanPlay], {
          once: true,
        });
        audio.src = p.get(this)[endpoint];

        await new Promise((resolve) => {
          this.addEventListener("play", resolve, { once: true });
        });
      }
    };

    this.stop = () => {
      audio.removeEventListener("canplay", p.get(this)[onAudioCanPlay]);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();

      this[state] = STOPPED;
      this[fireEvent](STOP);
    };

    p.get(this)[mediaSourcePromise].then(() => this.play());
  }
}

module.exports = IcecastMetadataPlayer;
