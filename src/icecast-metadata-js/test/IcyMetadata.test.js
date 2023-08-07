import fs from "fs/promises";
import { jest } from "@jest/globals";
import { IcecastMetadataReader } from "icecast-metadata-js";
import { readChunk, readChunks, concatAudio } from "./utils";

const DATA_PATH = "../../test/data/record/";

describe("ICY Metadata Parsing", () => {
  let raw_256k,
    expected_256k,
    raw_16k,
    expected_16k,
    raw_320k_iso_8859_2,
    expected_raw320k_iso_8859_2,
    mockOnMetadataUpdate;

  const somaMetaInt = 16000;
  const isicsMetaInt = 64;

  beforeAll(async () => {
    [
      raw_256k,
      expected_256k,
      raw_16k,
      expected_16k,
      raw_320k_iso_8859_2,
      expected_raw320k_iso_8859_2,
    ] = await Promise.all([
      fs.readFile(DATA_PATH + "256mp3/music-256k.mp3.raw"),
      fs.readFile(DATA_PATH + "256mp3/music-256k.mp3"),
      fs.readFile(DATA_PATH + "no-rollover/isics-all.mp3.raw"),
      fs.readFile(DATA_PATH + "no-rollover/isics-all.mp3"),
      fs.readFile(DATA_PATH + "320mp3_iso-8859-2/music-320k_iso-8859-2.raw"),
      fs.readFile(DATA_PATH + "320mp3_iso-8859-2/music-320k_iso-8859-2.mp3"),
    ]);

    mockOnMetadataUpdate = jest.fn();
  });

  describe("Reading chunks", () => {
    const expectMetadata = (metadata, firstStats, secondStats) => {
      expect(metadata.length).toEqual(2);
      expect(metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
          ...firstStats,
        },
      });
      expect(metadata[1]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          metadataBytesRead: 256,
          streamBytesRead: 6224000,
          totalBytesRead: 6224645,
          ...secondStats,
        },
      });
    };

    it("should return the correct audio given it is read in chunks smaller than the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });

      const returnedValues = readChunks(reader, raw_256k, 15999);

      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15885,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 14965,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should return the correct audio given it is read in chunks larger than the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(reader, raw_256k, 16001);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15889,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 15745,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should return the correct audio given it is read in chunks of equal size to the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(reader, raw_256k, 16000);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15887,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 15355,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should return the correct audio given it is read in chunks of random size", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(
        reader,
        raw_256k,
        Math.floor(Math.random() * 30000),
      );
      const returnedAudio = concatAudio([returnedValues]);

      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should return the correct audio given it is read in chunks of size 10", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: isicsMetaInt });
      const returnedValues = readChunks(reader, raw_16k, 10);

      const returnedAudio = concatAudio([returnedValues]);

      expect(returnedValues.metadata.length).toEqual(259);
      expect(Buffer.compare(returnedAudio, expected_16k)).toEqual(0);
    });
  });

  describe("Metadata Chunks", () => {
    it("should defer metadata update if still reading first metadata chunk", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const noMetadata = readChunk(reader, raw_256k.subarray(0, 16004));
      const metadata = readChunk(reader, raw_256k.subarray(16004, 16800));
      const rest = readChunk(reader, raw_256k.subarray(16800));

      expect(noMetadata.metadata).toEqual([]);
      expect(metadata.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 687,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 112,
          metadataLengthBytesRead: 1,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });

      expect(
        Buffer.compare(
          concatAudio([noMetadata, metadata, rest]),
          expected_256k,
        ),
      ).toEqual(0);
    });

    it("should update metadata as soon as it is available", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const noMetadata = readChunk(reader, raw_256k.subarray(0, 16004));
      const metadata = readChunk(reader, raw_256k.subarray(16004, 16113));
      const rest = readChunk(reader, raw_256k.subarray(16113));

      expect(noMetadata.metadata).toEqual([]);
      expect(metadata.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 0,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 112,
          metadataLengthBytesRead: 1,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(
        Buffer.compare(
          concatAudio([noMetadata, metadata, rest]),
          expected_256k,
        ),
      ).toEqual(0);
    });

    it("should defer metadata update if still reading second metadata chunk", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const firstValue = readChunk(reader, raw_256k.subarray(0, 6224510));
      const secondValue = readChunk(reader, raw_256k.subarray(6224510));

      expect(firstValue.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 6208397,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 112,
          metadataLengthBytesRead: 1,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(firstValue.metadata[1]).toEqual(undefined);

      expect(secondValue.metadata[0]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 2158884,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 256,
          metadataLengthBytesRead: 389,
          streamBytesRead: 6224000,
          totalBytesRead: 6224645,
        },
      });
      expect(
        Buffer.compare(concatAudio([firstValue, secondValue]), expected_256k),
      ).toEqual(0);
    });

    it("should defer metadata update if still reading metadata length byte", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = readChunk(reader, raw_256k.subarray(0, 16000));
      const rest = readChunk(reader, raw_256k.subarray(16000));

      expect(values.metadata.length).toEqual(0);
      expect(
        Buffer.compare(concatAudio([values, rest]), expected_256k),
      ).toEqual(0);
    });

    it("should not update metadata given length byte is zero", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = readChunk(reader, raw_256k.subarray(0, 120000));
      const rest = readChunk(reader, raw_256k.subarray(120000));

      expect(values.metadata.length).toEqual(1);
      expect(
        Buffer.compare(concatAudio([values, rest]), expected_256k),
      ).toEqual(0);
    });

    it("should update metadata as expected given the we are only reading zero or one byte at a time during the length step", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });

      const values = [
        readChunk(reader, raw_256k.subarray(0, 15999)),
        readChunk(reader, raw_256k.subarray(15999, 15999)), // zero bytes
        readChunk(reader, raw_256k.subarray(15999, 16000)), // one byte
        readChunk(reader, raw_256k.subarray(16000, 16000)), // zero bytes
        readChunk(reader, raw_256k.subarray(16000, 16001)), // one byte (metadata length should be here)
        readChunk(reader, raw_256k.subarray(16001, 16001)), // zero bytes
        readChunk(reader, raw_256k.subarray(16001, 120000)),
        readChunk(reader, raw_256k.subarray(120000)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 103887,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 112,
          metadataLengthBytesRead: 1,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(Buffer.compare(concatAudio(values), expected_256k)).toEqual(0);
    });

    it("should update metadata as expected given readBuffer is called with a zero length buffer", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = [
        readChunk(reader, raw_256k.subarray(0, 15243)),
        readChunk(reader, raw_256k.subarray(15243, 15243)),
        readChunk(reader, raw_256k.subarray(15243, 16456)),
        readChunk(reader, raw_256k.subarray(16456)),
      ];

      expect(values[2].metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentBytesRemaining: 343,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataBytesRead: 112,
          metadataLengthBytesRead: 1,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(Buffer.compare(concatAudio(values), expected_256k)).toEqual(0);
    });
  });

  describe("Parsing Metadata", () => {
    it("should parse a metadata string to into a set of key value pairs", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com';\0\0\0\0\0\0";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata does not contain ending null characters", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com';";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata does not contain an ending semi-colon", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com'";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should add incomplete metadata values given the metadata length was not enough", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.c";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.c",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should not add incomplete metadata values given they are malformed", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.c\0\0\0\0";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata contains one key value pair", () => {
      const metadataString = "StreamTitle='The Stream Title';\0\0\0";
      const expectedMetadata = { StreamTitle: "The Stream Title" };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should return an empty object given there is malformed metadata", () => {
      const metadataString = "StreamTitl";
      const expectedMetadata = {};

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata has multiple key value pairs", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com';AnotherKey='Some other value 123';\0";
      const expectedMetadata = {
        AnotherKey: "Some other value 123",
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should return an empty object given there is no metadata", () => {
      const metadataString = "";
      const expectedMetadata = {};

      const returnedMetadata =
        IcecastMetadataReader.parseIcyMetadata(metadataString);

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    describe("Given the metadata keys", () => {
      it("should parse given the metadata key has spaces", () => {
        const metadataString = "Stream Title='The Stream Title';\0";
        const expectedMetadata = { "Stream Title": "The Stream Title" };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given the metadata key is malformed", () => {
        const metadataString = "StreamTitle='The Stream Title';StreamU";
        const expectedMetadata = { StreamTitle: "The Stream Title" };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });
    });

    describe("Given the metadata values", () => {
      it("should parse given the metadata has only one valid key value pair", () => {
        const metadataString = "StreamTitle='The Stream Title';StreamUrl='\0";
        const expectedMetadata = { StreamTitle: "The Stream Title" };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains non alpha numeric characters", () => {
        const metadataString =
          "StreamTitle='Nils Landgren & Jan LundgrenÂ  - Why Did You Let Me Go';\0\0\0\0\0\0";
        const expectedMetadata = {
          StreamTitle: "Nils Landgren & Jan LundgrenÂ  - Why Did You Let Me Go",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains unicode", () => {
        const metadataString =
          "StreamTitle='Nils Ländgren & Jan Lundgren - Why Did You Let Me Go ひらがな';\0\0\0\0\0\0";
        const expectedMetadata = {
          StreamTitle:
            "Nils Ländgren & Jan Lundgren - Why Did You Let Me Go ひらがな",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains a quote", () => {
        const metadataString =
          "StreamTitle='The Stream Title's';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream Title's",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains an equal sign", () => {
        const metadataString =
          "StreamTitle='The Stream = Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream = Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains an equal sign", () => {
        const metadataString =
          "StreamTitle='The Stream = Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream = Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains a semi-colon", () => {
        const metadataString =
          "StreamTitle='The Stream;Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream;Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value is an empty string", () => {
        const metadataString = "StreamTitle='';";
        const expectedMetadata = {
          StreamTitle: "",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata there are two values that are empty strings", () => {
        const metadataString = "StreamTitle='';StreamUrl='';";
        const expectedMetadata = {
          StreamTitle: "",
          StreamUrl: "",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata the first value is an empty string", () => {
        const metadataString = "StreamTitle='';StreamUrl='some url';";
        const expectedMetadata = {
          StreamTitle: "",
          StreamUrl: "some url",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata the second value is an empty string", () => {
        const metadataString = "StreamTitle='some title';StreamUrl='';";
        const expectedMetadata = {
          StreamTitle: "some title",
          StreamUrl: "",
        };

        const returnedMetadata =
          IcecastMetadataReader.parseIcyMetadata(metadataString);

        expect(returnedMetadata).toEqual(expectedMetadata);
      });
    });
  });

  describe("Detecting Metadata", () => {
    const warn = console.warn;
    beforeAll(() => {
      console.warn = jest.fn();
    });

    afterAll(() => {
      console.warn = warn;
    });

    const expectMetadata = (metadata, firstStats, secondStats) => {
      expect(metadata.length).toEqual(2);
      expect(metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
          ...firstStats,
        },
      });
      expect(metadata[1]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          metadataBytesRead: 256,
          streamBytesRead: 6224000,
          totalBytesRead: 6224645,
          ...secondStats,
        },
      });
    };

    it("should detect the metadata and return the correct audio given it is read in chunks smaller than the metaint", () => {
      const reader = new IcecastMetadataReader();
      const returnedValues = readChunks(reader, raw_256k, 15999);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15885,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 14965,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should detect the metadata and return the correct audio given it is read in chunks larger than the metaint", () => {
      const reader = new IcecastMetadataReader();
      const returnedValues = readChunks(reader, raw_256k, 16001);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15889,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 15745,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should detect the metadata and return the correct audio given it is read in chunks of equal size to the metaint", () => {
      const reader = new IcecastMetadataReader();
      const returnedValues = readChunks(reader, raw_256k, 16000);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(
        returnedValues.metadata,
        {
          currentBytesRemaining: 15887,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 1,
        },
        {
          currentBytesRemaining: 15355,
          currentMetadataBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
          metadataLengthBytesRead: 389,
        },
      );
      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should detect the metadata and return the correct audio given it is read in chunks of random size", () => {
      const reader = new IcecastMetadataReader();
      const returnedValues = readChunks(
        reader,
        raw_256k,
        Math.floor(Math.random() * 30000),
      );
      const returnedAudio = concatAudio([returnedValues]);

      expect(Buffer.compare(returnedAudio, expected_256k)).toEqual(0);
    });

    it("should detect the metadata and return the correct audio given it is read in chunks of size 10", () => {
      const reader = new IcecastMetadataReader();
      const returnedValues = readChunks(reader, raw_16k, 10);

      const returnedAudio = concatAudio([returnedValues]);

      expect(returnedValues.metadata.length).toEqual(259);
      expect(Buffer.compare(returnedAudio, expected_16k)).toEqual(0);
    });
  });

  describe("Icy Metadata Character Encoding", () => {
    it("should decode metadata based on the passed in character encoding", async () => {
      const reader = new IcecastMetadataReader({
        icyCharacterEncoding: "iso-8859-2",
      });
      const returnedValues = readChunk(reader, raw_320k_iso_8859_2);
      const returnedAudio = concatAudio([returnedValues]);

      expect(returnedValues.metadata.length).toEqual(2);
      expect(returnedValues.metadata[0]).toEqual({
        metadata: { StreamTitle: "Katona Klári - Vigyél el" },
        stats: {
          totalBytesRead: 4145,
          streamBytesRead: 4096,
          metadataLengthBytesRead: 1,
          metadataBytesRead: 48,
          currentBytesRemaining: 3446017,
          currentStreamBytesRemaining: 0,
          currentMetadataBytesRemaining: 0,
        },
      });
      expect(returnedValues.metadata[1]).toEqual({
        metadata: { StreamTitle: "Auth Csilla - El Kell, Hogy Engedj" },
        stats: {
          totalBytesRead: 1163660,
          streamBytesRead: 1163264,
          metadataLengthBytesRead: 284,
          metadataBytesRead: 112,
          currentBytesRemaining: 2286502,
          currentStreamBytesRemaining: 0,
          currentMetadataBytesRemaining: 0,
        },
      });

      expect(
        Buffer.compare(returnedAudio, expected_raw320k_iso_8859_2),
      ).toEqual(0);
    });
  });
});
