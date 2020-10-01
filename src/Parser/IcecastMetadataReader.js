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
  let tempData = [];
  let buffer;
  let data;

  function* readBuffer(type) {
    let newBuffer;
    let readTo;
    let done = !(buffer && buffer.length);

    if (!done) {
      data = buffer.subarray(0, remainingData);
      readTo = data.length;
      remainingData -= data.length;
      done = readTo === buffer.length;

      if (!remainingData) {
        // all data is read for this step
        if (type === "stream") {
          metadataLength = data[data.length - 1] * 16; // calculate metadata length
          data = buffer.subarray(0, data.length - 1); // remove metadata length from return

          remainingData = metadataLength || streamLength;
        } else {
          remainingData = streamLength;
          metadataLength = 0;
        }

        if (tempData.length) {
          data = Buffer.concat([...tempData, data]);

          //const string = String.fromCharCode(...data);
          //const hex = [...data].map((b) => b.toString(16))

          tempData = [];
        }
      } else if (done) {
        // some data is left, but the buffer is empty
        tempData.push(data); // store in temp buffer
        data = Buffer.allocUnsafe(0); // return no data to consumer
      }
    }

    newBuffer = yield { data, type, done };

    if (newBuffer) {
      buffer = newBuffer;
      readTo = 0;
    }

    return buffer.subarray(readTo); // return the remaining data in the buffer
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
