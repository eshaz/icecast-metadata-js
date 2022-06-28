import SynAudio from "synaudio";

import {
  concatBuffers,
  event,
  state,
  fireEvent,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
} from "./global.js";
import WebAudioPlayer from "./players/WebAudioPlayer.js";

export default class FrameQueue {
  constructor(icecast, player) {
    this.CRC_DURATION = 300000; // milliseconds to cache for crc syncing
    this.PCM_DURATION = 60000; // milliseconds to cache for pcm syncing

    this._icecast = icecast;
    this._player = player;

    this.initSync();
    this.initQueue();
  }

  initSync() {
    this._syncQueue = [];
    this._synAudioResult = null;
  }

  initQueue() {
    this._absoluteQueueIndex = 0;

    this._crcQueue = [];
    this._crcQueueDuration = 0;
    this._crcQueueIndexes = {};

    this._pcmQueue = [];
    this._pcmQueueDuration = 0;
  }

  add(frame) {
    // crc queue
    const { crc32, duration } = frame;
    this._crcQueue.push({ crc32, duration });
    this._crcQueueDuration += duration;

    // update queue index
    let indexes = this._crcQueueIndexes[crc32];
    if (!indexes) {
      indexes = [];
      this._crcQueueIndexes[crc32] = indexes;
    }
    indexes.push(this._absoluteQueueIndex++);

    if (this._crcQueueDuration >= this.CRC_DURATION) {
      const { crc32, duration } = this._crcQueue.shift();
      this._crcQueueDuration -= duration;

      // remove the oldest index
      const indexes = this._crcQueueIndexes[crc32];
      indexes.shift();
      // remove the key if there are no indexes left
      if (!indexes.length) delete this._crcQueueIndexes[crc32];
    }

    // pcm queue
    this._pcmQueue.push(frame);
    this._pcmQueueDuration += duration;

    if (this._pcmQueueDuration >= this.PCM_DURATION) {
      this._pcmQueueDuration -= this._pcmQueue.shift().duration;
    }
  }

  addAll(frames) {
    frames.forEach((frame) => this.add(frame));
  }

  /**
   *
   * @param {Array<CodecFrame|OggPage>} frames
   */
  async sync(frames) {
    this._syncQueue.push(...frames);

    // try syncing using crc32 hashes (if the stream data matches exactly)
    const crcSyncState = this._crcSync();
    if (crcSyncState) return crcSyncState;

    // try syncing using decoded audio and corelation (if audio data matches)
    const pcmSyncState = await this._pcmSync();
    if (pcmSyncState) return pcmSyncState;

    // streams do not match (not synced)
    // prettier-ignore
    if (this._icecast.state !== state.STOPPING && this._icecast.state !== state.STOPPED)
      this._icecast[fireEvent](
        event.WARN,
        `Reconnected successfully after ${this._icecast.state}.`,
        "Found no overlapping frames from previous request.",
        "Unable to sync old and new request."
      );

    const syncQueue = this._syncQueue;
    this.initSync();
    this.initQueue(); // clear queue since there is a gap in data
    return [syncQueue, NOT_SYNCED];
  }

  /*
  Aligns the queue with a new incoming data by aligning the crc32 hashes 
  and then returning only the frames that do not existing on the queue.
  
                   old data | common data  | new data
  (old connection) ------------------------|
  (new connection)          |------------------>
                             ^^^^^^^^^^^^^^ ^^^^
                              (sync)         (frames to return)
  */
  _crcSync() {
    // get all indexed matches for crc and check
    if (!this._syncQueue.length) return [[], SYNCING];

    const syncQueueStartIndex = 0;
    const syncQueueCrc = this._syncQueue[syncQueueStartIndex].crc32;
    const crcSyncPoints = this._crcQueueIndexes[syncQueueCrc];

    let matched, outOfFrames;

    if (crcSyncPoints) {
      align_queues: for (const absoluteSyncPoint of crcSyncPoints) {
        this._syncPoint =
          absoluteSyncPoint -
          (this._absoluteQueueIndex - this._crcQueue.length);

        for (
          let i = syncQueueStartIndex;
          i < this._syncQueue.length &&
          this._syncPoint + i < this._crcQueue.length;
          i++
        )
          if (
            this._crcQueue[this._syncPoint + i].crc32 !==
            this._syncQueue[i].crc32
          )
            continue align_queues; // failed to match

        outOfFrames =
          this._syncPoint + this._syncQueue.length <= this._crcQueue.length;
        matched = true;
        break; // full match
      }

      // have some overlapping frames, but none are new frames
      if (outOfFrames) return [[], SYNCING];

      if (matched) {
        const sliceIndex = this._crcQueue.length - this._syncPoint;
        // prettier-ignore
        this._icecast[fireEvent](
          event.WARN,
          `Reconnected successfully after ${this._icecast.state}.`,
          `Found ${sliceIndex} frames (${(this._crcQueue
            .slice(this._syncPoint)
            .reduce((acc, { duration }) => acc + duration, 0) / 1000).toFixed(3)} seconds) of overlapping audio data in new request.`,
          "Synchronized old and new request."
        );

        const newFrames = this._syncQueue.slice(sliceIndex);
        this.initSync();
        return [newFrames, SYNCED];
      }
    }
  }

