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
const ISOBMFFAudioWrapper = require("isobmff-audio").default;

const BUFFER = 2; // seconds of audio to store in SourceBuffer
const STOPPED = Symbol();
const PLAYING = Symbol();

const noOp = () => {};

class IcecastMetadataPlayer {
  constructor(endpoint, options = {}) {
    this._endpoint = endpoint;
    this._audioElement = options.audioElement || new Audio();
    this._icyMetaInt = options.icyMetaInt;
    this._icyDetectionTimeout = options.icyDetectionTimeout;
    this._onStream = options.onStream || noOp;
    this._onError = options.onError || noOp;
    this._metadataTypes = options.metadataTypes || ["icy"];

    this._state = STOPPED;
    this._icecastReadableStream = {};
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: options.onMetadata || noOp,
      onMetadataEnqueue: options.onMetadataEnqueue || noOp,
    });

    this._createMediaSource();
  }

  get audioElement() {
    return this._audioElement;
  }

  get icyMetaInt() {
    return this._icecastReadableStream.icyMetaInt;
  }

  get metadataQueue() {
    return this._icecastMetadataQueue.metadataQueue;
  }

  get playing() {
    return this._state === PLAYING;
  }

  play() {
    if (this._state === STOPPED) {
      this._state = PLAYING;
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
          const onStream = this._getOnStream(res.headers.get("content-type"));

          this._icecastReadableStream = new IcecastReadableStream(res, {
            onMetadata: (value) =>
              this._icecastMetadataQueue.addMetadata(
                value,
                (this._sourceBuffer && this._sourceBuffer.timestampOffset) || 0,
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

          if (e.name !== "AbortError" && e.message !== "Error in body stream") {
            console.error(e);
            this._fallbackToAudioSrc();
            this._state = STOPPED;
          }
        });
    }
  }

  stop() {
    if (this._state === PLAYING) {
      this._state = STOPPED;
      this._controller.abort();
    }
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

    this._state = STOPPED;

    this.play = () => {
      if (this._state === STOPPED) {
        this._state = PLAYING;
        this._audioElement.src = this._endpoint;
        this._audioElement.play();
      }
    };

    this.stop = () => {
      if (this._state === PLAYING) {
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

      if (this._audioElement.currentTime > BUFFER) {
        this._sourceBuffer.remove(0, this._audioElement.currentTime - BUFFER);
        await this._waitForSourceBuffer();
      }
    }
  }

  async _fetchStream() {
    this._controller = new AbortController();

    const fetchStream = () =>
      fetch(this._endpoint, {
        method: "GET",
        cache: "no-store",
        headers: this._metadataTypes.includes("icy")
          ? { "Icy-MetaData": 1 }
          : {},
        signal: this._controller.signal,
      });

    return fetchStream().catch((e) => {
      if (this._metadataTypes.includes("icy") && e.name !== "AbortError") {
        this._metadataTypes = this._metadataTypes.filter(
          (metadata) => metadata !== "icy"
        );
        this._logError(
          "Network request failed, possibly due to a CORS issue. Trying again without ICY Metadata."
        );
        return fetchStream();
      }
      throw e;
    });
  }

  _getOnStream(mimeType) {
    const isobmff = new ISOBMFFAudioWrapper(mimeType);

    if (MediaSource.isTypeSupported(mimeType)) {
      return async ({ stream }) => this._appendSourceBuffer(stream, mimeType);
    } else if (false) {
      return async ({ stream }) => {
        for await (const fragment of isobmff.iterator(stream)) {
          await this._appendSourceBuffer(fragment, isobmff.mimeType);
        }
      };
    } else {
      this._logError(
        `Media Source Extensions API in your browser does not support ${mimeType} ${isobmff.mimeType}`,
        "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
      );

      throw new Error("Unsupported Codec");
    }
  }
}

module.exports = IcecastMetadataPlayer;
