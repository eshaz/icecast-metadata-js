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

import { IcecastMetadataQueue } from "icecast-metadata-js";
import {
  p,
  noOp,
  state,
  event,
  // options,
  endpoint,
  metadataTypes,
  audioElement,
  bufferLength,
  icyMetaInt,
  icyCharacterEncoding,
  icyDetectionTimeout,
  enableLogging,
  enableCodecUpdate,
  retryDelayMin,
  retryDelayMax,
  retryDelayRate,
  retryTimeout,
  // methods
  fireEvent,
  attachAudioElement,
  shouldRetry,
  logError,
  // variables
  hasIcy,
  icecastMetadataQueue,
  codecUpdateQueue,
  abortController,
} from "./global.js";

import EventTargetPolyfill from "./EventTargetPolyfill.js";
import PlayerFactory from "./PlayerFactory.js";
import MediaSourcePlayer from "./players/MediaSourcePlayer.js";
import HTML5Player from "./players/HTML5Player.js";
import WebAudioPlayer from "./players/WebAudioPlayer.js";

let EventClass;

try {
  new EventTarget();
  EventClass = EventTarget;
} catch {
  EventClass = EventTargetPolyfill;
}

const playbackMethod = Symbol();
const playerFactory = Symbol();
const playerResetPromise = Symbol();
const events = Symbol();
const playerState = Symbol();

const onAudioPause = Symbol();
const onAudioPlay = Symbol();
const onPlay = Symbol();
const onAudioError = Symbol();
const onAudioWaiting = Symbol();

const resetPlayback = Symbol();
const retryAttempt = Symbol();
const retryTimeoutId = Symbol();

