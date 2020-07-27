const cron = require("cron-parser");

const { IcecastMetadataRecorder } = require("./IcecastMetadataRecorder");
const { ArchiveRotator } = require("./ArchiveRotator");

class IcecastMetadataArchiveRecorder extends IcecastMetadataRecorder {
  constructor(params) {
    super(params);
    this._archiveInterval = params.archiveInterval;
    this._archivePath = params.archivePath;
  }

  record() {
    // this._getCron();
    this._setRollover();
    super.record();
  }

  async stop() {
    super.stop();
    clearTimeout(this._rolloverId);

    const archiver = new ArchiveRotator({
      archivePath: this._archivePath,
      archiveDate: this._startDate.toISOString(),
      filesToArchive: this._fileNames,
    });

    return archiver.rotate();
  }

  _getCron() {
    this._cron = cron.parseExpression(this._archiveInterval);
  }

  _setRollover() {
    this._rolloverId = setTimeout(() => {
      this._rollover();
    }, 50000);
  }

  _rollover() {
    super.stop();

    const archiver = new ArchiveRotator({
      archivePath: this._archivePath,
      archiveDate: this._startDate.toISOString().substring(0, 10),
      filesToArchive: this._fileNames,
    });

    archiver.rotate().then(() => this.record());
  }
}

module.exports = { IcecastMetadataArchiveRecorder };
