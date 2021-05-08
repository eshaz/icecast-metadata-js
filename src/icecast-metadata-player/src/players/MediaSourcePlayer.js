import { state, event, fireEvent } from "../global";
import Player from "./Player";
import MSEAudioWrapper from "mse-audio-wrapper";
import CodecParser from "codec-parser";

const BUFFER = 10; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 10; // seconds before removing from SourceBuffer

export default class MediaSourcePlayer extends Player {
  constructor(icecast) {
    super(icecast);

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
      const frames = [...this._codecParser.iterator(stream)];

      if (frames.length) {
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
    this._icecast[fireEvent](event.STREAM, chunk);

    if (this._icecast.state !== state.STOPPING) {
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
