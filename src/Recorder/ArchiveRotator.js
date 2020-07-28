const fs = require("fs");
const util = require("util");
const path = require("path");

/**
 * @description Moves files into an archive file path
 * @param {object} ArchiveRotator constructor
 * @param {string} ArchiveRotator.path file path to archive to
 * @param {string} ArchiveRotator.archiveDate date to prepend to archive folder
 * @param {Array[string]} ArchiveRotator.filesToArchive filenames to archive
 */
class ArchiveRotator {
  constructor(params) {
    this._archivePath = path.join(params.archivePath, params.archiveDate);
    this._filesToArchive = params.filesToArchive;
  }

  rotateSync() {
    try {
      fs.mkdirSync(this._archivePath, { recursive: true });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }

    this._filesToArchive.forEach((fileName) =>
      this._moveSync(
        path.join(fileName),
        path.join(this._archivePath, path.basename(fileName))
      )
    );
  }

  _moveSync(oldPath, newPath) {
    try {
      fs.renameSync(oldPath, newPath);
    } catch (e) {
      if (e.code !== "EXDEV") throw e;
      fs.copyFileSync(oldPath, newPath);
      fs.unlinkSync(oldPath);
    }
  }

  async rotate() {
    try {
      await fs.promises.mkdir(this._archivePath, { recursive: true });
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
    }

    return Promise.all(
      this._filesToArchive.map(async (fileName) =>
        this._move(
          path.join(fileName),
          path.join(this._archivePath, path.basename(fileName))
        )
      )
    );
  }

  async _move(oldPath, newPath) {
    return fs.promises.rename(oldPath, newPath).catch((e) => {
      if (e.code !== "EXDEV") throw e;
      fs.promises.copyFile(oldPath, newPath).then(fs.promises.unlink(oldPath));
    });
  }
}

module.exports = { ArchiveRotator };
