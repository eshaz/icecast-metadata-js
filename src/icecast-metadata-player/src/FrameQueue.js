import SynAudio from "synaudio";

import {
  concatBuffers,
  event,
  fireEvent,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
} from "./global.js";
import WebAudioPlayer from "./players/WebAudioPlayer.js";

export default class FrameQueue {
  constructor(icecast, player) {
    this.CACHE_DURATION = 60000; // milliseconds of burst on connect data

    this._icecast = icecast;
    this._player = player;

    this.initSync();
    this.initQueue();
  }

  initSync() {
    this._syncQueue = [];
    this._syncPoint = 0;
    this._synAudioResult = null;
  }

  initQueue() {
    this._queue = [];
    this._queueDuration = 0;

    this._queueIndexes = {};
    this._absolutePosition = 0;
  }

  add(frame) {
    this._queue.push(frame);
    this._queueDuration += frame.duration;

    // update queue index
    let indexes = this._queueIndexes[frame.crc32];
    if (!indexes) {
      indexes = [];
      this._queueIndexes[frame.crc32] = indexes;
    }
    indexes.push(this._absolutePosition++);

    if (this._queueDuration >= this.CACHE_DURATION) {
      const { crc32, duration } = this._queue.shift();
      this._queueDuration -= duration;

      // remove the oldest index
      const indexes = this._queueIndexes[crc32];
      indexes.shift();
      // remove the key if there are no indexes left
      if (!indexes.length) delete this._queueIndexes[crc32];
    }
  }

