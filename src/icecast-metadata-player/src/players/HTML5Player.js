class HTML5Player {
  constructor(options) {
    this._audioElement = options.audioElement;
    this._endpoint = options.endpoint;
    this._hasIcy = options.hasIcy;
    this._enableLogging = options.enableLogging;
    this._icecastMetadataQueue = options.icecastMetadataQueue;
    this._fireEvent = options.fireEvent;
    this._events = options.events;
  }

  isSupported() {}

  reset() {}

  async fetchStream() {}

  getOnMetadata() {}

  getOnStream(res) {}
}

module.exports = HTML5Player;
