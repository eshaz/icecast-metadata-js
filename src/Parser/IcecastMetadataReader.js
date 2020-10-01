const { SSL_OP_SSLEAY_080_CLIENT_DH_BUG } = require("constants");
// Generator yields after stream read + metadata length completes
//   .next() takes in the metadata times
// Generator yields after metadata read completes

// Generator yields after the buffer is exhausted, (keeps track data remaining)
//   (stream + metadata length) and metadata generators are nested, yielding until all data exhausted from step then returning remaining data.

const fs = require("fs");

const getBuffArray = (increment) => {
  let rawBuffs = [];
  let currentPosition = 0;

  while (currentPosition + increment <= raw.length) {
    rawBuffs.push(raw.subarray(currentPosition, increment + currentPosition));
    currentPosition += increment;
  }

  return rawBuffs;
};

const isics =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/no-rollover/isics-all.mp3.raw";
const soma =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/256mp3/music-256k.mp3.raw";

function* read(icyMetaInt) {
  const lengths = {
    stream: icyMetaInt + 1, // metadata interval plus the metadata length byte
    metadata: 0, // metadata length derived from metadata length byte
  };

  // statistics for bytes read and metadata triggering
  const stats = {
    metadataBytesRead: 0,
    streamBytesRead: 0,
    totalBytesRead: 0,
  };

  let remainingData = lengths.stream,
    partialData = [],
    buffer,
    rawData;

  const popPartialData = (data) => {
    if (partialData.length) {
      data = Buffer.concat([...partialData, data]);
      partialData = [];
    }
    return data;
  };

  const pushPartialData = (data) => {
    partialData.push(data); // store partial data if buffer is empty
    return undefined; // tell consumer to supply more data in .next() call
  };

  const readStream = (data) => {
    stats.streamBytesRead += icyMetaInt;
    stats.totalBytesRead += lengths.stream;

    lengths.metadata = data[data.length - 1] * 16; // check metadata length
    remainingData = lengths.metadata || lengths.stream; // set remaining data to metadata length if there is metadata

    return { stream: popPartialData(buffer.subarray(0, data.length - 1)) }; // trim metadata length byte
  };

  const readMetadata = (data) => {
    stats.metadataBytesRead += lengths.metadata;

    remainingData = lengths.stream;
    lengths.metadata = 0;

    return { metadata: popPartialData(data) };
  };

  while (true) {
    let value;

    if (buffer && buffer.length) {
      rawData = buffer.subarray(0, remainingData);
      remainingData -= rawData.length;

      if (!remainingData) {
        value = {
          ...(lengths.metadata ? readMetadata(rawData) : readStream(rawData)),
          ...stats,
        };
      } else if (rawData.length === buffer.length) {
        value = pushPartialData(rawData);
      }
    }

    buffer = (yield value) || buffer.subarray(rawData.length);
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

///*

let metadata = 0;
let streamArray = [];

const raw = fs.readFileSync(isics);

const rawBuffs = getBuffArray(4);
const reader = read(64);

reader.next();

let value;

for (
  let currentBuffer = 0;
  currentBuffer !== rawBuffs.length;
  currentBuffer++
) {
  for (
    let iterator = reader.next(rawBuffs[currentBuffer]);
    iterator.value; // returns data, and done, data get lost
    iterator = reader.next()
  ) {
    if (iterator.value.metadata) {
      console.log(String.fromCharCode(...iterator.value.metadata));
      metadata++;
    } else {
      streamArray.push(iterator.value.stream);
    }

    value = iterator.value;
  }
}

fs.writeFileSync(__dirname + "/test.mp3", Buffer.concat(streamArray));

console.log(metadata);
//*/

/*
const reader = read(getBuf(30), 10);

logValue(reader.next());
logValue(reader.next());
logValue(reader.next());
logValue(reader.next());
*/
console.log("done");