export default class IcecastMetadataPlayer extends EventClass {
  /**
   * @constructor
   * @param {string} endpoint Endpoint of the Icecast compatible stream
   * @param {object} options Options object
   * @param {HTMLAudioElement} options.audioElement Audio element to play the stream
   * @param {Array} options.metadataTypes Array of metadata types to parse
   * @param {number} options.bufferLength Seconds of audio to buffer before starting playback
   * @param {number} options.icyMetaInt ICY metadata interval
   * @param {string} options.icyCharacterEncoding Character encoding to use for ICY metadata (defaults to "utf-8")
   * @param {number} options.icyDetectionTimeout ICY metadata detection timeout
   * @param {number} options.retryTimeout Number of seconds to wait before giving up on retries
   * @param {number} options.retryDelayRate Percentage of seconds to increment after each retry (how quickly to increase the back-off)
   * @param {number} options.retryDelayMin Minimum number of seconds between retries (start of the exponential back-off curve)
   * @param {number} options.retryDelayMax Maximum number of seconds between retries (end of the exponential back-off curve)
   * @param {boolean} options.enableLogging Set to `true` to enable warning and error logging to the console
   * @param {string} options.playbackMethod Sets the preferred playback method (mediasource (default), html5, webaudio)
   *
   * @callback options.onMetadata Called with metadata when synchronized with the audio
   * @callback options.onMetadataEnqueue Called with metadata when discovered on the response
   * @callback options.onError Called with message(s) when a fallback or error condition is met
   * @callback options.onWarn Called with message(s) when a warning condition is met
   * @callback options.onPlay Called when the audio element begins playing
   * @callback options.onLoad Called when stream request is started
   * @callback options.onStreamStart Called when stream requests begins to return data
   * @callback options.onBuffer Called when the audio buffer is being filled
   * @callback options.onStream Called when stream data is sent to the audio element
   * @callback options.onStreamEnd Called when the stream request completes
   * @callback options.onStop Called when the stream is completely stopped and all cleanup operations are complete
   * @callback options.onRetry Called when a connection retry is attempted
   * @callback options.onRetryTimeout Called when when connections attempts have timed out
   * @callback options.onCodecUpdate Called when the audio codec information has changed
   */
  constructor(url, options = {}) {
    super();

    p.set(this, {
      // options
      [endpoint]: url,
      [audioElement]: options.audioElement || new Audio(),
      [bufferLength]: options.bufferLength || 1,
      [icyMetaInt]: options.icyMetaInt,
      [icyCharacterEncoding]: options.icyCharacterEncoding,
      [icyDetectionTimeout]: options.icyDetectionTimeout,
      [metadataTypes]: options.metadataTypes || ["icy"],
      [hasIcy]: (options.metadataTypes || ["icy"]).includes("icy"),
      [enableLogging]: options.enableLogging || false,
      [enableCodecUpdate]:
        Boolean(options.onCodecUpdate) || options.enableCodecUpdate,
      [retryDelayRate]: (options.retryDelayRate || 0.1) + 1,
      [retryDelayMin]: (options.retryDelayMin || 0.5) * 1000,
      [retryDelayMax]: (options.retryDelayMax || 2) * 1000,
      [retryTimeout]: (options.retryTimeout || 30) * 1000,
      [playbackMethod]: options.playbackMethod,
      // callbacks
      [events]: {
        [event.PLAY]: options.onPlay || noOp,
        [event.LOAD]: options.onLoad || noOp,
        [event.STREAM_START]: options.onStreamStart || noOp,
        [event.BUFFER]: options.onBuffer || noOp,
        [event.STREAM]: options.onStream || noOp,
        [event.STREAM_END]: options.onStreamEnd || noOp,
        [event.METADATA]: options.onMetadata || noOp,
        [event.METADATA_ENQUEUE]: options.onMetadataEnqueue || noOp,
        [event.CODEC_UPDATE]: options.onCodecUpdate || noOp,
        [event.STOP]: options.onStop || noOp,
        [event.RETRY]: options.onRetry || noOp,
        [event.RETRY_TIMEOUT]: options.onRetryTimeout || noOp,
        [event.WARN]: (...messages) => {
          this[logError](console.warn, options.onWarn, messages);
        },
        [event.ERROR]: (...messages) => {
          this[logError](console.error, options.onError, messages);
        },
      },
      // variables
      [icecastMetadataQueue]: new IcecastMetadataQueue({
        onMetadataUpdate: (...args) => this[fireEvent](event.METADATA, ...args),
        onMetadataEnqueue: (...args) =>
          this[fireEvent](event.METADATA_ENQUEUE, ...args),
      }),
      [codecUpdateQueue]: new IcecastMetadataQueue({
        onMetadataUpdate: (...args) =>
          this[fireEvent](event.CODEC_UPDATE, ...args),
      }),
      [resetPlayback]: () => {
        clearTimeout(p.get(this)[retryTimeoutId]);
        this.removeEventListener(
          event.STREAM_START,
          p.get(this)[resetPlayback]
        );
        p.get(this)[audioElement].removeEventListener(
          "waiting",
          p.get(this)[onAudioWaiting]
        );

        if (this.state !== state.RETRYING) {
          p.get(this)[audioElement].pause();
          p.get(this)[icecastMetadataQueue].purgeMetadataQueue();
          p.get(this)[codecUpdateQueue].purgeMetadataQueue();
          p.get(this)[playerResetPromise] = p
            .get(this)
            [playerFactory].player.reset();
        }
      },
      // audio element event handlers
      [onAudioPlay]: () => {
        this.play();
      },
      [onAudioPause]: () => {
        this.stop();
      },
      [onAudioError]: (e) => {
        const errors = {
          1: "MEDIA_ERR_ABORTED The fetching of the associated resource was aborted by the user's request.",
          2: "MEDIA_ERR_NETWORK Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available.",
          3: "MEDIA_ERR_DECODE Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error.",
          4: "MEDIA_ERR_SRC_NOT_SUPPORTED The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable.",
          5: "MEDIA_ERR_ENCRYPTED",
        };

        if (this.state !== state.RETRYING) {
          this[fireEvent](
            event.ERROR,
            "The audio element encountered an error",
            errors[e.target.error.code] || `Code: ${e.target.error.code}`,
            `Message: ${e.target.error.message}`
          );

          this.stop();
        } else {
          p.get(this)[resetPlayback]();
        }
      },
      [onPlay]: () => {
        const audio = p.get(this)[audioElement];

        if (
          this.state === state.LOADING ||
          (!audio.loop &&
            this.state !== state.STOPPING &&
            this.state !== state.STOPPED)
        ) {
          audio.play();
          this[playerState] = state.PLAYING;
        }
      },
    });

    this[attachAudioElement]();
    this[playerState] = state.STOPPED;

    p.get(this)[playerFactory] = new PlayerFactory(
      this,
      p.get(this)[playbackMethod],
      p.get(this)[icyCharacterEncoding]
    );
  }

  /**
   * @description Checks for MediaSource and HTML5 support for a given codec
   * @param {string} type Codec / mime-type to check
   * @returns {mediasource: string, html5: string} Object indicating if the codec is supported by MediaSource or HTML5 audio
   */
  static canPlayType(type) {
    return {
      mediasource: MediaSourcePlayer.canPlayType(type),
      html5: HTML5Player.canPlayType(type),
      webaudio: WebAudioPlayer.canPlayType(type),
    };
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
    return p.get(this)[playerFactory].icyMetaInt;
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
    return p.get(this)[playerState];
  }

  /**
   * @returns {string} The playback method ("mediasource", "webaudio", "html5")
   */
  get playbackMethod() {
    return p.get(this)[playerFactory].playbackMethod;
  }

