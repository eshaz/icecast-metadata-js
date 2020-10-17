const fs = require("fs");
const IcecastMetadataReader = require("../src/IcecastMetadataReader");

const getBuffArray = (buffer, increment) => {
  let rawBuffs = [];

  for (let currPos = 0; currPos <= buffer.length; currPos += increment) {
    rawBuffs.push(buffer.subarray(currPos, increment + currPos));
  }

  return rawBuffs;
};

const readChunk = (reader, chunk) => {
  let stream = [];
  let metadata = [];

  for (let i = reader.next(chunk); i.value; i = reader.next()) {
    if (i.value.stream) {
      stream.push(i.value);
    } else if (i.value.metadata) {
      metadata.push(i.value);
    }
  }

  return { stream, metadata };
};

const readChunks = (reader, data, chunkSize) => {
  let stream = [];
  let metadata = [];
  const bufferArray = getBuffArray(data, chunkSize);

  for (
    let currentBuffer = 0;
    currentBuffer !== bufferArray.length;
    currentBuffer++
  ) {
    for (
      let iterator = reader.next(bufferArray[currentBuffer]);
      iterator.value; // returns data, and done, data get lost
      iterator = reader.next()
    ) {
      if (iterator.value.metadata) {
        metadata.push(iterator.value);
      } else {
        stream.push(iterator.value);
      }
    }
  }

  return { stream, metadata };
};

const concatAudio = (values) =>
  Buffer.concat(
    values.flatMap((value) => value.stream.map(({ stream }) => stream))
  );

