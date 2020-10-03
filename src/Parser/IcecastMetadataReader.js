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
  const lengths = {
    stream: icyMetaInt + 1, // metadata interval plus the metadata length byte
    metadata: 0, // metadata length derived from metadata length byte
  };

  const stats = {
    // statistics for bytes read and metadata triggering
    metadataBytesRead: 0,
    streamBytesRead: 0,
    totalBytesRead: 0,
  };

  let remainingData = lengths.stream,
    buffer,
    currentValue;

  const getStream = (data) => {
    if (!remainingData) {
      lengths.metadata = data[data.length - 1] * 16; // metadata length is the first byte after icy-meta-int * 2^4
      remainingData = lengths.metadata || lengths.stream; // set remaining data to metadata length if there is metadata

      data = data.subarray(0, data.length - 1); // trim metadata length byte
    }

    stats.streamBytesRead += data.length;

    return { stream: data, stats: { ...stats } };
  };

  function* getMetadata(data) {
    if (data.length < lengths.metadata) {
      const metadataBuffer = new MetadataBuffer(lengths.metadata);
      metadataBuffer.push(data);

      while (metadataBuffer.length < lengths.metadata) {
        buffer = yield;
        metadataBuffer.push(readData(buffer));
      }

      data = metadataBuffer.pop();
    }
    
    stats.metadataBytesRead += lengths.metadata;

    lengths.metadata = 0;
    remainingData = lengths.stream;

    yield { metadata: parseMetadata(data), stats: { ...stats } };
  }

  const readData = () => {
    currentValue = buffer.subarray(0, remainingData);
    remainingData -= currentValue.length;
    stats.totalBytesRead += currentValue.length;

    return currentValue;
  }

  while (true) {
    if (buffer && buffer.length) {
      readData(buffer);
      
      buffer =
        (lengths.metadata
          ? yield* getMetadata(currentValue)
          : yield getStream(currentValue)) || buffer.subarray(currentValue.length);
    } else {
      buffer = yield;
    }
  }
}

function read(icyMetaInt) {
  const gen = generator(icyMetaInt);
  gen.next();
  return gen;
}

module.exports = { read, parseMetadataString };
