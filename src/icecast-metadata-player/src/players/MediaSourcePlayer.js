import { state, event, fireEvent } from "../global";
import Player from "./Player";
import MSEAudioWrapper from "mse-audio-wrapper";

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
    const sourceBufferPromise = this._getMimeType(
      res.headers.get("content-type")
    ).then((mimeType) => this._createSourceBuffer(mimeType));

    const onStream = async ({ stream }) => {
      this._icecast[fireEvent](event.STREAM, stream);
      await sourceBufferPromise;
      await this._appendSourceBuffer(stream);
    };

    return this._mseAudioWrapper
      ? async ({ stream }) => {
          for await (const fragment of this._mseAudioWrapper.iterator(stream)) {
            await onStream({ stream: fragment });
          }
        }
      : onStream;
  }

  async _getMimeType(inputMimeType) {
    if (MediaSource.isTypeSupported(inputMimeType)) {
      return inputMimeType;
    } else {
      const mimeType = await new Promise((onMimeType) => {
        this._mseAudioWrapper = new MSEAudioWrapper(inputMimeType, {
          onCodecUpdate: (...args) =>
            this._icecast[fireEvent](event.CODEC_UPDATE, ...args),
          onMimeType,
        });
      });

      if (!MediaSource.isTypeSupported(mimeType)) {
        this._icecast[fireEvent](
          event.ERROR,
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
