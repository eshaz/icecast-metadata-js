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
  // recursively reads stream data and metadata from the front of the buffer
  const streamLength = icyMetaInt + 1;
  let remainingData = streamLength; // track any remaining data in read step
  let metadataLength = 0;
  let partialData = [];
  let buffer;

  function* readBuffer(type) {
    let data;
    let bytesRead;

    if (buffer && buffer.length) {
      data = buffer.subarray(0, remainingData);
      bytesRead = data.length;

      remainingData -= bytesRead;

      if (!remainingData) {
        if (type === "stream") {
          metadataLength = data[bytesRead - 1] * 16; // calculate metadata length
          data = buffer.subarray(0, bytesRead - 1); // remove metadata length from return

          remainingData = metadataLength || streamLength;
        } else {
          remainingData = streamLength;
          metadataLength = 0;
        }

        if (partialData.length) {
          data = Buffer.concat([...partialData, data]); // prepend out any partial data
          partialData = [];
        }
      } else if (bytesRead === buffer.length) {
        partialData.push(data); // store partial data if buffer is empty
        data = undefined; // tell consumer to supply more data in .next() call
      }
    }

    // buffer passed in with .next() or remaining buffer
    return (yield { data, type }) || buffer.subarray(bytesRead);
  }

  while (true) {
    buffer = metadataLength
      ? yield* readBuffer("metadata")
      : yield* readBuffer("stream");
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

///*

let metadata = 0;
let streamArray = [];

const raw = fs.readFileSync(isics);

const rawBuffs = getBuffArray(60000);
const reader = read(64);

reader.next();

for (
  let currentBuffer = 0;
  currentBuffer !== rawBuffs.length;
  currentBuffer++
) {
  for (
    let iterator = reader.next(rawBuffs[currentBuffer]);
    iterator.value.data; // returns data, and done, data get lost
    iterator = reader.next()
  ) {
    if (iterator.value.type === "metadata") {
      console.log(String.fromCharCode(...iterator.value.data));
      metadata++;
    } else {
      streamArray.push(iterator.value.data);
    }
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
