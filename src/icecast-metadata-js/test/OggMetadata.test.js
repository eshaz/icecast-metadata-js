import fs from "fs";
import { jest } from "@jest/globals";
import { IcecastMetadataReader } from "icecast-metadata-js";
import { readChunk, readChunks, concatAudio } from "./utils";

const expectedVorbisMetadata = [
  {
    metadata: {
      VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
      TITLE: "Talk Talk - The Rainbow",
      SERVER: "Icecast 2.4.0-kh15",
    },
    stats: {
      totalBytesRead: 222,
      streamBytesRead: 222,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 114,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
      TITLE: "Beethoven - Für Elise",
      SERVER: "Icecast 2.4.0-kh15",
    },
    stats: {
      totalBytesRead: 238498,
      streamBytesRead: 238498,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 227,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
      TITLE: "No Doubt - Bathwater",
      SERVER: "Icecast 2.4.0-kh15",
    },
    stats: {
      totalBytesRead: 4260341,
      streamBytesRead: 4260341,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 338,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
      TITLE: "The Doors - Love Her Madly",
      SERVER: "Icecast 2.4.0-kh15",
    },
    stats: {
      totalBytesRead: 9834370,
      streamBytesRead: 9834370,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 455,
      currentMetadataBytesRemaining: 0,
    },
  },
];

const expectedVorbisChainedMetadata = [
  {
    metadata: {
      ALBUM: "Wendolins Monocle",
      ARTIST: "Owls",
      DATE: "2022",
      TITLE: "The Fisherman and his Soul",
      VENDOR_STRING: "Xiph.Org libVorbis I 20200704 (Reducing Environment)",
    },
    stats: {
      currentBytesRemaining: undefined,
      currentMetadataBytesRemaining: 0,
      currentStreamBytesRemaining: undefined,
      metadataBytesRead: 151,
      metadataLengthBytesRead: 0,
      streamBytesRead: 261,
      totalBytesRead: 261,
    },
  },
  {
    metadata: {
      ALBUM: "Women",
      ARTIST: "Christian Havel & Erwin Schmidt",
      DATE: "2019",
      GENRE: "Jazz",
      TITLE: "Norwegian Wood",
      VENDOR_STRING: "Xiph.Org libVorbis I 20200704 (Reducing Environment)",
    },
    stats: {
      currentBytesRemaining: undefined,
      currentMetadataBytesRemaining: 0,
      currentStreamBytesRemaining: undefined,
      metadataBytesRead: 319,
      metadataLengthBytesRead: 0,
      streamBytesRead: 2939105,
      totalBytesRead: 2939105,
    },
  },
];

const expectedOpusMetadata = [
  {
    metadata: {
      VENDOR_STRING: "ocaml-opus by the Savonet Team.",
      TITLE: "LIVIN' JOY - DON'T STOP MOVIN'",
    },
    stats: {
      totalBytesRead: 162,
      streamBytesRead: 162,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 79,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "ocaml-opus by the Savonet Team.",
      TITLE: "RADIO DANCEFLOOR 90s",
    },
    stats: {
      totalBytesRead: 2031484,
      streamBytesRead: 2031484,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 148,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "ocaml-opus by the Savonet Team.",
      TITLE: "BUS STOP FEAT CARL DOUGLAS - KUNG FU FIGHTING RMX",
    },
    stats: {
      totalBytesRead: 2231148,
      streamBytesRead: 2231148,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 246,
      currentBytesRemaining: undefined,
      currentStreamBytesRemaining: undefined,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "ocaml-opus by the Savonet Team.",
      TITLE: "90s SELECTION_AUGURI",
    },
    stats: {
      totalBytesRead: 6598999,
      streamBytesRead: 6598999,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 315,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      VENDOR_STRING: "ocaml-opus by the Savonet Team.",
      TITLE: "S.M.S. FEAT. REHB - JUST A BEAT OF CHAOS",
    },
    stats: {
      totalBytesRead: 6669753,
      streamBytesRead: 6669753,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 404,
      currentMetadataBytesRemaining: 0,
    },
  },
];

