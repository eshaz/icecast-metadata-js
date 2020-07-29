const fs = require("fs");
const fetch = require("node-fetch");
const exec = require("child_process").exec;

const {
  IcecastMetadataRecorder,
} = require("../../src/Recorder/IcecastMetadataRecorder");

jest.mock("node-fetch");

const testFileOutputPath = "./test/Recorder/";
const testDataPath = "./test/test-data/";

describe("Given the IcecastMetadataRecorder", () => {
  beforeEach(() => {
    console.log(process.cwd());
    const body = fs.createReadStream(`${testDataPath}isics-all.mp3.raw`);
    const headers = new Map();
    headers.set("Icy-Br", "16");
    headers.set("Icy-MetaInt", "64");

    fetch.mockResolvedValue({ headers, body });
  });

  it("should parse add the exact cue entries given the incoming metadata", (done) => {
    const metadataRecorder = new IcecastMetadataRecorder({
      output: `${testFileOutputPath}isics-all.mp3.actual`,
      name: "isics-all",
      endpoint: "https://example.com",
    });

    metadataRecorder.record();

    exec(
      `diff -c ${testDataPath}isics-all.mp3.expected ${testFileOutputPath}isics-all.mp3.actual`,
      (error, stdout, stderr) => {
        console.log(stdout);
        expect(stdout).toBeFalsy();
        done();
      }
    );
  });
});
