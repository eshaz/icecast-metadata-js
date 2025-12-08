export const noOp = () => {};
export const p = new WeakMap();

export const state = {
  LOADING: "loading",
  PLAYING: "playing",
  STOPPING: "stopping",
  STOPPED: "stopped",
  RETRYING: "retrying",
  SWITCHING: "switching",
};

export const event = {
  BUFFER: "buffer",
  PLAY: "play",
  PLAY_READY: "playready", // internal
  LOAD: "load",
  STREAM_START: "streamstart",
  STREAM: "stream",
  STREAM_END: "streamend",
  METADATA: "metadata",
  METADATA_ENQUEUE: "metadataenqueue",
  CODEC_UPDATE: "codecupdate",
  STOP: "stop",
  RETRY: "retry",
  RETRY_TIMEOUT: "retrytimeout",
  SWITCH: "switch",
  WARN: "warn",
  ERROR: "error",
  PLAYBACK_ERROR: "playbackerror",
};

// options
export const endpoints = Symbol();
export const endpointOrder = Symbol();
export const metadataTypes = Symbol();
export const playbackMethod = Symbol();
export const audioContext = Symbol();
export const audioElement = Symbol();
export const bufferLength = Symbol();
export const icyMetaInt = Symbol();
export const icyCharacterEncoding = Symbol();
export const icyDetectionTimeout = Symbol();
export const enableLogging = Symbol();
export const retryDelayRate = Symbol();
export const retryDelayMin = Symbol();
export const retryDelayMax = Symbol();
export const retryTimeout = Symbol();
export const enableCodecUpdate = Symbol();
export const authentication = Symbol();

// methods
export const getNextEndpointGenerator = Symbol();
export const getOptions = Symbol();
export const fireEvent = Symbol();
export const attachAudioElement = Symbol();
export const shouldRetry = Symbol();
export const logError = Symbol();

// variables
export const endpointGenerator = Symbol();
export const hasIcy = Symbol();
export const abortController = Symbol();
export const playerState = Symbol();
export const endpointsBitrates = Symbol();
export const networkBandwidth = Symbol();

// sync state
export const SYNCED = Symbol("synced");
export const SYNCING = Symbol("syncing");
export const PCM_SYNCED = Symbol("pcm_synced");
export const NOT_SYNCED = Symbol("not_synced");

export const concatBuffers = (buffers) => {
  const buffer = new Uint8Array(
    buffers.reduce((acc, buf) => acc + buf.length, 0),
  );

  buffers.reduce((offset, buf) => {
    buffer.set(buf, offset);
    return offset + buf.length;
  }, 0);

  return buffer;
};

// [ts: timestamp, bytes: number of bytes]
// null if not enough samples
export const calculateBitrate = (bitrateArray, minSamples, maxSamples) => {
  // calculate average network bandwidth
  if (bitrateArray.length < minSamples) return null;
  if (bitrateArray.length > maxSamples) bitrateArray.shift();

  let totalWeightedBandwidth = 0;
  let totalDuration = 0;

  for (let i = 1; i < bitrateArray.length; i++) {
    const prev = bitrateArray[i - 1];
    const curr = bitrateArray[i];
    const duration = curr.ts - prev.ts;

    if (duration > 0) {
      const bandwidth = curr.bytes / duration; // bytes/sec
      totalWeightedBandwidth += bandwidth * duration; // weight by duration
      totalDuration += duration;
    }
  }

  return totalWeightedBandwidth && (totalWeightedBandwidth / totalDuration) * 8;
};

export const averageBitrate = (bitrateArray, minSamples, maxSamples) => {
  if (bitrateArray.length < minSamples) return null;
  if (bitrateArray.length > maxSamples) bitrateArray.shift();

  return (
    bitrateArray.reduce((acc, bitrate) => bitrate + acc, 0) /
    bitrateArray.length
  );
};
