import { IcecastReadableStream } from "icecast-metadata-js";
import {
  p,
  event,
  audioElement,
  endpoint,
  metadataTypes,
  icyMetaInt,
  icyDetectionTimeout,
  fireEvent,
  hasIcy,
  icecastMetadataQueue,
  abortController,
} from "../global.js";

export default class Player {
  constructor(icecast) {
    const instanceVariables = p.get(icecast);

    this._icecast = icecast;
    this._audioElement = instanceVariables[audioElement];
    this._endpoint = instanceVariables[endpoint];
    this._metadataTypes = instanceVariables[metadataTypes];
    this._icyMetaInt = instanceVariables[icyMetaInt];
    this._icyDetectionTimeout = instanceVariables[icyDetectionTimeout];

    this._hasIcy = instanceVariables[hasIcy];
    this._icecastMetadataQueue = instanceVariables[icecastMetadataQueue];
  }

  get icyMetaInt() {
    return (
      this._icecastReadableStream && this._icecastReadableStream.icyMetaInt
    );
  }

  async play() {
    return this.fetchStream().then(async (res) => {
      this._icecast[fireEvent](event.STREAM_START);

      return this.playResponse(res).finally(() => {
        this._icecast[fireEvent](event.STREAM_END);
      });
    });
  }

  async fetchStream() {
    const res = await fetch(this._endpoint, {
      method: "GET",
      headers: this._hasIcy ? { "Icy-MetaData": 1 } : {},
      signal: p.get(this._icecast)[abortController].signal,
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
      onError: (...args) => this._icecast[fireEvent](event.WARN, ...args),
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
