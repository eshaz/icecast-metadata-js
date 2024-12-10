/**
 * @license
 * @see https://github.com/eshaz/icecast-metadata-js
 * @copyright 2021-2024 Ethan Halsall
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

import {
  p,
  noOp,
  state,
  event,
  // options,
  endpoints,
  metadataTypes,
  playbackMethod,
  audioContext,
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
  endpointOrder,
  retryTimeout,
  authentication,
  // methods
  fireEvent,
  attachAudioElement,
  shouldRetry,
  logError,
  getOptions,
  getNextEndpointGenerator,
  // variables
  endpointGenerator,
  hasIcy,
  abortController,
  playerState,
} from "./global.js";

import EventTargetPolyfill from "./EventTargetPolyfill.js";
import PlayerFactory from "./PlayerFactory.js";

let EventClass;

try {
  new window.EventTarget();
  EventClass = window.EventTarget;
} catch {
  EventClass = EventTargetPolyfill;
}

const playerFactory = Symbol();
const playerResetPromise = Symbol();
const events = Symbol();

const onAudioPause = Symbol();
const onAudioPlay = Symbol();
const onPlayReady = Symbol();
const onAudioError = Symbol();
const onAudioWaiting = Symbol();

const stopPlayback = Symbol();
const endPlayback = Symbol();
const retryAttempt = Symbol();
const retryTimeoutId = Symbol();

const play = Symbol();

export default class IcecastMetadataPlayer extends EventClass {
  static *[getNextEndpointGenerator](instance) {
    while (true) {
      const currentEndpoints = p.get(instance)[endpoints];
      for (const endpoint of currentEndpoints) {
        yield endpoint;
        if (p.get(instance)[endpoints] !== currentEndpoints) break;
      }
    }
  }

  static [getOptions](urls, options, instance = {}) {
    const newOptions = {
      [endpoints]:
        (urls && (Array.isArray(urls) ? urls : [urls])) ?? instance[endpoints],
      [bufferLength]: options.bufferLength ?? instance[bufferLength] ?? 1,
      [icyMetaInt]: options.icyMetaInt ?? instance[icyMetaInt],
      [icyCharacterEncoding]:
        options.icyCharacterEncoding ?? instance[icyCharacterEncoding],
      [icyDetectionTimeout]:
        options.icyDetectionTimeout ?? instance[icyDetectionTimeout],
      [metadataTypes]: (options.metadataTypes ?? instance[metadataTypes]) || [
        "icy",
      ],
      [hasIcy]: (
        (options.metadataTypes ?? instance[metadataTypes]) || ["icy"]
      ).includes("icy"),
      [enableLogging]:
        options.enableLogging ?? instance[enableLogging] ?? false,
      [enableCodecUpdate]: Boolean(
        options.enableCodecUpdate ??
          instance[enableCodecUpdate] ??
          options.onCodecUpdate,
      ),
      [endpointOrder]:
        options.endpointOrder ?? instance[endpointOrder] ?? "ordered",
      [retryDelayRate]:
        options.retryDelayRate ?? instance[retryDelayRate] ?? 0.1,
      [retryDelayMin]: options.retryDelayMin ?? instance[retryDelayMin] ?? 0.5,
      [retryDelayMax]: options.retryDelayMax ?? instance[retryDelayMax] ?? 2,
      [retryTimeout]: options.retryTimeout ?? instance[retryTimeout] ?? 30,
      [playbackMethod]:
        (options.playbackMethod ?? instance[playbackMethod]) || "mediasource",
      [authentication]: options.authentication ?? instance[authentication],
    };

    if (
      newOptions[endpoints] !== instance[endpoints] &&
      newOptions[endpointOrder] === "random"
    )
      newOptions[endpoints] = newOptions[endpoints].sort(
        () => 0.5 - Math.random(),
      );

    return newOptions;
  }

  /**
   * @constructor
   * @param {string|string[]} endpoint Endpoint(s) of the Icecast compatible stream
   * @param {object} options Options object
   * @param {HTMLAudioElement} options.audioElement Audio element to play the stream
   * @param {Array} options.metadataTypes Array of metadata types to parse
   * @param {number} options.bufferLength Seconds of audio to buffer before starting playback
   * @param {number} options.icyMetaInt ICY metadata interval
   * @param {string} options.icyCharacterEncoding Character encoding to use for ICY metadata (defaults to "utf-8")
   * @param {number} options.icyDetectionTimeout ICY metadata detection timeout
   * @param {string} options.endpointOrder Order that a stream endpoint will be chosen when multiple endpoints are passed in.
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
   * @callback options.onRetryTimeout Called when connections attempts have timed out
   * @callback options.onSwitch Called when a switch event is triggered
   * @callback options.onCodecUpdate Called when the audio codec information has changed
   */
  constructor(urls, options = {}) {
    super();

    p.set(this, {
      // options
      [endpointGenerator]:
        IcecastMetadataPlayer[getNextEndpointGenerator](this),
      [audioElement]: options.audioElement || new Audio(),
      ...IcecastMetadataPlayer[getOptions](urls, options),
      // callbacks
      [events]: {
        [event.PLAY]: options.onPlay || noOp,
        [event.PLAY_READY]: noOp,
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
        [event.SWITCH]: options.onSwitch || noOp,
        [event.WARN]: (...messages) => {
          this[logError](console.warn, options.onWarn, messages);
        },
        [event.ERROR]: (...messages) => {
          this[logError](console.error, options.onError, messages);
        },
        [event.PLAYBACK_ERROR]: (...messages) => {
          if (this.state !== state.RETRYING) {
            this[fireEvent](event.ERROR, ...messages);

            this.stop();
          } else {
            p.get(this)[endPlayback]();
          }
        },
      },
      // variables
      [endPlayback]: () => {
        clearTimeout(p.get(this)[retryTimeoutId]);
        this.removeEventListener(event.STREAM_START, p.get(this)[endPlayback]);
        p.get(this)[audioElement].removeEventListener(
          "waiting",
          p.get(this)[onAudioWaiting],
        );

        try {
          p.get(this)[audioElement].pause();
        } catch (e) {
          p.get(this)[onAudioError](e);
        }

        try {
          p.get(this)[playerResetPromise] = p
            .get(this)
            [playerFactory].player.end();
        } catch {}
      },
      // audio element event handlers
      [onAudioPlay]: () => {
        this[play](onAudioPlay);
      },
      [onAudioPause]: () => {
        this.stop();
      },
      [onAudioError]: (e) => {
        const errors = {
          1: " MEDIA_ERR_ABORTED The fetching of the associated resource was aborted by the user's request.",
          2: " MEDIA_ERR_NETWORK Some kind of network error occurred which prevented the media from being successfully fetched, despite having previously been available.",
          3: " MEDIA_ERR_DECODE Despite having previously been determined to be usable, an error occurred while trying to decode the media resource, resulting in an error.",
          4: " MEDIA_ERR_SRC_NOT_SUPPORTED The associated resource or media provider object (such as a MediaStream) has been found to be unsuitable.",
          5: " MEDIA_ERR_ENCRYPTED",
        };

        const error = e?.target?.error || e;
        const player = p.get(this)[playerFactory].player;

        // try to switch containers when decode error is encountered with MediaSource playback
        if (
          player?.useNextContainer &&
          !player?.changingContainer &&
          error?.code > 2 &&
          this.state !== state.STOPPING &&
          this.state !== state.STOPPED
        ) {
          player.useNextContainer();
        }

        if (this.state !== state.STOPPED && !player?.changingContainer) {
          // iOS Safari throws an error when the MediaStream is reset, but this is fine
          this[fireEvent](
            event.PLAYBACK_ERROR,
            "The audio element encountered an error.",
            errors[error?.code] || e,
          );
        }
      },
      [onPlayReady]: () => {
        const audio = p.get(this)[audioElement];

        if (
          this.state === state.LOADING ||
          (!audio.loop &&
            this.state !== state.STOPPING &&
            this.state !== state.STOPPED)
        ) {
          audio
            .play()
            .then(() => {
              this[playerState] = state.PLAYING;
            })
            .catch((e) => {
              p.get(this)[onAudioError](e);
            });
        }
      },
      [stopPlayback]: noOp,
    });

    this[attachAudioElement]();
    this[playerState] = state.STOPPED;

    p.get(this)[playerFactory] = new PlayerFactory(this);
  }

  /**
   * @description Checks for MediaSource, WebAudio, and HTML5 support for a given codec
   * @param {string} type Codec / mime-type to check
   * @returns {mediasource: string, webaudio: string, html5: string} Object indicating if the codec is supported by the playback method
   */
  static canPlayType(type) {
    return PlayerFactory.canPlayType(type);
  }

  /**
   * @returns {HTMLAudioElement} The audio element associated with this instance
   */
  get audioElement() {
    return p.get(this)[audioElement];
  }

  /**
   * @returns {AudioContext} Statically initialized internal AudioContext
   */
  get [audioContext]() {
    return IcecastMetadataPlayer.constructor[audioContext];
  }

  /**
   * @returns {string} Current endpoint that is being played
   */
  get endpoint() {
    return p.get(this)[playerFactory].endpoint;
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
    return p.get(this)[playerFactory].player.metadataQueue;
  }

  /**
   * @returns {string} The current state ("loading", "playing", "stopping", "stopped", "retrying", "switching")
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

    this.addEventListener(event.PLAY_READY, p.get(this)[onPlayReady]);
  }

  /**
   * @description Remove event listeners from the audio element and this instance and stops playback
   */
  async detachAudioElement() {
    const audio = p.get(this)[audioElement];
    audio.removeEventListener("pause", p.get(this)[onAudioPause]);
    audio.removeEventListener("play", p.get(this)[onAudioPlay]);
    audio.removeEventListener("error", p.get(this)[onAudioError]);

    this.removeEventListener(event.PLAY_READY, p.get(this)[onPlayReady]);
    await this.stop();
  }

  /**
   * @description Plays the Icecast stream
   * @async Resolves when the audio element is playing
   */
  async play() {
    return this[play]();
  }

  async [play](source) {
    if (this.state === state.STOPPED) {
      if (source !== onAudioPlay && this.audioElement.paused)
        // start the audio element immediately after user action to prevent iOS Safari playback permissions issues
        this.audioElement.play();

      const playing = new Promise((resolve) => {
        this.addEventListener(event.PLAY, resolve, { once: true });
      });

      const streamEnd = new Promise((resolve) => {
        this.addEventListener(event.STREAM_END, resolve, { once: true });
      });

      p.get(this)[abortController] = new AbortController();
      this[playerState] = state.LOADING;
      this[fireEvent](event.LOAD);

      // prettier-ignore
      const tryFetching = async () =>
        p.get(this)[playerFactory].playStream()
          .then(async () => {
            if (this.state === state.SWITCHING) {
              this[fireEvent](event.SWITCH);
              return tryFetching();
            } else if (
              this.state !== state.STOPPING &&
              this.state !== state.STOPPED
            ) {
              // wait for any remaining audio to play through
              await playing;
              await streamEnd;
              await p.get(this)[playerFactory].player.waiting;
            }
          })
          .catch(async (e) => {
            if (e && e.name !== "AbortError") {
              if (await this[shouldRetry](e)) {
                this[fireEvent](event.RETRY);
                return tryFetching();
              }

              p.get(this)[abortController].abort(); // stop fetch if is wasn't aborted

              if (
                this.state !== state.STOPPING &&
                this.state !== state.STOPPED
              ) {
                this[fireEvent](
                  event.ERROR,
                  e.message.match(/network|fetch|offline|codec/i) ? e : e.stack,
                  e
                );
              }
            }
          });

      new Promise((resolve, reject) => {
        // stop any pending playback operation when stop is called
        p.get(this)[stopPlayback] = reject;

        tryFetching().then(resolve);
      })
        .catch((e) => {
          if (this.state !== state.STOPPING) throw e;
        })
        .finally(() => {
          p.get(this)[endPlayback]();

          this[fireEvent](event.STOP);
          this[playerState] = state.STOPPED;
        });

      await playing;
    }
  }

  /**
   * @description Stops playing the Icecast stream
   * @async Resolves when the icecast stream has stopped
   */
  async stop() {
    if (this.state !== state.STOPPED && this.state !== state.STOPPING) {
      this[playerState] = state.STOPPING;
      p.get(this)[abortController].abort();
      p.get(this)[stopPlayback]();

      await new Promise((resolve) => {
        this.addEventListener(event.STOP, resolve, { once: true });
      });
      p.get(this)[playerFactory].player.enablePlayButton();
    }
  }

  /**
   * @description Switches the Icecast stream endpoint during playback
   * @async Resolves when playback begins from the new source
   */
  async switchEndpoint(newEndpoints, newOptions) {
    if (this.state !== state.STOPPED && this.state !== state.STOPPING) {
      const instance = p.get(this);
      Object.assign(
        instance,
        IcecastMetadataPlayer[getOptions](newEndpoints, newOptions, instance),
      );

      return instance[playerFactory].switchStream();
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
            1000 *
            (p.get(this)[retryDelayRate] + 1) ** p.get(this)[retryAttempt]++,
          p.get(this)[retryDelayMax] * 1000,
        ); // exponential backoff

        setTimeout(
          () => {
            this.removeEventListener(state.STOPPING, resolve);
            resolve();
          },
          delay + delay * 0.3 * Math.random(),
        ); // jitter
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
      this[fireEvent](event.ERROR, error.name, error);
      this[playerState] = state.RETRYING;

      if (p.get(this)[hasIcy]) {
        this[fireEvent](
          event.WARN,
          "This stream was requested with ICY metadata.",
          'If there is a CORS preflight failure, try removing "icy" from the metadataTypes option.',
          "See https://github.com/eshaz/icecast-metadata-js#cors for more details.",
        );
      }

      const audioWaiting = new Promise((resolve) => {
        p.get(this)[onAudioWaiting] = resolve;
        p.get(this)[audioElement].addEventListener(
          "waiting",
          p.get(this)[onAudioWaiting],
          {
            once: true,
          },
        );
      });

      // wait for whichever is longer, audio element waiting or retry timeout
      p.get(this)[retryTimeoutId] = setTimeout(
        () => {
          audioWaiting.then(() => {
            if (p.get(this)[playerState] === state.RETRYING) {
              this[fireEvent](event.RETRY_TIMEOUT);
              this.stop();
            }
          });
        },
        p.get(this)[retryTimeout] * 1000,
      );

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
        messages.reduce((acc, message) => acc + "\n  " + message, ""),
      );
    }
    if (callback) callback(...messages);
  }
}

