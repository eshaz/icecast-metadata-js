import IcecastMetadataQueue from "./metadata-js/IcecastMetadataQueue";
import IcecastReadableStream from "./metadata-js/IcecastReadableStream";
import FragmentedMPEG from "../FragmentedMPEG/FragmentedMPEG";

export default class MetadataPlayer {
  constructor({ onMetadataUpdate }) {
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (meta) => onMetadataUpdate(meta),
    });
    this._audioElement = new Audio();
    this._onMetadataUpdate = onMetadataUpdate;

    this._playing = false;
  }

  get playing() {
    return this._playing;
  }

  async _createMediaSource(mimeType) {
    this._mediaSource = new MediaSource();
    this._audioElement.src = URL.createObjectURL(this._mediaSource);

    return new Promise((resolve) => {
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

  _destroyMediaSource() {
    this._mediaSource = null;
    this._playPromise &&
      this._playPromise
        .then(() => this._audioElement.removeAttribute("src"))
        .then(() => this._audioElement.load())
        .catch(() => {});
  }

  async _waitForSourceBuffer() {
    return new Promise((resolve) => {
      this._sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });
  }

  async _appendSourceBuffer(chunk) {
    this._sourceBuffer.appendBuffer(chunk);
    await this._waitForSourceBuffer();

    if (this._audioElement.currentTime > 0) {
      this._sourceBuffer.remove(0, this._audioElement.currentTime);
      await this._waitForSourceBuffer();
    }
  }

  async fetchMimeType(endpoint) {
    return fetch(endpoint, {
      method: "HEAD",
      mode: "cors",
    });
  }

  async fetchStream(endpoint) {
    this._controller = new AbortController();

    return fetch(endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      },
      signal: this._controller.signal,
    });
  }

  async getMediaSource(res) {
    const mimeType = res.headers.get("content-type");

    if (MediaSource.isTypeSupported(mimeType)) {
      await this._createMediaSource(mimeType);

      this._onStream = ({ stream }) => this._appendSourceBuffer(stream);
    } else if (
      mimeType === "audio/mpeg" &&
      MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')
    ) {
      await this._createMediaSource('audio/mp4; codecs="mp3"');

      this._mp3ToMp4 = new FragmentedMPEG();
      this._onStream = async ({ stream }) => {
        for await (const movieFragment of this._mp3ToMp4.iterator(stream)) {
          await this._appendSourceBuffer(movieFragment);
        }
      };
    } else {
      throw new Error(
        `Your browser does not support MediaSource ${mimeType}. Try using Google Chrome.`
      );
    }

    return this._streamPromise;
  }

  play(endpoint, icyMetaInt) {
    if (this._playing) this.stop();
    this._playing = true;
    this._streamPromise = this.fetchStream(endpoint);

    Promise.race([
      this.fetchMimeType(endpoint).catch(() => this._streamPromise),
      this._streamPromise,
    ])
      .then((res) => this.getMediaSource(res))
      .then(async (res) => {
        this._playPromise = this._audioElement.play();
        this._isInitialMetadata = true;

        await new IcecastReadableStream(res, {
          icyMetaInt,
          onStream: this._onStream,
          onMetadata: (value) => {
            this._isInitialMetadata
              ? this._onMetadataUpdate(value.metadata)
              : this._icecastMetadataQueue.addMetadata(
                  value,
                  this._sourceBuffer.timestampOffset -
                    this._audioElement.currentTime
                );
            this._isInitialMetadata = false;
          },
        }).startReading();
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          this._onMetadataUpdate(`Error Connecting: ${e.message}`);
        }
        this._destroyMediaSource();
      });
  }

  stop() {
    this._playing = false;
    this._controller.abort();
    this._icecastMetadataQueue.purgeMetadataQueue();
  }
}
