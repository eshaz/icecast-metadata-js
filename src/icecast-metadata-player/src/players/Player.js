import { IcecastReadableStream } from "icecast-metadata-js";

export default class Player {
  constructor(options) {
    this._icecast = options.icecast;
    this._audioElement = options.audioElement;
    this._endpoint = options.endpoint;
    this._hasIcy = options.hasIcy;
    this._enableLogging = options.enableLogging;
    this._icecastMetadataQueue = options.icecastMetadataQueue;
    this._state = options.state;
    this._metadataTypes = options.metadataTypes;
    this._icyMetaInt = options.icyMetaInt;
    this._icyDetectionTimeout = options.icyDetectionTimeout;

    this._fireEvent = options.fireEvent;
    this._events = options.events;
  }

  get icyMetaInt() {
    return (
      this._icecastReadableStream && this._icecastReadableStream.icyMetaInt
    );
  }

  async play(abortController) {
    return this.fetchStream(abortController).then(async (res) => {
      this._fireEvent(this._events.STREAM_START);

      return this.playResponse(res).finally(() => {
        this._fireEvent(this._events.STREAM_END);
      });
    });
  }

  async fetchStream(abortController) {
    const res = await fetch(this._endpoint, {
      method: "GET",
      headers: this._hasIcy ? { "Icy-MetaData": 1 } : {},
      signal: abortController.signal,
    });

    if (!res.ok) {
      const error = new Error(`${res.status} received from ${res.url}`);
      error.name = "HTTP Response Error";
      throw error;
    }

    return res;
  }

  async playResponse(res) {
    this._icecastReadableStream = new IcecastReadableStream(res, {
      onMetadata: this.getOnMetadata(),
      onStream: this.getOnStream(res),
      onError: (...args) => this._fireEvent(this._events.WARN, ...args),
      metadataTypes: this._metadataTypes,
      icyMetaInt: this._icyMetaInt,
      icyDetectionTimeout: this._icyDetectionTimeout,
    });

    await this._icecastReadableStream.startReading();
  }

  getOnMetadata() {
    return (value) => {
      this._icecastMetadataQueue.addMetadata(
        value,
        this.metadataTimestamp,
        this._audioElement.currentTime
      );
    };
  }
}
