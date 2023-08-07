const getBuffArray = (buffer, increment) => {
  let rawBuffs = [];

  for (let currPos = 0; currPos <= buffer.length; currPos += increment) {
    rawBuffs.push(buffer.subarray(currPos, increment + currPos));
  }

  return rawBuffs;
};

const readChunk = (reader, chunk, stream = [], metadata = []) => {
  for (const i of reader.iterator(chunk)) {
    if (i.metadata) {
      metadata.push(i);
    } else {
      stream.push(i);
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
    readChunk(reader, bufferArray[currentBuffer], stream, metadata);
  }

  return { stream, metadata };
};

const concatAudio = (values) =>
  Buffer.concat(
    values.flatMap((value) => value.stream.map(({ stream }) => stream)),
  );

export { readChunk, readChunks, concatAudio };