  addAll(frames) {
    frames.forEach((frame) => this.add(frame));
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

  /**
   *
   * @param {Array<CodecFrame|OggPage>} frames
   * @returns Array with frames as first element, boolean indicating if the sync was successful as the second element
   */
  async sync(frames) {
    this._syncQueue.push(...frames);

    // get all indexed matches for crc and check
    const syncQueueStartIndex = 0;
    const syncQueueCrc = this._syncQueue[syncQueueStartIndex].crc32;
    const crcSyncPoints = this._queueIndexes[syncQueueCrc];

    let matched, outOfFrames;

    if (crcSyncPoints) {
      align_queues: for (const absoluteSyncPoint of crcSyncPoints) {
        this._syncPoint =
          absoluteSyncPoint - (this._absolutePosition - this._queue.length);

        for (
          let i = syncQueueStartIndex;
          i < this._syncQueue.length &&
          this._syncPoint + i < this._queue.length;
          i++
        )
          if (
            this._queue[this._syncPoint + i].crc32 !== this._syncQueue[i].crc32
          )
            continue align_queues; // failed to match

        outOfFrames =
          this._syncPoint + this._syncQueue.length <= this._queue.length;
        matched = true;
        break; // full match
      }

      // have some overlapping frames, but none are new frames
      if (outOfFrames) return [[], SYNCING];

      if (matched) {
        const sliceIndex = this._queue.length - this._syncPoint;
        // prettier-ignore
        this._icecast[fireEvent](
        event.WARN,
        "Reconnected successfully after retry event.",
        `Found ${sliceIndex} frames (${(this._queue
          .slice(this._syncPoint)
          .reduce((acc, { duration }) => acc + duration, 0) / 1000).toFixed(3)} seconds) of overlapping audio data in new request.`,
        "Synchronized old and new request."
      );

        const newFrames = this._syncQueue.slice(sliceIndex);
        this.initSync();
        return [newFrames, SYNCED];
      }
    }

    // no crc32 matches, try matching with PCM

    /*
    add method to PlayerFactory to switch player
      pass in new codec, start time (offset of b frames)

      create new player with the new codec

      set timeout to start new player when start time has elapsed
      After start, remove / stop old player, which should have already stopped since all frames would have been consumed

      Could stop the player as soon as the new player can start to have a faster switch

      change state from SWITCHING to PLAYING once new player starts

    */

    const minSyncLength = 1.5; // seconds

    const samplesToDuration = (samples, rate) => samples / rate;
    const durationToSamples = (duration, rate) => Math.round(duration * rate);

    if (!this._synAudioResult) {
      const audioCtx = WebAudioPlayer.constructor.audioContext;

      const syncStart = performance.now();
      const buffered =
        this._player.metadataTimestamp - this._player.currentTime;

      [this._a, this._b] = await Promise.all([
        this._a // only decode "a" once
          ? this._a
          : audioCtx.decodeAudioData(
              concatBuffers(this._queue.map(({ data }) => data)).buffer
            ),
        audioCtx.decodeAudioData(
          concatBuffers(this._syncQueue.map(({ data }) => data)).buffer
        ),
      ]);

      const correlationSampleSize = this._a.sampleRate * minSyncLength;

      if (this._b.length <= correlationSampleSize) {
        console.log("need more data");
        return [[], SYNCING]; // need more data
      }

      const synAudio = new SynAudio({
        correlationSampleSize,
        initialGranularity: 32,
      });

      const aDecoded = {
        channelData: [],
        samplesDecoded: this._a.length,
        sampleRate: this._a.sampleRate,
      };
      const bDecoded = {
        channelData: [],
        samplesDecoded: this._b.length,
        sampleRate: this._b.sampleRate,
      };

      for (let i = 0; i < this._a.numberOfChannels; i++)
        aDecoded.channelData.push(this._a.getChannelData(i));

      for (let i = 0; i < this._b.numberOfChannels; i++)
        bDecoded.channelData.push(this._b.getChannelData(i));

      const aFrameLength = samplesToDuration(
        this._queue.reduce((aac, { samples }) => samples + aac, 0),
        this._queue[0].header.sampleRate
      );
      const bFrameLength = samplesToDuration(
        this._syncQueue.reduce((aac, { samples }) => samples + aac, 0),
        this._syncQueue[0].header.sampleRate
      );

      const aDecodeLength = samplesToDuration(
        aDecoded.samplesDecoded,
        aDecoded.sampleRate
      );

      this._synAudioResult = await synAudio.syncWorker(
        aDecoded,
        bDecoded,
        aDecoded.sampleRate
      );

      const aOffset = samplesToDuration(
        this._synAudioResult.sampleOffset,
        aDecoded.sampleRate
      );
      const aBufferOffset = aDecodeLength - buffered;

      this._synAudioResult.syncStart = syncStart;
      this._synAudioResult.syncOffset = aOffset - aBufferOffset;
      this._synAudioResult.buffered = buffered;

      console.log(
        "correlation",
        this._synAudioResult.correlation,
        "aOffset",
        aOffset,
        "aDecodeLength",
        aDecodeLength,
        "aBufferOffset",
        aBufferOffset,
        "syncOffset",
        this._synAudioResult.syncOffset,
        "buffered",
        buffered
      );
    }

    /*
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

    // "old" time scale
    const { syncStart, syncOffset, buffered } = this._synAudioResult;
    const syncEnd = performance.now();
    const syncTimeSpent = (syncEnd - syncStart) / 1000;

    // "new" time scale
    const playbackOffset = syncTimeSpent - syncOffset;
    const syncLength =
      this._syncQueue.reduce((aac, { duration }) => duration + aac, 0) / 1000;

    if (playbackOffset > syncLength)
      // more frames need to be cut than exist on the sync queue
      return [[], SYNCING];

    let delay;

    if (playbackOffset > 0) {
      // slice the sync frame and start immediately
      let sliceIndex = 0;
      for (
        let t = 0;
        sliceIndex < this._syncQueue.length && t < playbackOffset;
        sliceIndex++
      )
        t += this._syncQueue[sliceIndex].duration;

      this._syncQueue = this._syncQueue.slice(sliceIndex);
      delay = 0;
    } else {
      // delay playback
      delay = -playbackOffset;
    }

    const newFramesDuration =
      this._syncQueue.reduce((acc, s) => acc + s.duration, 0) / 1000;

    console.log(
      "syncTimeSpent",
      syncTimeSpent,
      "syncOffset",
      syncOffset,
      "buffered",
      buffered
    );

    console.log(
      "playbackOffset",
      playbackOffset,
      "syncLength",
      syncLength,
      "delay",
      delay,
      "newFramesDuration",
      newFramesDuration
    );

    this.initSync();
    this.initQueue();

    // frames, delay, overlap (buffer to wait for new player to be ready)

    return [this._syncQueue, PCM_SYNCED, delay];

    // no matching data (not synced)
    // prettier-ignore
    this._icecast[fireEvent](
        event.WARN,
        "Reconnected successfully after retry event.",
        "Found no overlapping frames from previous request.",
        "Unable to sync old and new request."
      );

    const syncQueue = this._syncQueue;
    this.initSync();
    this.initQueue(); // clear queue since there is a gap in data
    return [syncQueue, NOT_SYNCED];
  }
}
