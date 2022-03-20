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

import fs from "fs";
import path from "path";

/**
 * @description Moves files into an archive file path
 * @param {object} ArchiveRotator constructor
 * @param {string} ArchiveRotator.path file path to archive to
 * @param {string} ArchiveRotator.archiveDate date to prepend to archive folder
 * @param {Array[string]} ArchiveRotator.filesToArchive filenames to archive
 */
export default class ArchiveRotator {
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
    await fs.promises
      .mkdir(this._archivePath, { recursive: true })
      .catch((e) => {
        if (e.code !== "EEXIST") throw e;
      });

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
      return fs.promises
        .copyFile(oldPath, newPath)
        .then(fs.promises.unlink(oldPath));
    });
  }
}
