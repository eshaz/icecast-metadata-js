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
const raw = fs.readFileSync(isics);

function* read(buffer, icyMetaInt) {
  // recursively reads stream data and metadata from the front of the buffer
  let remainingData = 0; // track any remaining data in read step
  let readingMetadata = false; // track which read step is being performed
  let metadataLength = 0;
  let tempData = [];

  function* readBuffer(type) {
    let newBuffer;
    let readTo;
    let done;

    do {
      let data = buffer.subarray(0, remainingData);

      readTo = data.length;
      remainingData -= data.length;
      done = readTo === buffer.length;

      if (!remainingData && !readingMetadata) {
        metadataLength = data[data.length - 1] * 16;
        data = buffer.subarray(0, data.length - 1);
      }

      if (!remainingData && tempData.length) {
        data = Buffer.concat([...tempData, data]);

        //const string = String.fromCharCode(...data);
        //const hex = [...data].map((b) => b.toString(16))

        tempData = [];
      } else if (done) {
        tempData.push(data);
        data = Buffer.allocUnsafe(0);
      }

      newBuffer = yield { data, type, done };
    } while (remainingData && !done);

    if (newBuffer) {
      buffer = newBuffer;
      readTo = 0;
    }

    return buffer.subarray(readTo); // return the remaining data in the buffer
  }

  function* readStream() {
    remainingData = remainingData || icyMetaInt + 1;
    return yield* readBuffer("stream");
  }

  function* readMetadata() {
    if (metadataLength) {
      remainingData = remainingData || metadataLength;
      return yield* readBuffer("metadata");
    } else {
      return buffer;
    }
  }

  while (true) {
    // read until current buffer is empty
    buffer = readingMetadata ? yield* readMetadata() : yield* readStream();

    // change the read step if done reading data
    // if (!remainingData) readingMetadata ^= true;
    if (!remainingData) readingMetadata = !readingMetadata;
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

///*

let metadata = 0;
let streamArray = [];

const rawBuffs = getBuffArray(3);
const reader = read(rawBuffs[0], 64);

for (
  let currentBuffer = 0;
  currentBuffer !== rawBuffs.length;
  currentBuffer++
) {
  for (
    let iterator = reader.next(rawBuffs[currentBuffer]);
    !iterator.value.done;
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
