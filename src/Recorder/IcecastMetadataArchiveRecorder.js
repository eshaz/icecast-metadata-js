const cron = require("cron-parser");

const { IcecastMetadataRecorder } = require("./IcecastMetadataRecorder");
const { ArchiveRotator } = require("./ArchiveRotator");

class IcecastMetadataArchiveRecorder extends IcecastMetadataRecorder {
  constructor(params) {
    super(params);
    this._archivePath = params.archivePath;
    this._cron = cron.parseExpression(params.archiveInterval);
  }

  record() {
    super.record();
    this._setRollover();
  }

  stop() {
    super.stop();
    clearTimeout(this._rolloverId);

    const archiver = new ArchiveRotator({
      archivePath: this._archivePath,
      archiveDate: this._startDate.toISOString().substring(0, 19), // archive date is more granular to prevent overwriting previous archives
      filesToArchive: this._fileNames,
    });

    archiver.rotateSync();
  }

  _setRollover() {
    const rolloverTimeout =
      this._cron.next().getTime() - this._startDate.getTime();
    this._rolloverId = setTimeout(() => {
      this._rollover();
    }, rolloverTimeout);
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
