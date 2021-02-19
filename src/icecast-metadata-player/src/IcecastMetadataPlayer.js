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

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer

// State
const STOPPED = Symbol("stopped");
const LOADING = Symbol("loading");
const PLAYING = Symbol("playing");
const RETRYING = Symbol("retrying");
const ERROR = Symbol("error");

const noOp = () => {};

class IcecastMetadataPlayer {
  /**
   * @constructor
   * @param {string} endpoint Endpoint of the Icecast compatible stream
   * @param {object} options Options object
   * @param {HTMLAudioElement} options.audioElement Audio element to play the stream
   * @param {Array} options.metadataTypes Array of metadata types to parse
   * @param {number} options.icyMetaInt ICY metadata interval
   * @param {number} options.icyDetectionTimeout ICY metadata detection timeout
   *
   * @callback options.onStream Called when stream audio data is returned
   * @callback options.onMetadata Called with metadata when synchronized with the audio
   * @callback options.onMetadataEnqueue Called with metadata when discovered on the response
   * @callback options.onCodecUpdate Called when the audio codec information has changed
   * @callback options.onError Called with a message when a fallback or error condition is met
   */
  constructor(endpoint, options = {}) {
    this._endpoint = endpoint;

    // options
    this._audioElement = options.audioElement || new Audio();
    this._icyMetaInt = options.icyMetaInt;
    this._icyDetectionTimeout = options.icyDetectionTimeout;
    this._metadataTypes = options.metadataTypes || ["icy"];
    this._hasIcy = this._metadataTypes.includes("icy");

    // callbacks
    this._onStream = options.onStream || noOp;    
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: options.onMetadata || noOp,
      onMetadataEnqueue: options.onMetadataEnqueue || noOp,
    });
    this._onPlay = options.onPlay || noOp;
    this._onStop = options.onStop || noOp;
    this._onLoading = options.onLoading || noOp;
    this._onRetrying = options.onRetrying || noOp;
    this._onError = options.onError || noOp;

    this._onCodecUpdate = options.onCodecUpdate || noOp;
    this._playerState = STOPPED;
    this._icecastReadableStream = {};


    this._createMediaSource();
  }

  /**
   * @returns {HTMLAudioElement} The audio element associated with this instance
   */
  get audioElement() {
    return this._audioElement;
  }

  /**
   * @returns {number} The ICY metadata interval in number of bytes for this instance
   */
  get icyMetaInt() {
    return this._icecastReadableStream.icyMetaInt;
  }

  /**
   * @returns {Array<Metadata>} Array of enqueued metadata objects in FILO order
   */
  get metadataQueue() {
    return this._icecastMetadataQueue.metadataQueue;
  }

  /**
   * @returns {boolean} The current playing state
   */
  get playing() {
    return this._state === PLAYING;
  }

  /**
   * @description Plays the Icecast stream
   */
  play() {
    if (this._state !== PLAYING) {
      this._state = LOADING;
      this._createMediaSource();

      // allow for remote control pause
      this._audioElement.addEventListener(
        "pause",
        () => {
          this.stop();
          this._createMediaSource();
        },
        { once: true }
      );

      this._audioElement.addEventListener(
        "canplay",
        () => {
          this._audioElement.play();
        },
        { once: true }
      );

      this._fetchStream()
        .then(async (res) => {
          this._state = PLAYING;
          const onStream = this._getOnStream(res.headers.get("content-type"));

          this._icecastReadableStream = new IcecastReadableStream(res, {
            onMetadata: (value) =>
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
              ),
            onStream,
            metadataTypes: this._metadataTypes,
            icyMetaInt: this._icyMetaInt,
            icyDetectionTimeout: this._icyDetectionTimeout,
          });

          await this._icecastReadableStream.startReading();
        })
        .catch(async (e) => {
          this._icecastMetadataQueue.purgeMetadataQueue();
          this._audioElement.pause();
          this._sourceBuffer = null;
          this._state = STOPPED;

          if (e.name !== "AbortError" && e.message !== "Error in body stream") {
            console.error(e);
            this._fallbackToAudioSrc();
          }
        });
    }
  }

  /**
   * @description Stops playing the Icecast stream
   */
  stop() {
    if (this._state === LOADING || this._state === PLAYING) {
      this._controller.abort();
    }
  }

  get _state() {
    return this._playerState
  }

  set _state(state) {
    this._playerState = state;

    const events = {
      [PLAYING]: () => {console.log("playing"); this._onPlay()},
      [STOPPED]: () => {console.log("stopped"); this._onStop()},
      [LOADING]: () => {console.log("loading"); this._onLoading()},
      [RETRYING]:() => {console.log("retrying"); this._onRetrying()}
    }
    
    events[state]();
  }

  _logError(...messages) {
    console.warn(
      "icecast-metadata-js",
      messages.reduce((acc, message) => acc + "\n  " + message, "")
    );

    this._onError(messages[0]);
  }

  _fallbackToAudioSrc() {
    this._logError(
      "Falling back to HTML5 audio with no metadata updates. See the console for details on the error."
    );

    this.play = () => {
      if (this._state !== PLAYING) {
        this._state = PLAYING;
        this._audioElement.src = this._endpoint;
        this._audioElement.play();
      }
    };

    this.stop = () => {
      if (this._state !== STOPPED) {
        this._state = STOPPED;
        this._audioElement.pause();
        this._audioElement.removeAttribute("src");
        this._audioElement.load();
      }
    };

    this.play();
  }

  _createMediaSource() {
    this._sourceBuffer = null;
    this._mediaSource = new MediaSource();
    this._audioElement.src = URL.createObjectURL(this._mediaSource);
  }

  async _createSourceBuffer(mimeType) {
    this._sourceBufferRemoved = 0;
    if (!MediaSource.isTypeSupported(mimeType)) {
      this._logError(
        `Media Source Extensions API in your browser does not support ${mimeType}`,
        "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
      );
      throw new Error("Unsupported Codec");
    }

    if (this._mediaSource.readyState === "open") {
      this._sourceBuffer = this._mediaSource.addSourceBuffer(mimeType);
      this._sourceBuffer.mode = "sequence";
    } else {
      await new Promise((resolve) => {
        this._mediaSource.addEventListener(
          "sourceopen",
          () => {
            this._sourceBuffer = this._mediaSource.addSourceBuffer(mimeType);
            this._sourceBuffer.mode = "sequence";
            resolve();
          },
          { once: true }
        );
      });
    }
  }

  async _waitForSourceBuffer() {
    return new Promise((resolve) => {
      this._sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });
  }

  async _appendSourceBuffer(chunk, mimeType) {
    if (!this._sourceBuffer) await this._createSourceBuffer(mimeType);

    if (this._mediaSource.sourceBuffers.length) {
      this._sourceBuffer.appendBuffer(chunk);
      await this._waitForSourceBuffer();

      if (
        this._audioElement.currentTime > BUFFER &&
        this._sourceBufferRemoved + BUFFER_INTERVAL * 1000 < Date.now()
      ) {
        this._sourceBufferRemoved = Date.now();
        this._sourceBuffer.remove(0, this._audioElement.currentTime - BUFFER);
        await this._waitForSourceBuffer();
      }
    }
  }

  async _fetchStream() {
    this._controller = new AbortController();

    const fetchStream = (headers = {}) =>
      fetch(this._endpoint, {
        method: "GET",
        headers,
        signal: this._controller.signal,
      });

    if (!this._hasIcy) return fetchStream();

    return fetchStream({ "Icy-MetaData": 1 }).catch((e) => {
      if (e.name !== "AbortError") {
        this._logError(
          "Network request failed, possibly due to a CORS issue. Trying again without ICY Metadata."
        );
        return fetchStream();
      }
      throw e;
    });
  }

  _getOnStream(mimeType) {
    if (MediaSource.isTypeSupported(mimeType))
      return async ({ stream }) => {
        this._onStream(stream);
        await this._appendSourceBuffer(stream, mimeType);
      };

    const isobmff = new MSEAudioWrapper(mimeType, {
      onCodecUpdate: this._onCodecUpdate,
    });

    return async ({ stream }) => {
      for await (const fragment of isobmff.iterator(stream)) {
        this._onStream(fragment);
        await this._appendSourceBuffer(fragment, isobmff.mimeType);
      }
    };
  }
}

module.exports = IcecastMetadataPlayer;
