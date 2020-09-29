// Generator yields after stream read + metadata length completes
//   .next() takes in the metadata times
// Generator yields after metadata read completes

// Generator yields after the buffer is exhausted, (keeps track data remaining)
//   (stream + metadata length) and metadata generators are nested, yielding until all data exhausted from step then returning remaining data.

const fs = require("fs");

function* read(buffer, icyMetaInt) {
  // recursively reads stream data and metadata from the front of the buffer
  let remainingData = 0; // and keep track of current step
  let currentStep = "stream";

  function* readBuffer(type) {
    let dataRead = 0;

    while (remainingData && dataRead !== buffer.length) {
      const data = buffer.subarray(0, remainingData);
      remainingData -= data.length;
      dataRead += data.length;

      yield { data, type }; // yield the remaining data in this step
    }
    return buffer.subarray(dataRead); // return the remaining data in the buffer
  }

  function* readStream() {
    remainingData = remainingData || icyMetaInt;
    return yield* readBuffer(0, "stream");
  }

  function* readMetadata() {
    const metadataLength = buffer[0] * 16;

    if (metadataLength || remainingData) {
      remainingData = remainingData || metadataLength + 1;
      return yield* readBuffer("metadata");
    } else {
      return buffer.subarray(1);
    }
  }

  while (true) {
    while (buffer.length) {
      // read until current buffer is empty
      if (currentStep === "stream") {
        buffer = yield* readStream();
        if (!remainingData) {
          currentStep = "metadata"
        }
      }

      if (currentStep === "metadata") {      
        buffer = yield* readMetadata();
        if (!remainingData) {
          currentStep = "stream"
        }
      }
    }

    let nextBuffer = yield buffer; // yield a zero length buffer, and accept a new buffer

    if (nextBuffer) {
      // check if a new buffer was passed in
      buffer = nextBuffer; // set the passed in as the current buffer
    }
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

///*
const isics =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/no-rollover/isics-all.mp3.raw";
const soma =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/256mp3/music-256k.mp3.raw";
const raw = fs.readFileSync(isics);

let metadata = 0;
let streamArray = [];

let rawBuffs = [];
let currentPosition = 0;
const increment = 60000;

while (currentPosition + increment <= raw.length) {
  rawBuffs.push(raw.subarray(currentPosition, increment + currentPosition));
  currentPosition += increment;
}

const reader = read(rawBuffs[0], 64);

for (
  let currentBuffer = 1;
  currentBuffer !== rawBuffs.length;
  currentBuffer++
) {
  for (let i = reader.next(); i.value.length !== 0; i = reader.next()) {
    if (i.value.type === "metadata") {
      console.log(String.fromCharCode(...i.value.data));
      metadata++;
    } else {
      streamArray.push(i.value.data);
    }
  }

  reader.next(rawBuffs[currentBuffer]);
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