describe("Icecast Metadata Reader", () => {
  let raw256k, expected256kAudio, raw16k, expected16k, mockOnMetadataUpdate;

  const somaMetaInt = 16000;
  const isicsMetaInt = 64;

  beforeAll((done) => {
    Promise.all([
      fs.promises.readFile("../../test/data/record/256mp3/music-256k.mp3.raw"),
      fs.promises.readFile("../../test/data/record/256mp3/music-256k.mp3"),
      fs.promises.readFile(
        "../../test/data/record/no-rollover/isics-all.mp3.raw"
      ),
      fs.promises.readFile("../../test/data/record/no-rollover/isics-all.mp3"),
    ]).then(([r256k, e256, r16k, e16k]) => {
      raw256k = r256k;
      expected256kAudio = e256;
      raw16k = r16k;
      expected16k = e16k;
      done();
    });

    mockOnMetadataUpdate = jest.fn();
  });

  describe("Reading chunks", () => {
    const expectMetadata = (
      metadata,
      firstStreamPosition,
      secondStreamPosition
    ) => {
      expect(metadata.length).toEqual(2);
      expect(metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: firstStreamPosition,
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(metadata[1]).toEqual({
        metadata: {
          StreamTitle:
            "Harold Budd & John Foxx - Some Way Through All The Cities",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: secondStreamPosition,
          metadataBytesRead: 256,
          streamBytesRead: 6224000,
          totalBytesRead: 6224645,
        },
      });
    };

    it("should return the correct audio given it is read in chunks smaller than the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });

      const returnedValues = readChunks(reader, raw256k, 15999);

      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(returnedValues.metadata, 1, 889);
      expect(Buffer.compare(returnedAudio, expected256kAudio)).toBeFalsy();
    });

    it("should return the correct audio given it is read in chunks larger than the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(reader, raw256k, 16001);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(returnedValues.metadata, 0, 111);
      expect(Buffer.compare(returnedAudio, expected256kAudio)).toBeFalsy();
    });

    it("should return the correct audio given it is read in chunks of equal size to the metaint", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(reader, raw256k, 16000);
      const returnedAudio = concatAudio([returnedValues]);

      expectMetadata(returnedValues.metadata, 0, 500);
      expect(Buffer.compare(returnedAudio, expected256kAudio)).toBeFalsy();
    });

    it("should return the correct audio given it is read in chunks of random size", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const returnedValues = readChunks(
        reader,
        raw256k,
        Math.floor(Math.random() * 30000)
      );
      const returnedAudio = concatAudio([returnedValues]);

      expect(Buffer.compare(returnedAudio, expected256kAudio)).toBeFalsy();
    });

    it("should return the correct audio given it is read in chunks of 1 size", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: isicsMetaInt });
      const returnedValues = readChunks(reader, raw16k, 10);

      const returnedAudio = concatAudio([returnedValues]);

      expect(returnedValues.metadata.length).toEqual(259);
      expect(Buffer.compare(returnedAudio, expected16k)).toBeFalsy();
    });
  });

  describe("Metadata Chunks", () => {
    it("should defer metadata update if still reading first metadata chunk", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const noMetadata = readChunk(reader, raw256k.subarray(0, 16004));
      const metadata = readChunk(reader, raw256k.subarray(16004, 16800));
      const rest = readChunk(reader, raw256k.subarray(16800));

      expect(noMetadata.metadata).toEqual([]);
      expect(metadata.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: 0,
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });

      expect(
        Buffer.compare(
          concatAudio([noMetadata, metadata, rest]),
          expected256kAudio
        )
      ).toBeFalsy();
    });

    it("should update metadata as soon as it is available", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const noMetadata = readChunk(reader, raw256k.subarray(0, 16004));
      const metadata = readChunk(reader, raw256k.subarray(16004, 16113));
      const rest = readChunk(reader, raw256k.subarray(16113));

      expect(noMetadata.metadata).toEqual([]);
      expect(metadata.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: 0,
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(
        Buffer.compare(
          concatAudio([noMetadata, metadata, rest]),
          expected256kAudio
        )
      ).toBeFalsy();
    });

    it("should defer metadata update if still reading second metadata chunk", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const firstValue = readChunk(reader, raw256k.subarray(0, 6224510));
      const secondValue = readChunk(reader, raw256k.subarray(6224510));

      expect(firstValue.metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: 16000,
          metadataBytesRead: 112,
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
          currentStreamPosition: 0,
          metadataBytesRead: 256,
          streamBytesRead: 6224000,
          totalBytesRead: 6224645,
        },
      });
      expect(
        Buffer.compare(
          concatAudio([firstValue, secondValue]),
          expected256kAudio
        )
      ).toBeFalsy();
    });

    it("should defer metadata update if still reading metadata length byte", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = readChunk(reader, raw256k.subarray(0, 16000));
      const rest = readChunk(reader, raw256k.subarray(16000));

      expect(values.metadata.length).toEqual(0);
      expect(
        Buffer.compare(concatAudio([values, rest]), expected256kAudio)
      ).toBeFalsy();
    });

    it("should not update metadata given length byte is zero", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = readChunk(reader, raw256k.subarray(0, 120000));
      const rest = readChunk(reader, raw256k.subarray(120000));

      expect(values.metadata.length).toEqual(1);
      expect(
        Buffer.compare(concatAudio([values, rest]), expected256kAudio)
      ).toBeFalsy();
    });

    it("should update metadata as expected given the we are only reading zero or one byte at a time during the length step", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });

      const values = [
        readChunk(reader, raw256k.subarray(0, 15999)),
        readChunk(reader, raw256k.subarray(15999, 15999)), // zero bytes
        readChunk(reader, raw256k.subarray(15999, 16000)), // one byte
        readChunk(reader, raw256k.subarray(16000, 16000)), // zero bytes
        readChunk(reader, raw256k.subarray(16000, 16001)), // one byte (metadata length should be here)
        readChunk(reader, raw256k.subarray(16001, 16001)), // zero bytes
        readChunk(reader, raw256k.subarray(16001, 120000)),
        readChunk(reader, raw256k.subarray(120000)),
      ];

      expect(values[6].metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: 0,
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(
        Buffer.compare(concatAudio(values), expected256kAudio)
      ).toBeFalsy();
    });

    it("should update metadata as expected given readBuffer is called with a zero length buffer", () => {
      const reader = new IcecastMetadataReader({ icyMetaInt: somaMetaInt });
      const values = [
        readChunk(reader, raw256k.subarray(0, 15243)),
        readChunk(reader, raw256k.subarray(15243, 15243)),
        readChunk(reader, raw256k.subarray(15243, 16456)),
        readChunk(reader, raw256k.subarray(16456)),
      ];

      expect(values[2].metadata[0]).toEqual({
        metadata: {
          StreamTitle: "Djivan Gasparyan - Brother Hunter",
          StreamUrl: "http://somafm.com/logos/512/dronezone512.png",
        },
        stats: {
          currentStreamPosition: 757,
          metadataBytesRead: 112,
          streamBytesRead: 16000,
          totalBytesRead: 16113,
        },
      });
      expect(
        Buffer.compare(concatAudio(values), expected256kAudio)
      ).toBeFalsy();
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

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata does not contain ending null characters", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com';";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata does not contain an ending semi-colon", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.com'";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.com",
      };

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should add incomplete metadata values given the metadata length was not enough", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.c";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
        StreamUrl: "https://example.c",
      };

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should not add incomplete metadata values given they are malformed", () => {
      const metadataString =
        "StreamTitle='The Stream Title';StreamUrl='https://example.c\0\0\0\0";
      const expectedMetadata = {
        StreamTitle: "The Stream Title",
      };

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should parse given the metadata contains one key value pair", () => {
      const metadataString = "StreamTitle='The Stream Title';\0\0\0";
      const expectedMetadata = { StreamTitle: "The Stream Title" };

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should return an empty object given there is malformed metadata", () => {
      const metadataString = "StreamTitl";
      const expectedMetadata = {};

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

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

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    it("should return an empty object given there is no metadata", () => {
      const metadataString = "";
      const expectedMetadata = {};

      const returnedMetadata = IcecastMetadataReader.parseMetadataString(
        metadataString
      );

      expect(returnedMetadata).toEqual(expectedMetadata);
    });

    describe("Given the metadata keys", () => {
      it("should parse given the metadata key has spaces", () => {
        const metadataString = "Stream Title='The Stream Title';\0";
        const expectedMetadata = { "Stream Title": "The Stream Title" };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given the metadata key is malformed", () => {
        const metadataString = "StreamTitle='The Stream Title';StreamU";
        const expectedMetadata = { StreamTitle: "The Stream Title" };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });
    });

    describe("Given the metadata values", () => {
      it("should parse given the metadata has only one valid key value pair", () => {
        const metadataString = "StreamTitle='The Stream Title';StreamUrl='\0";
        const expectedMetadata = { StreamTitle: "The Stream Title" };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains non alpha numeric characters", () => {
        const metadataString =
          "StreamTitle='Nils Landgren & Jan LundgrenÂ  - Why Did You Let Me Go';\0\0\0\0\0\0";
        const expectedMetadata = {
          StreamTitle: "Nils Landgren & Jan LundgrenÂ  - Why Did You Let Me Go",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains a quote", () => {
        const metadataString =
          "StreamTitle='The Stream Title's';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream Title's",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains an equal sign", () => {
        const metadataString =
          "StreamTitle='The Stream = Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream = Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains an equal sign", () => {
        const metadataString =
          "StreamTitle='The Stream = Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream = Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value contains a semi-colon", () => {
        const metadataString =
          "StreamTitle='The Stream;Titles';StreamUrl='https://example.com';";
        const expectedMetadata = {
          StreamTitle: "The Stream;Titles",
          StreamUrl: "https://example.com",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata value is an empty string", () => {
        const metadataString = "StreamTitle='';";
        const expectedMetadata = {
          StreamTitle: "",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata there are two values that are empty strings", () => {
        const metadataString = "StreamTitle='';StreamUrl='';";
        const expectedMetadata = {
          StreamTitle: "",
          StreamUrl: "",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata the first value is an empty string", () => {
        const metadataString = "StreamTitle='';StreamUrl='some url';";
        const expectedMetadata = {
          StreamTitle: "",
          StreamUrl: "some url",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });

      it("should parse given metadata the second value is an empty string", () => {
        const metadataString = "StreamTitle='some title';StreamUrl='';";
        const expectedMetadata = {
          StreamTitle: "some title",
          StreamUrl: "",
        };

        const returnedMetadata = IcecastMetadataReader.parseMetadataString(
          metadataString
        );

        expect(returnedMetadata).toEqual(expectedMetadata);
      });
    });
  });
});
