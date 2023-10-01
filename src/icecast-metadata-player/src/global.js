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
