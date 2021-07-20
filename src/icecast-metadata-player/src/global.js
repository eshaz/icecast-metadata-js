export const noOp = () => {};
export const p = new WeakMap();

export const state = {
  LOADING: "loading",
  PLAYING: "playing",
  STOPPING: "stopping",
  STOPPED: "stopped",
  RETRYING: "retrying",
};

export const event = {
  PLAY: "play",
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
  WARN: "warn",
  ERROR: "error",
};

// options
export const endpoint = Symbol();
export const metadataTypes = Symbol();
export const audioElement = Symbol();
export const icyMetaInt = Symbol();
export const icyDetectionTimeout = Symbol();
export const enableLogging = Symbol();
export const retryDelayRate = Symbol();
export const retryDelayMin = Symbol();
export const retryDelayMax = Symbol();
export const retryTimeout = Symbol();

// methods
export const fireEvent = Symbol();
export const attachAudioElement = Symbol();
export const shouldRetry = Symbol();
export const logError = Symbol();

// variables
export const hasIcy = Symbol();
export const icecastMetadataQueue = Symbol();
export const abortController = Symbol();

// sync state
export const SYNCED = Symbol();
export const SYNCING = Symbol();
export const NOT_SYNCED = Symbol();
