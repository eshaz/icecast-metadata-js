/* Copyright 2020 Ethan Halsall

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

const cron = require("cron-parser");

const { IcecastMetadataRecorder } = require("./IcecastMetadataRecorder");
const { ArchiveRotator } = require("./ArchiveRotator");

class IcecastMetadataArchiveRecorder extends IcecastMetadataRecorder {
  constructor(params) {
    super(params);
    this._archivePath = params.archivePath;
    this._cron = cron.parseExpression(params.archiveInterval, { utc: true });
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
      archiveDate: `${this._startDate.toISOString().substring(0, 16)}:00`, // archive date is more granular to prevent overwriting previous archives
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
    const stopped = super.stop();

    const archiver = new ArchiveRotator({
      archivePath: this._archivePath,
      archiveDate: this._startDate.toISOString().substring(0, 10),
      filesToArchive: this._fileNames,
    });

    stopped.then(() => archiver.rotate()).then(() => this.record());
  }
}

module.exports = { IcecastMetadataArchiveRecorder };