  set [playerState](_state) {
    this.dispatchEvent(new CustomEvent(_state));
    p.get(this)[playerState] = _state;
  }

  [attachAudioElement]() {
    // audio events
    const audio = p.get(this)[audioElement];
    audio.addEventListener("pause", p.get(this)[onAudioPause]);
    audio.addEventListener("play", p.get(this)[onAudioPlay]);
    audio.addEventListener("error", p.get(this)[onAudioError]);
    this.addEventListener("play", p.get(this)[onPlay]);
  }

  /**
   * @description Remove event listeners from the audio element and this instance and stops playback
   */
  async detachAudioElement() {
    const audio = p.get(this)[audioElement];
    audio.removeEventListener("pause", p.get(this)[onAudioPause]);
    audio.removeEventListener("play", p.get(this)[onAudioPlay]);
    audio.removeEventListener("error", p.get(this)[onAudioError]);
    this.removeEventListener("play", p.get(this)[onPlay]);

    await this.stop();
  }

  /**
   * @description Plays the Icecast stream
   * @async Resolves when the audio element is playing
   */
  async play() {
    if (this.state === state.STOPPED) {
      p.get(this)[abortController] = new AbortController();
      this[playerState] = state.LOADING;
      this[fireEvent](event.LOAD);

      // prettier-ignore
      const tryFetching = async () =>
        p.get(this)[playerFactory].playStream()
          .catch(async (e) => {
            if (e.name !== "AbortError") {
              if (await this[shouldRetry](e)) {
                this[fireEvent](event.RETRY);
                return tryFetching();
              }

              p.get(this)[abortController].abort(); // stop fetch if is wasn't aborted

              if (
                p.get(this)[playerState] !== state.STOPPING &&
                p.get(this)[playerState] !== state.STOPPED
              ) {
                this[fireEvent](
                  event.ERROR,
                  e.message.match(/network|fetch|offline|codec/i) ? e : e.stack
                );
              }
            }
          });

      tryFetching().finally(() => {
        p.get(this)[resetPlayback]();

        this[fireEvent](event.STOP);
        this[playerState] = state.STOPPED;
      });

      await new Promise((resolve) => {
        this.addEventListener(event.PLAY, resolve, { once: true });
      });
    }
  }

  /**
   * @description Stops playing the Icecast stream
   * @async Resolves the icecast stream has stopped
   */
  async stop() {
    if (this.state !== state.STOPPED && this.state !== state.STOPPING) {
      this[playerState] = state.STOPPING;
      p.get(this)[abortController].abort();

      await new Promise((resolve) => {
        this.addEventListener(event.STOP, resolve, { once: true });
      });
    }
  }

  async [shouldRetry](error) {
    if (p.get(this)[retryTimeout] === 0) return false;

    if (p.get(this)[playerState] === state.RETRYING) {
      // wait for retry interval
      await new Promise((resolve) => {
        this.addEventListener(state.STOPPING, resolve, { once: true });

        const delay = Math.min(
          p.get(this)[retryDelayMin] *
            p.get(this)[retryDelayRate] ** p.get(this)[retryAttempt]++,
          p.get(this)[retryDelayMax]
        ); // exponential backoff

        setTimeout(() => {
          this.removeEventListener(state.STOPPING, resolve);
          resolve();
        }, delay + delay * 0.3 * Math.random()); // jitter
      });

      // ensure the retry hasn't been cancelled while waiting
      return p.get(this)[playerState] === state.RETRYING;
    }

    if (
      p.get(this)[playerState] !== state.STOPPING &&
      p.get(this)[playerState] !== state.STOPPED &&
      (error.message.match(/network|fetch|offline|Error in body stream/i) ||
        error.name === "HTTP Response Error")
    ) {
      this[fireEvent](event.ERROR, error);
      this[playerState] = state.RETRYING;
      this.addEventListener(event.STREAM_START, p.get(this)[resetPlayback], {
        once: true,
      });

      if (p.get(this)[hasIcy]) {
        this[fireEvent](
          event.WARN,
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
          if (p.get(this)[playerState] === state.RETRYING) {
            this[fireEvent](event.RETRY_TIMEOUT);
            this.stop();
          }
        });
      }, p.get(this)[retryTimeout]);

      p.get(this)[retryAttempt] = 0;
      return true;
    }

    return false;
  }

  [fireEvent](event, ...args) {
    this.dispatchEvent(new CustomEvent(event, { detail: args }));
    p.get(this)[events][event](...args);
  }

  [logError](consoleFunction, callback, messages) {
    if (p.get(this)[enableLogging]) {
      consoleFunction(
        "icecast-metadata-js",
        messages.reduce((acc, message) => acc + "\n  " + message, "")
      );
    }
    if (callback) callback(...messages);
  }
}
