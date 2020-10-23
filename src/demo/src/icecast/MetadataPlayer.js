import IcecastMetadataReader from "./metadata-js/IcecastMetadataReader";
import IcecastMetadataQueue from "./metadata-js/IcecastMetadataQueue";
import StreamBuffer from "./StreamBuffer";

export default class MetadataPlayer {
  constructor({ onMetadataUpdate }) {
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (meta) => onMetadataUpdate(meta),
    });
    this._audioElement = new Audio();
    this._onMetadataUpdate = onMetadataUpdate;

    this._icecast = null;
    this._streamBuffer = null;
    this._playing = false;
  }

  get playing() {
    return this._playing;
  }

  _onMetadata(value) {
    this._icecastMetadataQueue.addMetadata(
      value,
      this._sourceBuffer.timestampOffset - this._audioElement.currentTime
    );
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

  async _readIcecastResponse(value) {
    this._streamBuffer = new StreamBuffer(value.length);

    for (let i = this._icecast.next(value); i.value; i = this._icecast.next()) {
      if (i.value.stream) {
        this._streamBuffer.append(i.value.stream);
      } else {
        const currentPosition = value.length - this._streamBuffer.length;
        await this._appendSourceBuffer(this._streamBuffer.read);

        this._streamBuffer = new StreamBuffer(currentPosition);
        this._onMetadata(i.value);
      }
    }

    return this._appendSourceBuffer(this._streamBuffer.read);
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

  play(endpoint, metaInt) {
    this._audioElement.src = endpoint;
    this._audioElement.play();
  }

  _play(endpoint, metaInt) {
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

        this._icecast = new IcecastMetadataReader({
          icyMetaInt: parseInt(res.headers.get("Icy-MetaInt")) || metaInt,
        });

        const reader = res.body.getReader();
        const readerIterator = {
          [Symbol.asyncIterator]: () => ({
            next: () => reader.read(),
          }),
        };

        for await (const chunk of readerIterator) {
          await this._readIcecastResponse(chunk);
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
