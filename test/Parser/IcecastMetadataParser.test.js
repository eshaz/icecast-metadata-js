const fs = require("fs");
const IcecastMetadataParser = require("../../src/Parser/IcecastMetadataParser");

describe("Icecast Metadata Parser", () => {
  let rawData,
    expectedAudio,
    icecastMetadataParser,
    mockOnMetadata,
    mockOnMetadataUpdate;

  const metaInt = 16000;

  beforeAll((done) => {
    Promise.all([
      fs.promises.readFile("test/data/record/256mp3/music-256k.mp3.raw"),
      fs.promises.readFile("test/data/record/256mp3/music-256k.mp3"),
    ]).then(([raw, expected]) => {
      rawData = raw;
      expectedAudio = expected;
      done();
    });

    mockOnMetadata = jest.fn();
    mockOnMetadataUpdate = jest.fn();

    icecastMetadataParser = new IcecastMetadataParser({
      icyBr: 256,
      icyMetaInt: metaInt,
      disableMetadataUpdates: true,
      onMetadata: mockOnMetadata,
      onMetadataUpdate: mockOnMetadataUpdate,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
    icecastMetadataParser.reset();
  });

  it("should expose audio data in get stream from an Icecast response binary", () => {
    icecastMetadataParser.readBuffer(rawData, 0, 0);

    const expectedAudio = fs.readFileSync(
      "test/data/record/256mp3/music-256k.mp3"
    );

    expect(
      Buffer.compare(icecastMetadataParser.stream, expectedAudio)
    ).toBeFalsy();
  });

  it("should call the onMetadata callback for each metadata updates", () => {
    icecastMetadataParser.readBuffer(rawData, 0, 0);

    expect(mockOnMetadata.mock.calls[0][0]).toEqual({
      metadata: {
        StreamTitle: "Djivan Gasparyan - Brother Hunter",
        StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
      },
      time: 0.5,
    });
    expect(mockOnMetadata.mock.calls[1][0]).toEqual({
      metadata: {
        StreamTitle:
          "Harold Budd & John Foxx - Some Way Through All The Cities",
        StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
      },
      time: 194.5,
    });
    expect(mockOnMetadata.mock.calls[2]).toEqual(undefined);
  });

  describe("Reading chunks", () => {
    const readChunks = (sizeToRead) => {
      let offset = 0;

      while (offset <= rawData.length) {
        const chunk = rawData.subarray(offset, sizeToRead + offset);
        icecastMetadataParser.readBuffer(chunk, 0, 0);

        offset += sizeToRead;
      }
    };

    const expectMetadata = () => {
      expect(mockOnMetadata.mock.calls[0][0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 0.5,
      });
      expect(mockOnMetadata.mock.calls[1][0]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 194.5,
      });
      expect(mockOnMetadata.mock.calls[2]).toEqual(undefined);
    };
    it("should return the correct audio given it is read in chunks larger than the metaint", () => {
      readChunks(15999);
      expect(
        Buffer.compare(icecastMetadataParser.stream, expectedAudio)
      ).toBeFalsy();
      expectMetadata();
    });

    it("should return the correct audio given it is read in chunks smaller than the metaint", () => {
      readChunks(16001);
      expect(
        Buffer.compare(icecastMetadataParser.stream, expectedAudio)
      ).toBeFalsy();
      expectMetadata();
    });

    it("should return the correct audio given it is read in chunks of equal size to the metaint", () => {
      readChunks(16000);
      expect(
        Buffer.compare(icecastMetadataParser.stream, expectedAudio)
      ).toBeFalsy();
      expectMetadata();
    });
    it("should return the correct audio given it is read in chunks of random size", () => {
      readChunks(Math.floor(Math.random() * 30000));

      expect(
        Buffer.compare(icecastMetadataParser.stream, expectedAudio)
      ).toBeFalsy();
      expectMetadata();
    });
  });

  describe("Metadata Chunks", () => {
    it("should defer metadata update if still reading first metadata chunk", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 16004), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(16004, 16800), 0, 0);

      expect(mockOnMetadata.mock.calls[0][0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 0.5,
      });
      expect(mockOnMetadata.mock.calls[1]).toEqual(undefined);
    });

    it("should defer metadata update if still reading second metadata chunk", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 6224510), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(6224510), 0, 0);

      expect(mockOnMetadata.mock.calls[0][0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 0.5,
      });
      expect(mockOnMetadata.mock.calls[1][0]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 194.5,
      });
      expect(mockOnMetadata.mock.calls[2]).toEqual(undefined);
    });

    it("should defer metadata update if still reading metadata length byte", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 16000));

      expect(mockOnMetadata).toBeCalledTimes(0);
    });

    it("should not update metadata given length byte is zero", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 120000), 0, 0);

      expect(mockOnMetadata).toBeCalledTimes(1);
    });

    it("should update metadata as expected given the we are only reading zero or one byte at a time during the length step", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 15999), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(15999, 15999), 0, 0); // zero bytes
      icecastMetadataParser.readBuffer(rawData.subarray(15999, 16000), 0, 0); // one byte
      icecastMetadataParser.readBuffer(rawData.subarray(16000, 16000), 0, 0); // zero bytes
      icecastMetadataParser.readBuffer(rawData.subarray(16000, 16001), 0, 0); // one byte (metadata length should be here)
      icecastMetadataParser.readBuffer(rawData.subarray(16001, 16001), 0, 0); // zero bytes
      icecastMetadataParser.readBuffer(rawData.subarray(16001, 120000), 0, 0);

      expect(mockOnMetadata.mock.calls[0][0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 0.5,
      });

      expect(mockOnMetadata).toBeCalledTimes(1);
    });
    it("should update metadata as expected given readBuffer is called with a zero length buffer", () => {
      icecastMetadataParser.readBuffer(rawData.subarray(0, 15243), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(15243, 15243), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(15243, 16456), 0, 0);
      icecastMetadataParser.readBuffer(rawData.subarray(16456, 120000), 0, 0);

      expect(mockOnMetadata.mock.calls[0][0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        time: 0.5,
      });

      expect(mockOnMetadata).toBeCalledTimes(1);
    });
  });
});
