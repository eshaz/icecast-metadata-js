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

const EventTargetPolyfill = require("./EventTargetPolyfill");
const {
  IcecastReadableStream,
  IcecastMetadataQueue,
} = require("icecast-metadata-js");
const MediaSourcePlayer = require("./players/MediaSourcePlayer");
const HTML5Player = require("./players/HTML5Player");

const noOp = () => {};
const p = new WeakMap();

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

const retryDelayRate = Symbol();
const retryDelayMin = Symbol();
const retryDelayMax = Symbol();
const retryTimeout = Symbol();

// variables
const hasIcy = Symbol();
const icecastReadableStream = Symbol();
const icecastMetadataQueue = Symbol();
const abortController = Symbol();
const events = Symbol();
const state = Symbol();
const onAudioPause = Symbol();
const onAudioPlay = Symbol();
const onAudioCanPlay = Symbol();
const onAudioError = Symbol();
const resetPlayback = Symbol();
const retryAttempt = Symbol();
const retryTimeoutId = Symbol();
const onAudioWaiting = Symbol();

// private methods
const fireEvent = Symbol();
const fallbackToHTML5 = Symbol();

const playResponse = Symbol();
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
    p.get(this)[retryDelayRate] = (options.retryDelayRate || 0.1) + 1;
    p.get(this)[retryDelayMin] = (options.retryDelayMin || 0.5) * 1000;
    p.get(this)[retryDelayMax] = (options.retryDelayMax || 2) * 1000;
    p.get(this)[retryTimeout] = (options.retryTimeout || 30) * 1000;

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

    p.get(this)[icecastMetadataQueue] = new IcecastMetadataQueue({
      onMetadataUpdate: (...args) => this[fireEvent](METADATA, ...args),
      onMetadataEnqueue: (...args) =>
        this[fireEvent](METADATA_ENQUEUE, ...args),
    });

    p.get(this)[resetPlayback] = () => {
      clearTimeout(p.get(this)[retryTimeoutId]);
      this.removeEventListener(STREAM_START, p.get(this)[resetPlayback]);
      p.get(this)[audioElement].removeEventListener(
        "waiting",
        p.get(this)[onAudioWaiting]
      );

      p.get(this)[audioElement].pause();
      p.get(this)[icecastMetadataQueue].purgeMetadataQueue();
      this._playerResetPromise = this._player.reset();
    };

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

      if (this.state !== RETRYING) {
        this.stop();
      } else {
        p.get(this)[resetPlayback]();
      }
    };

    this[attachAudioElement]();
    this[state] = STOPPED;

    this._playerParams = {
      endpoint: p.get(this)[endpoint],
      hasIcy: p.get(this)[hasIcy],
      audioElement: p.get(this)[audioElement],
      enableLogging: p.get(this)[enableLogging],
      icecastMetadataQueue: p.get(this)[icecastMetadataQueue],
      fireEvent: this[fireEvent].bind(this),
      state: () => this.state,
      events: {
        STREAM: STREAM,
        CODEC_UPDATE: CODEC_UPDATE,
        ERROR: ERROR,
      },
    };

    if (MediaSourcePlayer.isSupported()) {
      this._player = new MediaSourcePlayer(this._playerParams);
    } else {
      this._player = new HTML5Player(this._playerParams);

      this[fireEvent](
        WARN,
        `Media Source Extensions API in your browser is not supported. Using two requests, one for audio, and another for metadata.`,
        "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
      );
    }

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
    audio.addEventListener("canplay", p.get(this)[onAudioCanPlay]);
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
        this._player
          .fetchStream(p.get(this)[abortController])
          .then(async (res) => {
            this[fireEvent](STREAM_START);

            return this[playResponse](res).finally(() => {
              this[fireEvent](STREAM_END);
            });
          })
          .catch(async (e) => {
            if (e.name !== "AbortError") {
              if (await this[shouldRetry](e)) {
                this[fireEvent](RETRY);
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

      tryFetching().finally(() => {
        p.get(this)[resetPlayback]();

        if (error && !error.message.match(/network|fetch|offline/))
          this[fallbackToHTML5]();

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
    if (p.get(this)[retryTimeout] === 0) return false;

    if (p.get(this)[state] === RETRYING) {
      // wait for retry interval
      await new Promise((resolve) => {
        this.addEventListener(STOPPING, resolve, { once: true });

        const delay = Math.min(
          p.get(this)[retryDelayMin] *
            p.get(this)[retryDelayRate] ** p.get(this)[retryAttempt]++,
          p.get(this)[retryDelayMax]
        ); // exponential backoff

        setTimeout(() => {
          this.removeEventListener(STOPPING, resolve);
          resolve();
        }, delay + delay * 0.3 * Math.random()); // jitter
      });

      // ensure the retry hasn't been cancelled while waiting
      return p.get(this)[state] === RETRYING;
    }

    if (
      p.get(this)[state] !== STOPPING &&
      p.get(this)[state] !== STOPPED &&
      (error.message.match(/network|fetch|offline|Error in body stream/i) ||
        error.name === "HTTP Response Error")
    ) {
      this[fireEvent](ERROR, error);
      this[state] = RETRYING;
      this.addEventListener(STREAM_START, p.get(this)[resetPlayback], {
        once: true,
      });

      if (p.get(this)[hasIcy]) {
        this[fireEvent](
          WARN,
          "This stream was requested with ICY metadata.",
          'If there is a CORS preflight failure, try removing "icy" from the metadataTypes option.',
          "See https://github.com/eshaz/icecast-metadata-js#cors for more details."
        );
      }

      const audioWaiting = new Promise((resolve) => {
        p.get(this)[onAudioWaiting] = resolve;
        p.get(this)[audioElement].addEventListener(
          "waiting",
          p.get(this)[onAudioWaiting],
          {
            once: true,
          }
        );
      });

      // wait for whichever is longer, audio element waiting or retry timeout
      p.get(this)[retryTimeoutId] = setTimeout(() => {
        audioWaiting.then(() => {
          if (p.get(this)[state] === RETRYING) {
            this[fireEvent](RETRY_TIMEOUT);
            this.stop();
          }
        });
      }, p.get(this)[retryTimeout]);

      p.get(this)[retryAttempt] = 0;
      return true;
    }

    return false;
  }

  async [playResponse](res) {
    p.get(this)[icecastReadableStream] = new IcecastReadableStream(res, {
      onMetadata: this._player.getOnMetadata(),
      onStream: this._player.getOnStream(res),
      onError: (...args) => this[fireEvent](WARN, ...args),
      metadataTypes: p.get(this)[metadataTypes],
      icyMetaInt: p.get(this)[icyMetaInt],
      icyDetectionTimeout: p.get(this)[icyDetectionTimeout],
    });

    await p.get(this)[icecastReadableStream].startReading();
  }

  [fireEvent](event, ...args) {
    this.dispatchEvent(new CustomEvent(event, { detail: args }));
    p.get(this)[events][event](...args);
  }

  [fallbackToHTML5]() {
    this[fireEvent](
      ERROR,
      "Falling back to HTML5 audio by using two requests: one for audio, and another for metadata.",
      "See the console for details on the error."
    );

    this._player = new HTML5Player(this._playerParams);
    this._playerResetPromise.then(() => this.play());
  }
}

module.exports = IcecastMetadataPlayer;