const expectedOggFlacMetadata = [
  {
    metadata: { VENDOR_STRING: "reference libFLAC 1.3.2 20170101" },
    stats: {
      totalBytesRead: 151,
      streamBytesRead: 151,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 40,
      currentMetadataBytesRemaining: 0,
    },
  },
];

const expectedIcyFlacMetadata = [
  {
    metadata: { VENDOR_STRING: "reference libFLAC 1.3.2 20170101" },
    stats: {
      totalBytesRead: 151,
      streamBytesRead: 151,
      metadataLengthBytesRead: 0,
      metadataBytesRead: 40,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 524353,
      streamBytesRead: 524288,
      metadataLengthBytesRead: 1,
      metadataBytesRead: 64,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 1048706,
      streamBytesRead: 1048576,
      metadataLengthBytesRead: 2,
      metadataBytesRead: 128,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 1573059,
      streamBytesRead: 1572864,
      metadataLengthBytesRead: 3,
      metadataBytesRead: 192,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 2097412,
      streamBytesRead: 2097152,
      metadataLengthBytesRead: 4,
      metadataBytesRead: 256,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 2621765,
      streamBytesRead: 2621440,
      metadataLengthBytesRead: 5,
      metadataBytesRead: 320,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 3146118,
      streamBytesRead: 3145728,
      metadataLengthBytesRead: 6,
      metadataBytesRead: 384,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 3670471,
      streamBytesRead: 3670016,
      metadataLengthBytesRead: 7,
      metadataBytesRead: 448,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 4194824,
      streamBytesRead: 4194304,
      metadataLengthBytesRead: 8,
      metadataBytesRead: 512,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 4719177,
      streamBytesRead: 4718592,
      metadataLengthBytesRead: 9,
      metadataBytesRead: 576,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 5243530,
      streamBytesRead: 5242880,
      metadataLengthBytesRead: 10,
      metadataBytesRead: 640,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 5767883,
      streamBytesRead: 5767168,
      metadataLengthBytesRead: 11,
      metadataBytesRead: 704,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 6292236,
      streamBytesRead: 6291456,
      metadataLengthBytesRead: 12,
      metadataBytesRead: 768,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 6816589,
      streamBytesRead: 6815744,
      metadataLengthBytesRead: 13,
      metadataBytesRead: 832,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 7340942,
      streamBytesRead: 7340032,
      metadataLengthBytesRead: 14,
      metadataBytesRead: 896,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 7865295,
      streamBytesRead: 7864320,
      metadataLengthBytesRead: 15,
      metadataBytesRead: 960,
      currentBytesRemaining: undefined,
      currentStreamBytesRemaining: undefined,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 8389648,
      streamBytesRead: 8388608,
      metadataLengthBytesRead: 16,
      metadataBytesRead: 1024,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 8914001,
      streamBytesRead: 8912896,
      metadataLengthBytesRead: 17,
      metadataBytesRead: 1088,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 9438354,
      streamBytesRead: 9437184,
      metadataLengthBytesRead: 18,
      metadataBytesRead: 1152,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 9962707,
      streamBytesRead: 9961472,
      metadataLengthBytesRead: 19,
      metadataBytesRead: 1216,
      currentMetadataBytesRemaining: 0,
    },
  },
  {
    metadata: {
      StreamTitle: "Steve Winwood - Back In The High Life Again",
    },
    stats: {
      totalBytesRead: 10487060,
      streamBytesRead: 10485760,
      metadataLengthBytesRead: 20,
      metadataBytesRead: 1280,
      currentMetadataBytesRemaining: 0,
    },
  },
];

