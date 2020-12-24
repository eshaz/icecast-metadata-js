class Stats {
  constructor() {
    this._totalBytesRead = 0;
    this._streamBytesRead = 0;
    this._metadataLengthBytesRead = 0;
    this._metadataBytesRead = 0;

    this._currentBytesRemaining = 0;
    this._currentStreamBytesRemaining = 0;
    this._currentMetadataBytesRemaining = 0;
  }

  get stats() {
    return {
      totalBytesRead: this._totalBytesRead,
      streamBytesRead: this._streamBytesRead,
      metadataLengthBytesRead: this._metadataLengthBytesRead,
      metadataBytesRead: this._metadataBytesRead,
      currentBytesRemaining: this._currentBytesRemaining,
      currentStreamBytesRemaining: this._currentStreamBytesRemaining,
      currentMetadataBytesRemaining: this._currentMetadataBytesRemaining,
    };
  }

  set currentStreamBytesRemaining(bytes) {
    this._currentStreamBytesRemaining = bytes;
  }

  set currentMetadataBytesRemaining(bytes) {
    this._currentMetadataBytesRemaining = bytes;
  }

  addStreamBytes(bytes) {
    this._streamBytesRead += bytes;
    this._totalBytesRead += bytes;
    this._currentStreamBytesRemaining -= bytes;
    this._currentBytesRemaining -= bytes;
  }

  addMetadataLengthBytes(bytes) {
    this._metadataLengthBytesRead += bytes;
    this._totalBytesRead += bytes;
    this._currentBytesRemaining -= bytes;
  }

  addMetadataBytes(bytes) {
    this._metadataBytesRead += bytes;
    this._totalBytesRead += bytes;
    this._currentMetadataBytesRemaining -= bytes;
    this._currentBytesRemaining -= bytes;
  }

  addCurrentBytesRemaining(bytes) {
    this._currentBytesRemaining += bytes;
  }
}

module.exports = Stats;
