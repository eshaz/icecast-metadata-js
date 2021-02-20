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

const noOp = () => {};
const p = new WeakMap();

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer

// State
const LOADING = "loading";
const PLAYING = "playing";
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
const ERROR = "error";

// options
const metadataTypes = Symbol();
const audioElement = Symbol();
const icyMetaInt = Symbol();
const icyDetectionTimeout = Symbol();
const enableLogging = Symbol();
const endpoint = Symbol();

// variables
const hasIcy = Symbol();
const icecastReadableStream = Symbol();
const icecastMetadataQueue = Symbol();
const abortController = Symbol();
const mediaSource = Symbol();
const sourceBufferRemoved = Symbol();
const events = Symbol();
const state = Symbol();

const log = Symbol();

// private methods
const fireEvent = Symbol();
const logError = Symbol();
const fallbackToAudioSrc = Symbol();
const createMediaSource = Symbol();
const getMimeType = Symbol();
const waitForSourceBuffer = Symbol();
const appendSourceBuffer = Symbol();
const fetchStream = Symbol();
const getOnStream = Symbol();

class IcecastMetadataPlayer extends EventTarget {
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
   * @callback options.onError Called with a message when a fallback or error condition is met
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
      [ERROR]: (...messages) => {
        if (p.get(this)[enableLogging]) this[logError](...messages);
        if (options.onError) options.onError(messages[0]);
      },
    };

    p.get(this)[log] = {
      [PLAY]: (event) => console.log(event),
      [LOAD]: (event) => console.log(event),
      [STREAM_START]: (event) => console.log(event),
      [STREAM]: noOp,
      [STREAM_END]: (event) => console.log(event),
      [METADATA]: noOp,
      [METADATA_ENQUEUE]: noOp,
      [CODEC_UPDATE]: noOp,
      [STOP]: (event) => console.log(event),
      [RETRY]: (event) => console.log(event),
      [RETRY_TIMEOUT]: (event) => console.log(event),
      [ERROR]: (event) => console.log(event),
    };

    p.get(this)[icecastMetadataQueue] = new IcecastMetadataQueue({
      onMetadataUpdate: (...args) => this[fireEvent](METADATA, ...args),
      onMetadataEnqueue: (...args) =>
        this[fireEvent](METADATA_ENQUEUE, ...args),
    });

    p.get(this)[state] = STOPPED;
    p.get(this)[icecastReadableStream] = {};

    p.get(this)[audioElement].src = URL.createObjectURL(new MediaSource());
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
   * @returns {boolean} The current playing state
   */
  get playing() {
    return this.state === PLAYING;
  }

  /**
   * @returns {string} The current state ("playing", "stopped", "loading", "retrying")
   */
  get state() {
    return p.get(this)[state];
  }

  /**
   * @description Plays the Icecast stream
   */
  play() {
    if (this.state === STOPPED) {
      p.get(this)[state] = LOADING;
      this[fireEvent](LOAD);

      // allow for pause integration with browser
      p.get(this)[audioElement].addEventListener(
        "pause",
        () => {
          p.get(this)[audioElement].src = URL.createObjectURL(
            new MediaSource()
          );
          this.stop();
        },
        { once: true }
      );

      this[fetchStream]()
        .then(async (res) => {
          if (!res.ok) {
            const error = new Error(`${res.status} received from ${res.url}`);
            error.name = "HTTP Response Error";
            throw error;
          }

          this[fireEvent](STREAM_START);

          p.get(this)[audioElement].addEventListener(
            "canplay",
            () => {
              p.get(this)[state] = PLAYING;
              this[fireEvent](PLAY);
              p.get(this)[audioElement].play();
            },
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
                      ? p
                          .get(this)
                          [mediaSource].sourceBuffers[0].buffered.end(0)
                      : 0
                  )) ||
                  0,
                p.get(this)[audioElement].currentTime
              );
            },
            onStream: this[getOnStream](
              this[getMimeType](res.headers.get("content-type")).then(
                this[createMediaSource].bind(this)
              )
            ),
            metadataTypes: p.get(this)[metadataTypes],
            icyMetaInt: p.get(this)[icyMetaInt],
            icyDetectionTimeout: p.get(this)[icyDetectionTimeout],
          });

          await p.get(this)[icecastReadableStream].startReading();
          this[fireEvent](STREAM_END);
        })
        .catch(async (e) => {
          this[fireEvent](STREAM_END);
          p.get(this)[icecastMetadataQueue].purgeMetadataQueue();
          p.get(this)[audioElement].pause();

          if (e.name !== "AbortError") {
            this[fireEvent](ERROR, e);

            // retry any potentially recoverable errors
            if (
              e.name !== "HTTP Response Error" &&
              e.message !== "Error in body stream" &&
              e.message !== "Failed to fetch"
            ) {
              this[fallbackToAudioSrc]();
            }
          }
        })
        .finally(() => {
          p.get(this)[state] = STOPPED;
          this[fireEvent](STOP);
        });
    }
  }

  /**
   * @description Stops playing the Icecast stream
   */
  stop() {
    if (p.get(this)[state] !== STOPPED) {
      p.get(this)[abortController].abort();
    }
  }

  async [fetchStream]() {
    p.get(this)[abortController] = new AbortController();

    const fetchStream = (headers = {}) =>
      fetch(p.get(this)[endpoint], {
        method: "GET",
        headers,
        signal: p.get(this)[abortController].signal,
      });

    if (!p.get(this)[hasIcy]) return fetchStream();

    return fetchStream({ "Icy-MetaData": 1 }).catch((e) => {
      if (e.name !== "AbortError") {
        this[fireEvent](
          ERROR,
          "Network request failed, possibly due to a CORS issue. Trying again without ICY Metadata."
        );
        return fetchStream();
      }
      throw e;
    });
  }

  async [getMimeType](inputMimeType) {
    if (MediaSource.isTypeSupported(inputMimeType)) {
      return inputMimeType;
    } else {
      return new Promise((onMimeType) => {
        p.get(this).mseAudioWrapper = new MSEAudioWrapper(inputMimeType, {
          onCodecUpdate: (...args) => this[fireEvent](CODEC_UPDATE, ...args),
          onMimeType,
        });
      }).then((mimeType) => {
        if (!MediaSource.isTypeSupported(mimeType)) {
          this[fireEvent](
            ERROR,
            `Media Source Extensions API in your browser does not support ${inputMimeType} or ${mimeType}`,
            "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
          );
          throw new Error("Unsupported Codec");
        }

        return mimeType;
      });
    }
  }

  async [createMediaSource](mimeType) {
    const ms = (p.get(this)[mediaSource] = new MediaSource());
    p.get(this)[audioElement].src = URL.createObjectURL(ms);
    p.get(this)[sourceBufferRemoved] = 0;

    await new Promise((resolve) => {
      ms.addEventListener(
        "sourceopen",
        () => {
          ms.addSourceBuffer(mimeType);
          ms.sourceBuffers[0].mode = "sequence";
          resolve();
        },
        { once: true }
      );
    });
  }

  [getOnStream](mediaSourcePromise) {
    const onStream = async ({ stream }) => {
      this[fireEvent](STREAM, stream);
      await mediaSourcePromise;
      await this[appendSourceBuffer](stream);
    };

    const mseAudioWrapper = p.get(this).mseAudioWrapper;

    if (mseAudioWrapper) {
      return async ({ stream }) => {
        for await (const fragment of mseAudioWrapper.iterator(stream)) {
          await onStream({ stream: fragment });
        }
      };
    } else {
      return onStream;
    }
  }

  async [waitForSourceBuffer](sb) {
    return new Promise((resolve) => {
      sb.addEventListener("updateend", resolve, {
        once: true,
      });
    });
  }

  async [appendSourceBuffer](chunk) {
    const sourceBuffer = p.get(this)[mediaSource].sourceBuffers[0];
    sourceBuffer.appendBuffer(chunk);
    await this[waitForSourceBuffer](sourceBuffer);

    if (
      p.get(this)[audioElement].currentTime > BUFFER &&
      p.get(this)[sourceBufferRemoved] + BUFFER_INTERVAL * 1000 < Date.now()
    ) {
      p.get(this)[sourceBufferRemoved] = Date.now();
      sourceBuffer.remove(0, p.get(this)[audioElement].currentTime - BUFFER);
      await this[waitForSourceBuffer](sourceBuffer);
    }
  }

  [fireEvent](event, ...args) {
    p.get(this)[log][event](event);
    this.dispatchEvent(new CustomEvent(event, { detail: args }));
    p.get(this)[events][event](...args);
  }

  [logError](...messages) {
    console.warn(
      "icecast-metadata-js",
      messages.reduce((acc, message) => acc + "\n  " + message, "")
    );
  }

  [fallbackToAudioSrc]() {
    this[fireEvent](
      ERROR,
      "Falling back to HTML5 audio with no metadata updates. See the console for details on the error."
    );

    this.play = () => {
      if (p.get(this)[state] !== PLAYING) {
        p.get(this)[state] = PLAYING;
        this[fireEvent](PLAY);
        p.get(this)[audioElement].src = p.get(this)[endpoint];
        p.get(this)[audioElement].play();
      }
    };

    this.stop = () => {
      if (p.get(this)[state] !== STOPPED) {
        p.get(this)[state] = STOPPED;
        this[fireEvent](STOP);
        p.get(this)[audioElement].pause();
        p.get(this)[audioElement].removeAttribute("src");
        p.get(this)[audioElement].load();
      }
    };

    this.play();
  }
}

module.exports = IcecastMetadataPlayer;
