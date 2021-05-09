import { state, event, fireEvent } from "../global";
import Player from "./Player";
import MSEAudioWrapper from "mse-audio-wrapper";
import CodecParser from "codec-parser";

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer

class FrameQueue {
  constructor(icecast) {
    this.CACHE_DURATION = 60000; // milliseconds of burst on connect data
    this.SYNC_SIZE = 4; // frames
    this._queue = [];
    this._icecast = icecast;

    this.initSync();
  }

  initSync() {
    this._syncQueue = [];
    this._syncIndex = null;
    this._syncPosition = null;
  }

  push({ crc32, totalDuration, duration }) {
    this._queue.push({ crc32, totalDuration, duration });

    if (this._queue[0].totalDuration + this.CACHE_DURATION < totalDuration) {
      this._queue.pop();
    }
  }

  /*
  Aligns the queue with a new incoming data by searching for the
  first matching set of 4 crc32 hashes and then returning only the
  frames that do not existing on the queue.

                    old data|common data|new data
  (old connection) |--------[--]--------|
  (new connection)         |[--]--------[----->
                            ^ (sync)    ^ (frames to return)
  */
  sync(frames) {
    if (this._syncIndex === null) {
      this._syncQueue.push(...frames.slice(0, this.SYNC_SIZE));

      // need more data before we can search
      if (this._syncQueue.length < this.SYNC_SIZE) {
        return [];
      }

      // search for matching hashes
      for (
        this._syncIndex = 0;
        this._syncIndex < this._queue.length - this._syncQueue.length;
        this._syncIndex++
      ) {
        if (
          this._syncQueue.every(
            (frame, i) => frame.crc32 === this._queue[this._syncIndex + i].crc32
          )
        ) {
          // match
          this._syncPosition = this._syncIndex - this._queue.length;
          const duration =
            this._queue
              .slice(this._syncIndex)
              .reduce((acc, { duration }) => acc + duration, 0) / 1000;

          // prettier-ignore
          this._icecast[fireEvent](
            event.WARN,
            "Reconnected successfully after retry event.",
            `Found ${-this._syncPosition} frames (${duration.toFixed(3)} seconds) of overlapping audio data in new request.`,
            "Syncing new request with audio."
          );

          break;
        }
      }

      // no match
      if (this._syncPosition === null) {
        this._icecast[fireEvent](
          event.WARN,
          "Reconnected successfully after retry event.",
          "Found no overlapping frames from previous request"
        );

        this.initSync();
        return frames;
      }
    }

    this._syncPosition += frames.length;

    // gather new frames until there is at least one new frame
    if (this._syncPosition > 0) {
      const newFrames = frames.slice(-this._syncPosition);

      this.initSync();

      return newFrames;
    } else {
      return [];
    }
  }
}

export default class MediaSourcePlayer extends Player {
  constructor(icecast) {
    super(icecast);

    this.reset();

    this._icecast.addEventListener(event.RETRY, () => {
      this._synced = false;
    });
  }

  static isSupported() {
    try {
      new MediaSource();
    } catch {
      return false;
    }

    return true;
  }

  static canPlayType(mimeType) {
    const mapping = {
      mpeg: ['audio/mp4;codecs="mp3"'],
      aac: ['audio/mp4;codecs="mp4a.40.2"'],
      aacp: ['audio/mp4;codecs="mp4a.40.2"'],
      ogg: {
        flac: ['audio/mp4;codecs="flac"'],
        opus: ['audio/mp4;codecs="opus"', 'audio/webm;codecs="opus"'],
        vorbis: ['audio/webm;codecs="vorbis"'],
      },
    };

    if (!MediaSourcePlayer.isSupported()) return "";
    if (MediaSource.isTypeSupported(mimeType)) return "probably";

    const matches = mimeType.match(
      /^(?:application\/|audio\/|)(?<mime>[a-zA-Z]+)(?:$|;[ ]*codecs=(?:\'|\")(?<codecs>[a-zA-Z,]+)(?:\'|\"))/
    );

    if (matches) {
      const { mime, codecs } = matches.groups;

      if (mapping[mime]) {
        return (Array.isArray(mapping[mime])
          ? mapping[mime] // test codec without a container
          : codecs
          ? codecs.split(",").flatMap((codec) => mapping[mime][codec]) // test multiple codecs
          : Object.values(mapping[mime]).flat()
        ) // test all codecs within a container
          .reduce((acc, codec) => {
            if (MediaSource.isTypeSupported(codec)) {
              return acc === "" ? "maybe" : "probably";
            } else {
              return !acc ? "" : "maybe";
            }
          }, null);
      }
    }

    return "";
  }

  async reset() {
    this._synced = true;
    this._frameQueue = new FrameQueue(this._icecast);
    await this._createMediaSource();
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

  getOnStream(res) {
    const inputMimeType = res.headers.get("content-type");

    // set up the codec parser and source buffer asynchronously
    const appendFramesSourceBuffer = this._prepareMediaSource(inputMimeType);

    return async ({ stream }) => {
      let frames = [...this._codecParser.iterator(stream)];

      if (frames.length) {
        if (!this._synced) {
          frames = this._frameQueue.sync(frames);

          if (frames.length) {
            this._synced = true;
          }
        }

        frames.map((frame) => this._frameQueue.push(frame));

        // when frames are present, we should already know the codec and have the mse audio mimetype determined
        await (await appendFramesSourceBuffer)(frames); // wait for the source buffer to be created
      }
    };
  }

  async _prepareMediaSource(inputMimeType) {
    const codec = new Promise((onCodec) => {
      this._codecParser = new CodecParser(inputMimeType, {
        onCodecUpdate: (...args) =>
          this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
        onCodec,
      });
    });

    if (MediaSource.isTypeSupported(inputMimeType)) {
      // pass the audio directly to MSE
      await this._createSourceBuffer(inputMimeType);

      return async (frames) => {
        for await (const { data } of frames) {
          await this._appendSourceBuffer(data);
        }
      };
    } else {
      // wrap the audio into fragments before passing to MSE
      const wrapper = new MSEAudioWrapper(inputMimeType, {
        codec: await codec,
      });

      if (!MediaSource.isTypeSupported(wrapper.mimeType)) {
        this._icecast[fireEvent](
          event.ERROR,
          `Media Source Extensions API in your browser does not support ${inputMimeType} or ${wrapper.mimeType}`,
          "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API"
        );
        const error = new Error(
          `Unsupported Media Source Codec ${wrapper.mimeType}`
        );
        error.name = "CodecError";
        throw error;
      }

      await this._createSourceBuffer(wrapper.mimeType);

      return async (frames) => {
        for await (const fragment of wrapper.iterator(frames)) {
          await this._appendSourceBuffer(fragment);
        }
      };
    }
  }

  async _createSourceBuffer(mimeType) {
    await this._mediaSourcePromise;

    if (!this._mediaSource.sourceBuffers.length) {
      this._sourceBufferRemoved = 0;
      this._mediaSource.addSourceBuffer(mimeType).mode = "sequence";
    }
  }

  async _createMediaSource() {
    this._mediaSourcePromise = new Promise((resolve) => {
      this._mediaSource = new MediaSource();
      this._audioElement.src = URL.createObjectURL(this._mediaSource);

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
