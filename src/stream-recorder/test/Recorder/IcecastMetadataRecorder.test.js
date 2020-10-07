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

const fs = require("fs");
const fetch = require("node-fetch");
const IcecastMetadataRecorder = require("../../src/Recorder/IcecastMetadataRecorder");

jest.mock("node-fetch");

describe("Given the IcecastMetadataRecorder", () => {
  const realDate = Date.now;
  let metadataRecorder;

  beforeAll(() => {
    global.Date.now = jest.fn(() => 1596057371222);
  });

  afterAll(() => {
    global.Date.now = realDate;
  });

  const matchFiles = (expectedPath, actualPath, fileName) =>
    Promise.all([
      fs.promises.readFile(expectedPath + fileName),
      fs.promises.readFile(actualPath + fileName),
    ]).then(([expected, actual]) => Buffer.compare(expected, actual));

  const assertFilesMatch = (expectedPath, actualPath, fileName) => {
    it(`should match ${fileName}`, (done) => {
      matchFiles(expectedPath, actualPath, fileName).then((notMatch) => {
        expect(notMatch).toBeFalsy();
        done();
      });
    });
  };

  const runIcecastParser = (params, headers, done) => {
    const body = fs.createReadStream(
      `${params.expectedPath}${params.expectedFileName}.${params.expectedFileFormat}.raw`
    );

    fetch.mockResolvedValue({ headers, body });

    metadataRecorder = new IcecastMetadataRecorder({
      output: `${params.actualPath}${params.expectedFileName}.${params.expectedFileFormat}`,
      dateEntries: params.expectedDateEntries,
      prependDate: params.expectedPrependDate,
      name: params.expectedStreamTitle,
      endpoint: "https://example.com",
      cueRollover: params.expectedCueRollover,
    });

    metadataRecorder.record().then(() => done());
  };

  describe("Given no cue rollover", () => {
    const actualPath = "../../test/temp/";
    const expectedPath = "../../test/data/record/no-rollover/";
    const expectedFileName = "isics-all";
    const expectedFileFormat = "mp3";
    const expectedStreamTitle = "isics-all";
    const expectedPrependDate = true;

    beforeAll((done) => {
      const headers = new Map();
      headers.set("icy-br", "16");
      headers.set("icy-metaint", "64");

      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectedPrependDate,
        },
        headers,
        done
      );
    });

    it("should match isics-all.mp3", (done) => {
      matchFiles(expectedPath, actualPath, "isics-all.mp3").then((notMatch) => {
        expect(notMatch).toBeFalsy();
        done();
      });
    });

    it("should match isics-all.cue", (done) => {
      matchFiles(expectedPath, actualPath, "isics-all.cue").then((notMatch) => {
        expect(notMatch).toBeFalsy();
        done();
      });
    });
  });

  describe("Given Cue rollover is set to 10", () => {
    const actualPath = "../../test/temp/";
    const expectedPath = "../../test/data/record/rollover/";
    const expectedFileName = "isics-all";
    const expectedFileFormat = "mp3";
    const expectedStreamTitle = "isics-all";
    const expectedPrependDate = true;
    const expectedCueRollover = 10;

    beforeAll((done) => {
      const headers = new Map();
      headers.set("icy-br", "16");
      headers.set("icy-metaint", "64");

      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectedPrependDate,
          expectedCueRollover,
        },
        headers,
        done
      );
    });

    it("should match isics-all.mp3", (done) => {
      matchFiles(expectedPath, actualPath, "isics-all.mp3").then((notMatch) => {
        expect(notMatch).toBeFalsy();
        done();
      });
    });

    it("should match isics-all.cue", (done) => {
      matchFiles(expectedPath, actualPath, "isics-all.cue").then((notMatch) => {
        expect(notMatch).toBeFalsy();
        done();
      });
    });

    it("should return the correct file names written", () => {
      expect(metadataRecorder.fileNames).toEqual([
        "../../test/temp/isics-all.mp3",
        "../../test/temp/isics-all.cue",
        "../../test/temp/isics-all.1.cue",
        "../../test/temp/isics-all.2.cue",
        "../../test/temp/isics-all.3.cue",
        "../../test/temp/isics-all.4.cue",
        "../../test/temp/isics-all.5.cue",
        "../../test/temp/isics-all.6.cue",
        "../../test/temp/isics-all.7.cue",
        "../../test/temp/isics-all.8.cue",
        "../../test/temp/isics-all.9.cue",
        "../../test/temp/isics-all.10.cue",
        "../../test/temp/isics-all.11.cue",
        "../../test/temp/isics-all.12.cue",
        "../../test/temp/isics-all.13.cue",
        "../../test/temp/isics-all.14.cue",
        "../../test/temp/isics-all.15.cue",
        "../../test/temp/isics-all.16.cue",
        "../../test/temp/isics-all.17.cue",
        "../../test/temp/isics-all.18.cue",
        "../../test/temp/isics-all.19.cue",
        "../../test/temp/isics-all.20.cue",
        "../../test/temp/isics-all.21.cue",
        "../../test/temp/isics-all.22.cue",
        "../../test/temp/isics-all.23.cue",
        "../../test/temp/isics-all.24.cue",
        "../../test/temp/isics-all.25.cue",
        "../../test/temp/isics-all.26.cue",
        "../../test/temp/isics-all.27.cue",
        "../../test/temp/isics-all.28.cue",
        "../../test/temp/isics-all.29.cue",
        "../../test/temp/isics-all.30.cue",
        "../../test/temp/isics-all.31.cue",
        "../../test/temp/isics-all.32.cue",
        "../../test/temp/isics-all.33.cue",
      ]);
    });

    new Array(32)
      .fill({})
      .map((value, i) =>
        assertFilesMatch(
          expectedPath,
          actualPath,
          `${expectedFileName}.${i + 1}.cue`
        )
      );
  });

  describe("Given mp3 256k music", () => {
    const actualPath = "../../test/temp/";
    const expectedPath = "../../test/data/record/256mp3/";
    const expectedFileName = "music-256k";
    const expectedFileFormat = "mp3";
    const expectedPrependDate = false;

    beforeAll((done) => {
      const headers = new Map();
      headers.set("icy-br", "256");
      headers.set("icy-metaint", "16000");
      headers.set("icy-genre", "Techno Ambient Space");
      headers.set(
        "icy-name",
        "Drone Zone: Atmospheric ambient space music. Serve Best Chilled. Safe with most medications. [SomaFM]"
      );
      headers.set(
        "icy-notice1",
        `<BR>This stream requires <a href="http://www.winamp.com/">Winamp</a><BR>`
      );
      headers.set(
        "icy-notice2",
        `SHOUTcast Distributed Network Audio Server/Linux v1.9.5<BR>`
      );
      headers.set("icy-pub", "0");
      headers.set("icy-url", "http://somafm.com");

      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedPrependDate,
        },
        headers,
        done
      );
    });

    it("should match music-256k.mp3", (done) => {
      matchFiles(expectedPath, actualPath, "music-256k.mp3").then(
        (notMatch) => {
          expect(notMatch).toBeFalsy();
          done();
        }
      );
    });

    it("should match music-256k.cue", (done) => {
      matchFiles(expectedPath, actualPath, "music-256k.cue").then(
        (notMatch) => {
          expect(notMatch).toBeFalsy();
          done();
        }
      );
    });
  });

  describe("Given aac 128k music", () => {
    const actualPath = "../../test/temp/";
    const expectedPath = "../../test/data/record/128aac/";
    const expectedFileFormat = "aac";
    const expectedFileName = "music-128k";
    const expectedStreamTitle = "Deep Space One";
    const expectedPrependDate = false;
    const expectedDateEntries = true;

    beforeAll((done) => {
      const headers = new Map();
      headers.set("icy-br", "128");
      headers.set("icy-metaint", "16000");
      headers.set("icy-genre", "Ambient Space");
      headers.set(
        "icy-name",
        "Deep Space One: Deep ambient electronic and space music. [SomaFM]"
      );
      headers.set(
        "icy-notice1",
        `<BR>This stream requires <a href="http://www.winamp.com/">Winamp</a><BR>`
      );
      headers.set(
        "icy-notice2",
        `SHOUTcast Distributed Network Audio Server/Linux v1.9.5<BR>`
      );
      headers.set("icy-pub", "0");
      headers.set("icy-url", "http://somafm.com");
      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectedPrependDate,
          expectedDateEntries,
        },
        headers,
        done
      );
    });

    it("should match music-128k.aac", (done) => {
      matchFiles(expectedPath, actualPath, "music-128k.aac").then(
        (notMatch) => {
          expect(notMatch).toBeFalsy();
          done();
        }
      );
    });

    it("should match music-128k.cue", (done) => {
      matchFiles(expectedPath, actualPath, "music-128k.cue").then(
        (notMatch) => {
          expect(notMatch).toBeFalsy();
          done();
        }
      );
    });
  });
});
