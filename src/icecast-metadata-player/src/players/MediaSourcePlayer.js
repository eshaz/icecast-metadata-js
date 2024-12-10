import {
  state,
  event,
  fireEvent,
  concatBuffers,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
} from "../global.js";
import Player from "./Player.js";

const BUFFER = 5; // seconds of audio to store in SourceBuffer
const BUFFER_INTERVAL = 5; // seconds before removing from SourceBuffer

export default class MediaSourcePlayer extends Player {
  constructor(icecast, endpoint, inputMimeType, codec, codecHeader) {
    super(icecast, endpoint, inputMimeType, codec, codecHeader);

    this._MSEAudioWrapper = import(
      /* webpackChunkName: "mediasource", webpackPrefetch: true */
      "mse-audio-wrapper"
    );

    this._initSupportedContainers();
    this._init();
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

    if (!MediaSourcePlayer.isSupported) return "";

    if (MediaSource.isTypeSupported(mimeType)) return "probably";

    return super.canPlayType(MediaSource.isTypeSupported, mimeType, mapping);
  }

  static get isSupported() {
    return Boolean(window.MediaSource);
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
            : 0,
        )) ||
      0
    );
  }

  get currentTime() {
    return this._audioElement.currentTime;
  }

  get waiting() {
    return new Promise((resolve) => {
      this._audioElement.addEventListener("waiting", resolve, { once: true });
    });
  }

  get changingContainer() {
    return this._changingContainer;
  }

  useNextContainer() {
    const nextContainerIndex =
      this._supportedContainers.indexOf(this._container) + 1;
    this._container = this._supportedContainers[nextContainerIndex];

    this._changingContainer = true;
    this.enablePlayButton();
    this._init();
    this.start().then(() => (this._changingContainer = false));
  }

  async _initSupportedContainers() {
    const supportedMimeTypes = new Set();
    this._supportedContainers = [];
    this._changingContainer = false;

    let setContainer;
    this._container = new Promise((resolve) => {
      setContainer = resolve;
    });

    const mimeTypes = [
      [() => this._inputMimeType, "raw"],
      [
        async () =>
          (await this._MSEAudioWrapper).getWrappedMimeType(this._codec, "fmp4"),
        "fmp4",
      ],
      [
        async () =>
          (await this._MSEAudioWrapper).getWrappedMimeType(this._codec, "webm"),
        "webm",
      ],
    ];

    for await (const mimeType of mimeTypes) {
      const mseMimeType = await mimeType[0]();
      const container = mimeType[1];

      if (
        MediaSource.isTypeSupported(mseMimeType) &&
        !supportedMimeTypes.has(mseMimeType)
      ) {
        if (setContainer) {
          setContainer(container);
          setContainer = null;
        }
        supportedMimeTypes.add(mseMimeType);
        this._supportedContainers.push(container);
      }
    }
  }

  async _init() {
    super._init();

    this._sourceBufferQueue = [];
    this._playReady = false;
    this._processingLastPage = false;

    this._mediaSourceCreated = new Promise((resolve) => {
      this._mediaSourceCreatedNotify = resolve;
    });

    this._mediaSourceOpen = new Promise((resolve) => {
      this._mediaSourceOpenNotify = resolve;
    });

    const container = await this._container;
    this._container = container;

    this._addFrames = this._prepareMediaSource(
      this._inputMimeType,
      this._codec,
    );

    await this._mediaSourceOpen;
  }

  async start(metadataOffset) {
    const playing = super.start(metadataOffset);
    await this._mediaSourceCreated;
    await this._attachMediaSource();
    await playing;
  }

  async end() {
    super.end();

    await this._init();
  }

  async onStream(frames) {
    frames = frames.flatMap((frame) =>
      frame.codecFrames
        ? frame.codecFrames.map((codecFrame) => {
            codecFrame.isLastPage = frame.isLastPage;
            return codecFrame;
          })
        : frame,
    );

    if (frames.length) {
      switch (this.syncState) {
        case NOT_SYNCED:
          this._frameQueue.initSync();
          this.syncState = SYNCING;
        case SYNCING:
          [this.syncFrames, this.syncState, this.syncDelay] =
            await this._frameQueue.sync(frames);
          frames = this.syncFrames;
      }

      switch (this.syncState) {
        case PCM_SYNCED:
          break;
        case SYNCED:
          // when frames are present, we should already know the codec and have the mse audio mimetype determined
          await this._mediaSourceOpen;
          await this._addFrames(frames); // wait for the source buffer to be created

          this._frameQueue.addAll(frames);
          break;
      }
    }
  }

  _prepareMediaSource(inputMimeType, codec) {
    if (!this._container) {
      this._icecast[fireEvent](
        event.PLAYBACK_ERROR,
        `Media Source Extensions API in your browser does not support ${inputMimeType} or ${this._wrapper.mimeType}.` +
          "See: https://caniuse.com/mediasource and https://developer.mozilla.org/en-US/docs/Web/API/Media_Source_Extensions_API",
      );
    } else if (this._container === "raw") {
      // pass the audio directly to MSE
      this._createMediaSource(inputMimeType);

      return async (frames) =>
        this._appendSourceBuffer(concatBuffers(frames.map((f) => f.data)));
    } else {
      this._createMSEWrapper(inputMimeType, codec, this._container).then(() =>
        this._createMediaSource(this._wrapper.mimeType),
      );

      return inputMimeType.match(/ogg/)
        ? async (codecFrames) => {
            let fragments = [];

            for await (const frame of codecFrames) {
              // handle new setup packet for continuous chain ogg vorbis streams
              if (this._processingLastPage !== frame.isLastPage) {
                if (frame.isLastPage) {
                  this._processingLastPage = true;
                } else {
                  await this._appendSourceBuffer(concatBuffers(fragments));
                  fragments = [];

                  const codecHeader = await this._codecHeader;
                  await this._createMSEWrapper(
                    inputMimeType,
                    codec,
                    this._container,
                  );

                  this._processingLastPage = false;
                }
              }

              fragments.push(...this._wrapper.iterator([frame]));
            }

            await this._appendSourceBuffer(concatBuffers(fragments));
          }
        : async (codecFrames) =>
            this._appendSourceBuffer(
              concatBuffers([...this._wrapper.iterator(codecFrames)]),
            );
    }
  }

  async _createMSEWrapper(inputMimeType, codec, preferredContainer) {
    // wrap the audio into fragments before passing to MSE
    this._wrapper = new (await this._MSEAudioWrapper).default(inputMimeType, {
      codec,
      preferredContainer,
    });
  }

  _createMediaSource(mimeType) {
    this._mediaSource = new MediaSource();
    this._mediaSourceCreatedNotify();

    this._mediaSource.addEventListener(
      "sourceopen",
      () => {
        if (
          this._icecast.state !== state.STOPPED &&
          this._icecast.state !== state.STOPPING
        )
          this._mediaSource.addSourceBuffer(mimeType).mode = "sequence";
        this._sourceBufferRemoved = 0;
        this._mediaSourceOpenNotify();
      },
      {
        once: true,
      },
    );
  }

  async _attachMediaSource() {
    this._audioElement.loop = false;
    this._audioElement.src = URL.createObjectURL(this._mediaSource);
    await this._mediaSourceOpen;
  }

  async _waitForSourceBuffer() {
    return new Promise((resolve) => {
      const sourceBuffer = this._mediaSource.sourceBuffers[0];

      if (!sourceBuffer.updating) {
        resolve();
      } else {
        sourceBuffer.addEventListener("updateend", resolve, {
          once: true,
        });
      }
    });
  }

  async _appendSourceBuffer(chunk) {
    this._icecast[fireEvent](event.STREAM, chunk);

    if (!this._mediaSource.sourceBuffers.length) {
      this._icecast[fireEvent](
        event.WARN,
        "Attempting to append audio, but MediaSource has not been or is no longer initialized",
        "Please be sure that `detachAudioElement()` was called and awaited before reusing the element with a new IcecastMetadataPlayer instance",
      );
    }

    if (
      this._icecast.state !== state.STOPPING &&
      this._mediaSource.sourceBuffers.length
    ) {
      this._sourceBufferQueue.push(chunk);

      try {
        while (this._sourceBufferQueue.length) {
          this._mediaSource.sourceBuffers[0].appendBuffer(
            this._sourceBufferQueue.shift(),
          );
          await this._waitForSourceBuffer();
        }
      } catch (e) {
        if (e.name !== "QuotaExceededError") throw e;
      }

      if (!this._playReady) {
        if (this._bufferLength <= this.metadataTimestamp) {
          this._audioElement.addEventListener(
            "playing",
            () => {
              this._startMetadataQueues();
              this._icecast[fireEvent](event.PLAY);
            },
            { once: true },
          );
          this._icecast[fireEvent](event.PLAY_READY);
          this._playReady = true;
        } else {
          this._icecast[fireEvent](event.BUFFER, this.metadataTimestamp);
        }
      }

      if (
        this._audioElement.currentTime > BUFFER + this._bufferLength &&
        this._sourceBufferRemoved + BUFFER_INTERVAL * 1000 < performance.now()
      ) {
        this._sourceBufferRemoved = performance.now();
        this._mediaSource.sourceBuffers[0].remove(
          0,
          this._audioElement.currentTime - BUFFER + this._bufferLength,
        );
        await this._waitForSourceBuffer();
      }
    }
  }
}
