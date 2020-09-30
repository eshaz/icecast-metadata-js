// Generator yields after stream read + metadata length completes
//   .next() takes in the metadata times
// Generator yields after metadata read completes

// Generator yields after the buffer is exhausted, (keeps track data remaining)
//   (stream + metadata length) and metadata generators are nested, yielding until all data exhausted from step then returning remaining data.

const fs = require("fs")

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

;

function* read(buffer, icyMetaInt) {
  // recursively reads stream data and metadata from the front of the buffer
  let remainingData = 0; // track any remaining data in read step
  let readingMetadata = false; // track which read step is being performed
  let tempData;

  function* readBuffer(type) {
    let data;

    do {
      data = buffer.subarray(0, remainingData);
      remainingData -= data.length;

      if (data.length === buffer.length) {
        // done
        tempData = data;

        let newBuffer = yield { data: Buffer.alloc(0), type };

        if (newBuffer) {
          buffer = newBuffer
        }
      } else if (tempData) {
        const fullData = Buffer.concat([tempData, data]);
        const string = String.fromCharCode(...fullData);
        const hex = [...fullData].map((b) => b.toString(16))
        yield { data: fullData, type };

        tempData = null;
      } else {
        yield { data, type };
      }
    } while (remainingData);

    return buffer.subarray(data.length); // return the remaining data in the buffer
  }

  function* readStream() {
    remainingData = remainingData || icyMetaInt;
    return yield* readBuffer(0, "stream");
  }

  function* readMetadata() {
    const metadataLength = remainingData || buffer[0] * 16;

    if (metadataLength) {
      remainingData = remainingData || metadataLength + 1;
      return yield* readBuffer("metadata");
    } else {
      return buffer.subarray(1);
    }
  }

  while (true) {
    // read until current buffer is empty
    buffer = readingMetadata ? yield* readMetadata() : yield* readStream();

    // change the read step if done reading data
    if (!remainingData) readingMetadata ^= true;
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

///*

let metadata = 0;
let streamArray = [];

const rawBuffs = getBuffArray(60000);
const reader = read(rawBuffs[0], 64);

for (
  let currentBuffer = 0;
  currentBuffer !== rawBuffs.length;
  currentBuffer++
) {
  for (
    let iterator = reader.next(rawBuffs[currentBuffer]);
    iterator.value.data.length !== 0;
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
