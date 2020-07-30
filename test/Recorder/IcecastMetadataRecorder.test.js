const fs = require("fs");
const fetch = require("node-fetch");
const exec = require("child_process").exec;

const {
  IcecastMetadataRecorder,
} = require("../../src/Recorder/IcecastMetadataRecorder");
const { ContextReplacementPlugin } = require("webpack");

jest.mock("node-fetch");

describe("Given the IcecastMetadataRecorder", () => {
  const realDate = Date.now;

  beforeAll(() => {
    global.Date.now = jest.fn(() => 1596057371222);
  });

  afterAll(() => {
    global.Date.now = realDate;
  });

  const assertFilesMatch = (expectedPath, actualPath, fileName) => {
    it(`should match ${fileName}`, (done) => {
      Promise.all([
        fs.promises.readFile(expectedPath + fileName),
        fs.promises.readFile(actualPath + fileName),
      ]).then(([expected, actual]) => {
        expect(Buffer.compare(expected, actual)).toBeFalsy();
        done();
      });
    });
  };

  const runIcecastParser = (params, done) => {
    const body = fs.createReadStream(
      `${params.expectedPath}${params.expectedFileName}.${params.expectedFileFormat}.raw`
    );
    const headers = new Map();
    headers.set("Icy-Br", params.expectecIcyBr);
    headers.set("Icy-MetaInt", params.expectedIcyMetaInt);

    fetch.mockResolvedValue({ headers, body });

    const metadataRecorder = new IcecastMetadataRecorder(
      {
        output: `${params.actualPath}${params.expectedFileName}.${params.expectedFileFormat}`,
        name: params.expectedStreamTitle,
        endpoint: "https://example.com",
        cueRollover: params.expectedCueRollover,
      },
      done
    );

    metadataRecorder.record();
  };

  describe("Given no cue rollover", () => {
    const actualPath = "./test/temp/";
    const expectedPath = "./test/data/record/no-rollover/";
    const expectedFileName = "isics-all";
    const expectedFileFormat = "mp3";
    const expectedStreamTitle = "isics-all";
    const expectecIcyBr = "16";
    const expectedIcyMetaInt = "64";

    beforeAll((done) => {
      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectecIcyBr,
          expectedIcyMetaInt,
        },
        done
      );
    });

    assertFilesMatch(
      expectedPath,
      actualPath,
      `${expectedFileName}.${expectedFileFormat}`
    );

    assertFilesMatch(expectedPath, actualPath, `${expectedFileName}.cue`);
  });

  describe("Given Cue rollover is set to 10", () => {
    const actualPath = "./test/temp/";
    const expectedPath = "./test/data/record/rollover/";
    const expectedFileName = "isics-all";
    const expectedFileFormat = "mp3";
    const expectedStreamTitle = "isics-all";
    const expectecIcyBr = "16";
    const expectedIcyMetaInt = "64";
    const expectedCueRollover = 10;

    beforeAll((done) => {
      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectecIcyBr,
          expectedIcyMetaInt,
          expectedCueRollover,
        },
        done
      );
    });

    assertFilesMatch(
      expectedPath,
      actualPath,
      `${expectedFileName}.${expectedFileFormat}`
    );

    assertFilesMatch(expectedPath, actualPath, `${expectedFileName}.cue`);

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
    const actualPath = "./test/temp/";
    const expectedPath = "./test/data/record/256mp3/";
    const expectedFileName = "music-256k";
    const expectedFileFormat = "mp3";
    const expectedStreamTitle = "Drone Zone";
    const expectecIcyBr = "256";
    const expectedIcyMetaInt = "16000";

    beforeAll((done) => {
      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectecIcyBr,
          expectedIcyMetaInt,
        },
        done
      );
    });

    assertFilesMatch(
      expectedPath,
      actualPath,
      `${expectedFileName}.${expectedFileFormat}`
    );

    assertFilesMatch(expectedPath, actualPath, `${expectedFileName}.cue`);
  });

  describe("Given aac 128k music", () => {
    const actualPath = "./test/temp/";
    const expectedPath = "./test/data/record/128aac/";
    const expectedFileFormat = "aac";
    const expectedFileName = "music-128k";
    const expectedStreamTitle = "Deep Space One";
    const expectecIcyBr = "128";
    const expectedIcyMetaInt = "16000";

    beforeAll((done) => {
      runIcecastParser(
        {
          actualPath,
          expectedPath,
          expectedFileName,
          expectedFileFormat,
          expectedStreamTitle,
          expectecIcyBr,
          expectedIcyMetaInt,
        },
        done
      );
    });

    assertFilesMatch(
      expectedPath,
      actualPath,
      `${expectedFileName}.${expectedFileFormat}`
    );

    assertFilesMatch(expectedPath, actualPath, `${expectedFileName}.cue`);
  });
});
