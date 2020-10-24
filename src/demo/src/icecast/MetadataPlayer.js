import IcecastMetadataQueue from "./metadata-js/IcecastMetadataQueue";
import IcecastReadableStream from "./metadata-js/IcecastReadableStream";

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

  async _appendSourceBuffer(chunk) {
    this._sourceBuffer.appendBuffer(chunk);

    return new Promise((resolve) => {
      this._sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });
  }

  async fetchMimeType(endpoint) {
    const headResponse = await fetch(endpoint, {
      method: "HEAD",
      mode: "cors",
    }).catch(() => {});

    return headResponse ? headResponse : new Promise(() => {});
  }

  async fetchStream(endpoint) {
    return fetch(endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      },
      mode: "cors",
      signal: this._controller.signal,
    });
  }

  play(endpoint, icyMetaInt) {
    if (this._playing) {
      this.stop();
    }

    this._playing = true;
    this._controller = new AbortController();

    const streamPromise = this.fetchStream(endpoint);

    Promise.race([this.fetchMimeType(endpoint), streamPromise])
      .then(async (res) => {
        const mimeType = res.headers.get("content-type");

        if (MediaSource.isTypeSupported(mimeType)) {
          await this._createMediaSource(mimeType);
          return streamPromise;
        } else {
          throw new Error(
            `Your browser does not support MediaSource ${mimeType}. Try using Google Chrome.`
          );
        }
      })
      .then(async (res) => {
        this._playPromise = this._audioElement.play();

        const icecast = new IcecastReadableStream(res, {
          icyMetaInt,
          onStream: ({ stream }) => this._appendSourceBuffer(stream),
          onMetadata: (value) => {
            this._icecastMetadataQueue.addMetadata(
              value,
              this._sourceBuffer.timestampOffset -
                this._audioElement.currentTime
            );
          },
        });

        for await (const stream of icecast.asyncIterator()) {
        }
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
