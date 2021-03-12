export default class Player {
  constructor(options) {
    this._icecast = options.icecast;
    this._audioElement = options.audioElement;
    this._endpoint = options.endpoint;
    this._hasIcy = options.hasIcy;
    this._enableLogging = options.enableLogging;
    this._icecastMetadataQueue = options.icecastMetadataQueue;
    this._fireEvent = options.fireEvent;
    this._state = options.state;
    this._events = options.events;
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
