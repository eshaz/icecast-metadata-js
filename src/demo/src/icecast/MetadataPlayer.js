import IcecastMetadataReader from "./metadata-js/IcecastMetadataReader";
import IcecastMetadataQueue from "./metadata-js/IcecastMetadataQueue";
import BufferArray from "./BufferArray";

export default class MetadataPlayer {
  constructor({ endpoint, metaInt, onMetadataUpdate, audioElement }) {
    this._endpoint = endpoint;
    this._metaInt = metaInt;
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (meta) => onMetadataUpdate(meta),
    });
    this._audioElement = audioElement;
    this._onMetadataUpdate = onMetadataUpdate;

    this._icecast = null;
    this._streamBuffer = new BufferArray();

    this._audioElement.onplay = () => this.play();
    this._audioElement.onpause = () => this.stop();
    this._createMediaSource();
  }

  _onMetadata(value) {
    this._icecastMetadataQueue.addMetadata(
      value,
      this._sourceBuffer.timestampOffset - this._audioElement.currentTime
    );
  }

  _createMediaSource() {
    this._mediaSource = new MediaSource();
    this._audioElement.src = URL.createObjectURL(this._mediaSource);
  }

  _destroyMediaSource() {
    this._playPromise
      .then(() => this._audioElement.removeAttribute("src"))
      .then(() => this._audioElement.load())
      .then(() => this._createMediaSource())
      .catch(() => {});
  }

  _addSourceBuffer(mimeType) {
    this._sourceBuffer = this._mediaSource.addSourceBuffer(mimeType);
  }

  _handleError(e) {
    console.error(e)
    this._destroyMediaSource();
    this._icecastMetadataQueue.purgeMetadataQueue();
    this._onMetadataUpdate({});
  }

  async _readIcecastResponse(value) {
    this._streamBuffer.addBuffer(value.length);

    for (let i = this._icecast.next(value); i.value; i = this._icecast.next()) {
      if (i.value.stream) {
        this._streamBuffer.append(i.value.stream);
      } else {
        const currentPosition = value.length - this._streamBuffer.length;
        await this._appendSourceBuffer(this._streamBuffer.readAll);

        this._streamBuffer.addBuffer(currentPosition);
        this._onMetadata(i.value);
      }
    }

    return this._appendSourceBuffer(this._streamBuffer.readAll);
  }

  _appendSourceBuffer(chunk) {
    this._sourceBuffer.appendBuffer(chunk);
    return new Promise((resolve) => {
      this._sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });
  }

  play() {
    this._onMetadataUpdate({ StreamTitle: "Loading..." });
    this._controller = new AbortController();
    this._playPromise = this._audioElement.play();

    fetch(this._endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      },
      mode: "cors",
      signal: this._controller.signal,
    })
      .then(async (res) => {
        this._addSourceBuffer(res.headers.get("content-type"));
        this._icecast = new IcecastMetadataReader({
          icyMetaInt: parseInt(res.headers.get("Icy-MetaInt")) || this._metaInt,
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
      .catch((e) => this._handleError(e));
  }

  stop() {
    this._controller && this._controller.abort();
  }
}
