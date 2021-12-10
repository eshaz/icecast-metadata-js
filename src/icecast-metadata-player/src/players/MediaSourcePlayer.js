import MSEAudioWrapper from "mse-audio-wrapper";

import {
  state,
  event,
  fireEvent,
  concatBuffers,
  SYNCED,
  SYNCING,
  NOT_SYNCED,
} from "../global.js";
import Player from "./Player.js";
import FrameQueue from "../FrameQueue.js";

const BUFFER = 5; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 5; // seconds before removing from SourceBuffer

export default class MediaSourcePlayer extends Player {
  constructor(icecast, inputMimeType, codec) {
    super(icecast, inputMimeType, codec);

    this.reset();

    this._icecast.addEventListener(event.RETRY, () => {
      this._syncState = NOT_SYNCED;
    });
  }

  static canPlayType(mimeType) {
    const mapping = {
      mpeg: ['audio/mp4;codecs="mp3"'],
      aac: ['audio/mp4;codecs="mp4a.40.2"'],
      aacp: ['audio/mp4;codecs="mp4a.40.2"'],
      flac: ['audio/mp4;codecs="flac"'],
      ogg: {
        flac: ['audio/mp4;codecs="flac"'],
        opus: ['audio/mp4;codecs="opus"', 'audio/webm;codecs="opus"'],
        vorbis: ['audio/webm;codecs="vorbis"'],
      },
    };

    try {
      new MediaSource();
    } catch {
      return "";
    }
    if (MediaSource.isTypeSupported(mimeType)) return "probably";

    return super.canPlayType(MediaSource.isTypeSupported, mimeType, mapping);
  }

  static get name() {
    return "mediasource";
  }

  get isAudioPlayer() {
    return true;
  }

  get metadataTimestamp() {
    return (
      (this._mediaSource &&
        this._mediaSource.sourceBuffers.length &&
        Math.max(
          // work-around for WEBM reporting a negative timestampOffset
          this._mediaSource.sourceBuffers[0].timestampOffset,
          this._mediaSource.sourceBuffers[0].buffered.length
            ? this._mediaSource.sourceBuffers[0].buffered.end(0)
            : 0
        )) ||
      0
    );
  }

  get currentTime() {
    return this._audioElement.currentTime;
  }

  async reset() {
    this._syncState = SYNCED;
    this._frameQueue = new FrameQueue(this._icecast);
    this._sourceBufferQueue = [];
    this._firedPlay = false;

    this._mediaSourcePromise = this._prepareMediaSource(
      this._inputMimeType,
      this._codec
    );

    await this._mediaSourcePromise;
  }

  async onStream(frames) {
    frames = frames.flatMap((frame) => frame.codecFrames || frame);

    if (frames.length) {
      switch (this._syncState) {
        case NOT_SYNCED:
          this._frameQueue.initSync();
          this._syncState = SYNCING;
        case SYNCING:
          [frames] = this._frameQueue.sync(frames);
          if (frames.length) this._syncState = SYNCED;
      }

      this._frameQueue.addAll(frames);

      // when frames are present, we should already know the codec and have the mse audio mimetype determined
      await (
        await this._mediaSourcePromise
      )(frames); // wait for the source buffer to be created
    }
  }

  async _prepareMediaSource(inputMimeType, codec) {
    if (MediaSource.isTypeSupported(inputMimeType)) {
      // pass the audio directly to MSE

      await this._createMediaSource(inputMimeType);

      return async (frames) =>
        this._appendSourceBuffer(concatBuffers(frames.map((f) => f.data)));
    } else {
      // wrap the audio into fragments before passing to MSE
      const wrapper = new MSEAudioWrapper(inputMimeType, {
        codec,
      });

      if (!MediaSource.isTypeSupported(wrapper.mimeType)) {
        this._icecast[fireEvent](
          event.ERROR,
          `Media Source Extensions API in your browser does not support ${inputMimeType} or ${wrapper.mimeType}`,
          "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
        );
        throw new Error(`Unsupported Media Source Codec ${wrapper.mimeType}`);
      }

      await this._createMediaSource(wrapper.mimeType);

      return async (codecFrames) => {
        const fragments = concatBuffers([...wrapper.iterator(codecFrames)]);

        await this._appendSourceBuffer(fragments);
      };
    }
  }

  async _createMediaSource(mimeType) {
    await new Promise(async (resolve) => {
      this._mediaSource = new MediaSource();
      this._audioElement.loop = false;
      this._audioElement.src = URL.createObjectURL(this._mediaSource);

      this._mediaSource.addEventListener("sourceopen", resolve, {
        once: true,
      });
    });

    this._sourceBufferRemoved = 0;
    this._mediaSource.addSourceBuffer(mimeType).mode = "sequence";
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
    this._icecast[fireEvent](event.STREAM, chunk);

    if (!this._mediaSource.sourceBuffers.length) {
      this._icecast[fireEvent](
        event.WARN,
        "Attempting to append audio, but MediaSource has not been or is no longer initialized",
        "Please be sure that `detachAudioElement()` was called and awaited before reusing the element with a new IcecastMetadataPlayer instance"
      );
    }

    if (
      this._icecast.state !== state.STOPPING &&
      this._mediaSource.sourceBuffers.length
    ) {
      this._sourceBufferQueue.push(chunk);

      try {
        do {
          this._mediaSource.sourceBuffers[0].appendBuffer(
            this._sourceBufferQueue[0]
          );
          await this._waitForSourceBuffer();
          this._sourceBufferQueue.shift();
        } while (this._sourceBufferQueue.length);
      } catch (e) {
        if (e.name !== "QuotaExceededError") throw e;
      }

      if (!this._firedPlay) {
        if (this._bufferLength <= this.metadataTimestamp) {
          this._icecast[fireEvent](event.PLAY);
          this._firedPlay = true;
        } else {
          this._icecast[fireEvent](event.BUFFER, this.metadataTimestamp);
        }
      }

      if (
        this._audioElement.currentTime > BUFFER + this._bufferLength &&
        this._sourceBufferRemoved + BUFFER_INTERVAL * 1000 < Date.now()
      ) {
        this._sourceBufferRemoved = Date.now();
        this._mediaSource.sourceBuffers[0].remove(
          0,
          this._audioElement.currentTime - BUFFER + this._bufferLength
        );
        await this._waitForSourceBuffer();
      }
    }
  }
}
