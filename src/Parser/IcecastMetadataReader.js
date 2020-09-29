// Generator yields after stream read + metadata length completes
//   .next() takes in the metadata times
// Generator yields after metadata read completes

// Generator yields after the buffer is exhausted, (keeps track data remaining)
//   (stream + metadata length) and metadata generators are nested, yielding until all data exhausted from step then returning remaining data.

const fs = require("fs");

function* read(buffer, icyMetaInt) {
  // recursively reads stream data and metadata from the front of the buffer
  let remainingData = 0;

  function* readBuffer(offset, type) {
    yield { data: buffer.subarray(offset, remainingData), type }; // yield the remaining data in this step
    return buffer.subarray(offset + remainingData); // return the remaining data in the buffer
  }

  function* readStream() {
    remainingData = icyMetaInt;
    return yield* readBuffer(0, "stream");
  }

  function* readMetadata() {
    const metadataLength = buffer[0] * 16;

    if (metadataLength) {
      remainingData = metadataLength;
      return yield* readBuffer(1, "metadata");
    } else {
      return buffer.subarray(1);
    }
  }

  while (buffer) {
    // check for a current buffer
    while (buffer.length) {
      // read current buffer until empty
      buffer = yield* readStream();
      buffer = yield* readMetadata();
    }

    let nextBuffer = yield buffer; // yield a zero length buffer
    buffer = nextBuffer; // set the passed in buffer as the current buffer
  }
}

const logValue = ({ value, done }) => console.log(value, done);
const getBuf = (num) => Buffer.from([...Array(num).keys()]);

const isics =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/no-rollover/isics-all.mp3.raw";
const soma =
  "/home/ethan/git/eshaz/icecast-metadata-js/test/data/record/256mp3/music-256k.mp3.raw";
const raw = fs.readFileSync(soma);
const reader = read(raw, 16000);

let metadata = 0;
let streamArray = [];

for (let i = reader.next(); i.value.length !== 0; i = reader.next()) {
  if (i.value.type === "metadata") {
    console.log(String.fromCharCode(...i.value.data));
    metadata++;
  } else {
    streamArray.push(i.value.data);
  }
}

fs.writeFileSync(__dirname + "/test.mp3", Buffer.concat(streamArray));

console.log(metadata);

//logValue(reader.next());

console.log("done");