const AudioContext = window.AudioContext || window.webkitAudioContext;

// statically initialize audio context and start using a DOM event
if (AudioContext && !IcecastMetadataPlayer.constructor[audioContext]) {
  IcecastMetadataPlayer.constructor[audioContext] = "audio context pending";

  const audioCtxErrorHandler = (e) => {
    console.error(
      "icecast-metadata-js",
      "Failed to start the AudioContext. WebAudio playback will not be possible.",
      e,
    );
  };

  // hack for iOS Audio element controls support
  // iOS will only enable AudioContext.resume() when called directly from a UI event
  // https://stackoverflow.com/questions/57510426
  const events = ["touchstart", "touchend", "mousedown", "keydown"];

  const unlock = () => {
    events.forEach((e) => document.removeEventListener(e, unlock));

    const audioCtx = new AudioContext({
      latencyHint: "interactive",
    });

    audioCtx.destination.channelCount = audioCtx.destination.maxChannelCount;

    audioCtx
      .resume()
      .then(() => {
        // hack for iOS to continue playing while locked
        audioCtx
          .createScriptProcessor(2 ** 14, 2, 2)
          .connect(audioCtx.destination);

        audioCtx.onstatechange = () => {
          if (audioCtx.state !== "running")
            audioCtx.resume().catch(audioCtxErrorHandler);
        };
      })
      .catch(audioCtxErrorHandler);

    IcecastMetadataPlayer.constructor[audioContext] = audioCtx;
  };

  events.forEach((e) => document.addEventListener(e, unlock));
}