  /*
  Syncs the old and new data using correlation between decoded audio.
  A new player will be constructed after this sync is completed.

                           old data  | common data | new data
    
    (time scale)     -2 -1 0 +1 +2
    (old connection)  -----------------------------|
                      ^^^^^|^^^^^^^^^|             |
                           |         syncOffset    buffered (metadataTimestamp)
                           syncStart
                             |
                             syncEnd
  
    (time scale)               -2 -1 0 +1 +2
    (new connection)                 |-----------|--->
                             |       ^^^^^^^^^^^^|^^^^
                             playbackOffset      syncLength
  */
  async _pcmSync() {
    try {
      const correlationSyncLength = 1; // seconds
      const initialGranularity = 7;

      const samplesToDuration = (samples, rate) => samples / rate;

      if (!this._synAudioResult) {
        await this._decodeQueues();

        const correlationSampleSize =
          this._a.sampleRate * correlationSyncLength;

        // more data is needed to meet the correlationSampleSize
        if (this._b.length <= correlationSampleSize) return [[], SYNCING];

        const synAudio = new SynAudio({
          correlationSampleSize,
          initialGranularity,
        });

        const aDecoded = {
          channelData: [],
          samplesDecoded: this._a.length,
        };
        const bDecoded = {
          channelData: [],
          samplesDecoded: this._b.length,
        };

        for (let i = 0; i < this._a.numberOfChannels; i++)
          aDecoded.channelData.push(this._a.getChannelData(i));

        for (let i = 0; i < this._b.numberOfChannels; i++)
          bDecoded.channelData.push(this._b.getChannelData(i));

        const aDecodeLength = samplesToDuration(
          aDecoded.samplesDecoded,
          this._a.sampleRate
        );

        const start = performance.now();

        this._synAudioResult = await synAudio.syncWorkerConcurrent(
          aDecoded,
          bDecoded,
          Math.max(navigator.hardwareConcurrency - 1, 1)
        );

        const end = performance.now();

        console.log(
          "correlation rate",
          ((aDecodeLength * 1000) / (end - start)) * 100
        );

        const aOffset = samplesToDuration(
          this._synAudioResult.sampleOffset,
          this._a.sampleRate
        );

        this._synAudioResult.syncOffset = aOffset - aDecodeLength; // if negative, sync is before playback, positive, sync after playback

        console.log(
          "correlation",
          this._synAudioResult.correlation,
          "aOffset",
          aOffset,
          "aDecodeLength",
          aDecodeLength,
          "syncOffset",
          this._synAudioResult.syncOffset
        );
      }

      // anything lower than .5 is likely not synced, but it might sound better than some random sync point
      //if (this._synAudioResult.correlation > 0.5) {
      // "old" time scale
      const { correlation, syncOffset } = this._synAudioResult;

      // "new" time scale
      const buffered =
        this._player.metadataTimestamp - this._player.currentTime;
      const delay = syncOffset - buffered;

      const syncLength =
        this._syncQueue.reduce((aac, { duration }) => duration + aac, 0) / 1000;

      if (delay > syncLength)
        // more frames need to be cut than exist on the sync queue
        return [[], SYNCING];

      if (delay < 0) {
        // slice the sync frame and start immediately
        let sliceIndex = 0;
        for (
          let t = 0;
          sliceIndex < this._syncQueue.length && t < -delay;
          sliceIndex++
        )
          t += this._syncQueue[sliceIndex].duration;

        this._syncQueue = this._syncQueue.slice(sliceIndex);
      }

      console.log("syncOffset", syncOffset, "buffered", buffered);

      console.log(
        "playbackOffset",
        delay,
        "syncLength",
        syncLength,
        "delay",
        delay
      );

      // prettier-ignore
      this._icecast[fireEvent](
        event.WARN,
        `Reconnected successfully after ${this._icecast.state}.`,
        `Found ${((this._syncQueue.reduce((acc, { duration }) => acc + duration, 0) + delay) / 1000).toFixed(3)} seconds of overlapping audio data in new request.`,
        `Synchronized old and new request with ${(Math.round(correlation * 10000) / 100).toFixed(2)}% confidence.`
      );

      this.initSync();
      this.initQueue();

      return [this._syncQueue, PCM_SYNCED, delay];
      //}
    } catch (e) {
      if (
        this._icecast.state !== state.STOPPING &&
        this._icecast.state !== state.STOPPED
      )
        this._icecast[fireEvent](
          event.WARN,
          `Unable to synchronize after ${this._icecast.state}.`,
          e
        );
    }
  }

  async _decodeQueues() {
    const audioCtx = WebAudioPlayer.constructor.audioContext;

    [this._a, this._b] = await Promise.all([
      // decode the pcm queue only once
      this._a
        ? this._a
        : audioCtx.decodeAudioData(
            concatBuffers(this._pcmQueue.map(({ data }) => data)).buffer
          ),
      audioCtx.decodeAudioData(
        concatBuffers(this._syncQueue.map(({ data }) => data)).buffer
      ),
    ]);
  }
}
