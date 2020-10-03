const MetadataBuffer = require("./MetadataBuffer");

const parseMetadataString = (metadataString) => {
  /**
   * Metadata is a string of key='value' pairs delimited by a semicolon.
   * The string is a fixed length and any unused bytes at the end are 0x00.
   * i.e. "StreamTitle='The Stream Title';StreamUrl='https://example.com';\0\0\0\0\0\0"
   */
  const metadata = {};

  // [{key: "StreamTitle", val: "The Stream Title"}, {key: "StreamUrl", val: "https://example.com"}]
  for (let match of metadataString.matchAll(
    /(?<key>[ -~]+?)='(?<val>[ -~]*?)(;$|';|'$|$)/g
  )) {
    metadata[match["groups"]["key"]] = match["groups"]["val"];
  }

  // {StreamTitle: "The Stream Title", StreamUrl: "https://example.com"}
  return metadata;
};

const parseMetadata = (metadataBytes) =>
  parseMetadataString(String.fromCharCode(...metadataBytes));

function* generator(icyMetaInt) {
  const stats = {
    // statistics for bytes read and metadata triggering
    metadataBytesRead: 0,
    streamBytesRead: 0,
    totalBytesRead: 0,
  };

  let remainingData, buffer;

  function* getStream() {
    remainingData = icyMetaInt;

    do {
      const stream = yield* incrementCurrentValue();
      stats.streamBytesRead += stream.length;

      yield { stream, stats: { ...stats } };
    } while (remainingData);
  }

  function* getMetadataLength() {
    remainingData = 1;

    do {
      remainingData = (yield* incrementCurrentValue())[0] * 16;
    } while (remainingData === 1);
  }

  function* getMetadata() {
    let metadata = yield* incrementCurrentValue();

    if (remainingData) {
      const metadataBuffer = new MetadataBuffer(
        remainingData + metadata.length
      );
      metadataBuffer.push(metadata);

      while (remainingData) {
        const nextMetadata = yield* incrementCurrentValue();

        metadataBuffer.push(nextMetadata);
      }

      metadata = metadataBuffer.pop();
    }

    stats.metadataBytesRead += metadata.length;

    yield { metadata: parseMetadata(metadata), stats: { ...stats } };
  }

  function* incrementCurrentValue() {
    while (!(buffer && buffer.length)) {
      buffer = yield;
    }
    const value = buffer.subarray(0, remainingData);
    
    remainingData -= value.length;
    stats.totalBytesRead += value.length;
    buffer = buffer.subarray(value.length);

    return value;
  }

  do {
    yield* getStream();
    yield* getMetadataLength();
    remainingData && (yield* getMetadata());
  } while (true);
}

function read(icyMetaInt) {
  const gen = generator(icyMetaInt);
  gen.next();
  return gen;
}

module.exports = { read, parseMetadataString };