const rawIcyFlac = fs.readFileSync(
  "../../test/data/record/ogg/icy-flac.ogg.raw",
);
const icyFlac = fs.readFileSync("../../test/data/record/ogg/icy-flac.ogg");
const oggFlac = fs.readFileSync("../../test/data/record/ogg/ogg-flac.ogg");
const oggFlacContinuedPages = fs.readFileSync(
  "../../test/data/record/ogg/ogg-flac-continued-pages.ogg",
);
const oggOpus = fs.readFileSync("../../test/data/record/ogg/opus.ogg");
const oggVorbis = fs.readFileSync("../../test/data/record/ogg/vorbis.ogg");
const oggVorbisChained = fs.readFileSync(
  "../../test/data/record/ogg/vorbis.chained.ogg",
);

const flacMetaInt = 524288;

describe("Ogg Metadata Parsing", () => {
  const getMetadata = (metadata) =>
    metadata.map((meta) => ({
      ...meta,
      stats: {
        ...meta.stats,
        currentStreamBytesRemaining: undefined,
        currentBytesRemaining: undefined,
      },
    }));

  const test_ReadingChunks = (
    testName,
    testData,
    metadataTypes,
    expectedMetadata,
  ) => {
    it(
      testName +
        " should return the correct audio and metadata given it is read in chunks of size 10000",
      () => {
        const reader = new IcecastMetadataReader({ metadataTypes });

        const returnedValues = readChunks(reader, testData, 10000);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedMetadata);
        expect(Buffer.compare(returnedAudio, testData)).toEqual(0);
      },
    );

    it(
      testName +
        " should return the correct audio and metadata given it is read in chunks of size 4000",
      () => {
        const reader = new IcecastMetadataReader({ metadataTypes });

        const returnedValues = readChunks(reader, testData, 4000);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedMetadata);
        expect(Buffer.compare(returnedAudio, testData)).toEqual(0);
      },
    );

    it(
      testName +
        " should return the correct audio and metadata given it is read in chunks of size 10",
      () => {
        const reader = new IcecastMetadataReader({ metadataTypes });

        const returnedValues = readChunks(reader, testData, 10);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedMetadata);
        expect(Buffer.compare(returnedAudio, testData)).toEqual(0);
      },
    );

    it(
      testName +
        " should return the correct audio given it is read in chunks of random size",
      () => {
        const reader = new IcecastMetadataReader({ metadataTypes });

        const returnedValues = readChunks(
          reader,
          testData,
          Math.floor(Math.random() * 30000),
        );
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedMetadata);
        expect(Buffer.compare(returnedAudio, testData)).toEqual(0);
      },
    );
  };

  describe("Reading chunks", () => {
    //test_ReadingChunks("rawIcyFlac", rawIcyFlac, ["ogg"], expectedIcyFlacMetadata);
    //test_ReadingChunks("icyFlac", icyFlac, ["ogg"], expectedIcyFlacMetadata);
    test_ReadingChunks("oggFlac", oggFlac, ["ogg"], expectedOggFlacMetadata);
    test_ReadingChunks("oggOpus", oggOpus, ["ogg"], expectedOpusMetadata);
    test_ReadingChunks("oggVorbis", oggVorbis, ["ogg"], expectedVorbisMetadata);
    test_ReadingChunks(
      "oggVorbisChained",
      oggVorbisChained,
      ["ogg"],
      expectedVorbisChainedMetadata,
    );
  });

  describe("Codecs", () => {
    describe("Ogg Vorbis", () => {
      it("should return the correct audio and metadata", () => {
        const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

        const returnedValues = readChunk(reader, oggVorbis);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedVorbisMetadata);
        expect(Buffer.compare(returnedAudio, oggVorbis)).toEqual(0);
      });
    });

    describe("Ogg Vorbis Chained", () => {
      it("should return the correct audio and metadata", () => {
        const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

        const returnedValues = readChunk(reader, oggVorbisChained);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedVorbisChainedMetadata);
        expect(Buffer.compare(returnedAudio, oggVorbisChained)).toEqual(0);
      });
    });

    describe("Ogg Opus", () => {
      it("should return the correct audio and metadata", () => {
        const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

        const returnedValues = readChunk(reader, oggOpus);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedOpusMetadata);
        expect(Buffer.compare(returnedAudio, oggOpus)).toEqual(0);
      });
    });

    describe("Ogg Flac", () => {
      it("should return the correct audio and metadata", () => {
        const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

        const returnedValues = readChunk(reader, oggFlac);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedOggFlacMetadata);
        expect(Buffer.compare(returnedAudio, oggFlac)).toEqual(0);
      });

      it("should return the correct audio and metadata with continued pages", () => {
        const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

        const returnedValues = readChunk(reader, oggFlacContinuedPages);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual([
          {
            metadata: {
              ARTIST: "Clean Bandit",
              TITLE: "Solo (feat. Demi Lovato)",
              VENDOR_STRING: "reference libFLAC 1.3.1 20141125",
            },
            stats: {
              currentBytesRemaining: undefined,
              currentMetadataBytesRemaining: 0,
              currentStreamBytesRemaining: undefined,
              metadataBytesRead: 97,
              metadataLengthBytesRead: 0,
              streamBytesRead: 208,
              totalBytesRead: 208,
            },
          },
        ]);
        expect(Buffer.compare(returnedAudio, oggFlacContinuedPages)).toEqual(0);
      });
    });

    describe("Ogg Flac with ICY metadata", () => {
      it("should return the correct audio and metadata", () => {
        const reader = new IcecastMetadataReader({
          metadataTypes: ["icy", "ogg"],
          icyMetaInt: flacMetaInt,
        });

        const returnedValues = readChunk(reader, rawIcyFlac);
        const returnedMetadata = getMetadata(returnedValues.metadata);
        const returnedAudio = concatAudio([returnedValues]);

        expect(returnedMetadata).toEqual(expectedIcyFlacMetadata);
        expect(Buffer.compare(returnedAudio, icyFlac)).toEqual(0);
      });
    });
  });

  describe("Vorbis Comment Chunks", () => {
    it("should defer metadata update if still reading first vorbis comment chunk", () => {
      const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });
      const noMetadata = readChunk(reader, oggVorbis.subarray(0, 108));
      const metadata = readChunk(reader, oggVorbis.subarray(108, 222));
      const rest = readChunk(reader, oggVorbis.subarray(222));

      expect(noMetadata.metadata).toEqual([]);
      expect(metadata.metadata[0]).toEqual({
        metadata: {
          VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
          TITLE: "Talk Talk - The Rainbow",
          SERVER: "Icecast 2.4.0-kh15",
        },
        stats: {
          totalBytesRead: 222,
          streamBytesRead: 222,
          metadataLengthBytesRead: 0,
          metadataBytesRead: 114,
          currentMetadataBytesRemaining: 0,
          currentBytesRemaining: 0,
          currentStreamBytesRemaining: 0,
        },
      });

      expect(
        Buffer.compare(concatAudio([noMetadata, metadata, rest]), oggVorbis),
      ).toEqual(0);
    });

    it("should update metadata as expected given we are only reading zero or one byte at a time during the vendor length step", () => {
      const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

      const values = [
        readChunk(reader, oggVorbis.subarray(0, 109)),
        readChunk(reader, oggVorbis.subarray(109, 109)), // zero bytes
        readChunk(reader, oggVorbis.subarray(109, 110)), // one byte
        readChunk(reader, oggVorbis.subarray(110, 110)), // zero bytes
        readChunk(reader, oggVorbis.subarray(110, 113)), // vendor length should be read
        readChunk(reader, oggVorbis.subarray(113, 113)), // zero bytes
        readChunk(reader, oggVorbis.subarray(113)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
          TITLE: "Talk Talk - The Rainbow",
          SERVER: "Icecast 2.4.0-kh15",
        },
        stats: {
          totalBytesRead: 222,
          streamBytesRead: 222,
          metadataLengthBytesRead: 0,
          metadataBytesRead: 114,
          currentMetadataBytesRemaining: 0,
          currentBytesRemaining: 11818382,
          currentStreamBytesRemaining: 11818382,
        },
      });
      expect(Buffer.compare(concatAudio(values), oggVorbis)).toEqual(0);
    });

    it("should update metadata as expected given we are only reading zero or one byte at a time during the vendor string step", () => {
      const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

      const values = [
        readChunk(reader, oggVorbis.subarray(0, 113)),
        readChunk(reader, oggVorbis.subarray(113, 113)), // zero bytes
        readChunk(reader, oggVorbis.subarray(113, 114)), // one byte
        readChunk(reader, oggVorbis.subarray(114, 114)), // zero bytes
        readChunk(reader, oggVorbis.subarray(114, 125)),
        readChunk(reader, oggVorbis.subarray(125, 161)), // vendor length should be read
        readChunk(reader, oggVorbis.subarray(161)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
          TITLE: "Talk Talk - The Rainbow",
          SERVER: "Icecast 2.4.0-kh15",
        },
        stats: {
          totalBytesRead: 222,
          streamBytesRead: 222,
          metadataLengthBytesRead: 0,
          metadataBytesRead: 114,
          currentMetadataBytesRemaining: 0,
          currentBytesRemaining: 11818382,
          currentStreamBytesRemaining: 11818382,
        },
      });
      expect(Buffer.compare(concatAudio(values), oggVorbis)).toEqual(0);
    });

    it("should update metadata as expected given we are only reading zero or one byte at a time during the comment list length step", () => {
      const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

      const values = [
        readChunk(reader, oggVorbis.subarray(0, 161)),
        readChunk(reader, oggVorbis.subarray(161, 161)), // zero bytes
        readChunk(reader, oggVorbis.subarray(161, 162)), // one byte
        readChunk(reader, oggVorbis.subarray(162, 163)), // one byte
        readChunk(reader, oggVorbis.subarray(163, 163)),
        readChunk(reader, oggVorbis.subarray(163, 165)), // vendor length should be read
        readChunk(reader, oggVorbis.subarray(165)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
          TITLE: "Talk Talk - The Rainbow",
          SERVER: "Icecast 2.4.0-kh15",
        },
        stats: {
          totalBytesRead: 222,
          streamBytesRead: 222,
          metadataLengthBytesRead: 0,
          metadataBytesRead: 114,
          currentMetadataBytesRemaining: 0,
          currentBytesRemaining: 11818382,
          currentStreamBytesRemaining: 11818382,
        },
      });
      expect(Buffer.compare(concatAudio(values), oggVorbis)).toEqual(0);
    });

    it("should update metadata as expected given we are only reading zero or one byte at a time during the comment list length step", () => {
      const reader = new IcecastMetadataReader({ metadataTypes: ["ogg"] });

      const values = [
        readChunk(reader, oggVorbis.subarray(0, 165)),
        readChunk(reader, oggVorbis.subarray(165, 165)), // zero bytes
        readChunk(reader, oggVorbis.subarray(165, 166)), // one byte
        readChunk(reader, oggVorbis.subarray(166, 166)), // one byte
        readChunk(reader, oggVorbis.subarray(166, 171)),
        readChunk(reader, oggVorbis.subarray(171, 194)), // first comment should be read
        readChunk(reader, oggVorbis.subarray(194)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          VENDOR_STRING: "Xiph.Org libVorbis I 20150105 (⛄⛄⛄⛄)",
          TITLE: "Talk Talk - The Rainbow",
          SERVER: "Icecast 2.4.0-kh15",
        },
        stats: {
          totalBytesRead: 222,
          streamBytesRead: 222,
          metadataLengthBytesRead: 0,
          metadataBytesRead: 114,
          currentMetadataBytesRemaining: 0,
          currentBytesRemaining: 11818382,
          currentStreamBytesRemaining: 11818382,
        },
      });
      expect(Buffer.compare(concatAudio(values), oggVorbis)).toEqual(0);
    });
  });
});
