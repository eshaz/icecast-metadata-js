import SynAudio from "synaudio";

import { concatBuffers, event, fireEvent } from "./global.js";
import WebAudioPlayer from "./players/WebAudioPlayer.js";

export default class FrameQueue {
  constructor(icecast) {
    this.CACHE_DURATION = 300000; // milliseconds of burst on connect data

    this._icecast = icecast;

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
      if (outOfFrames) return [[], false];

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
        return [newFrames, true];
      }
    }

    // no crc32 matches, try matching with PCM

    const minSyncLength = 0.5; // seconds

    if (
      this._syncQueue[this._syncQueue.length - 1].totalDuration < minSyncLength
    ) {
      return [[], false];
    }

    const samplesToDuration = (samples, rate) => samples / rate;

    if (!this._synAudioResult) {
      const audioCtx = WebAudioPlayer.constructor.audioContext;

      const [a, b] = await Promise.all([
        audioCtx.decodeAudioData(
          concatBuffers(this._queue.map(({ data }) => data)).buffer
        ),
        audioCtx.decodeAudioData(
          concatBuffers(this._syncQueue.map(({ data }) => data)).buffer
        ),
      ]);

      console.log("decoded", performance.now());

      const synAudio = new SynAudio({
        covarianceSampleSize: a.sampleRate * minSyncLength,
        initialGranularity: 32,
      });

      const aDecoded = {
        channelData: [],
        samplesDecoded: a.length,
        sampleRate: a.sampleRate,
      };
      const bDecoded = {
        channelData: [],
        samplesDecoded: b.length,
        sampleRate: b.sampleRate,
      };

      for (let i = 0; i < a.numberOfChannels; i++)
        aDecoded.channelData.push(a.getChannelData(i));

      for (let i = 0; i < b.numberOfChannels; i++)
        bDecoded.channelData.push(b.getChannelData(i));

      this._synAudioResult = await synAudio.syncWorker(
        aDecoded,
        bDecoded,
        aDecoded.sampleRate
      );

      console.log("synced", performance.now());

      const aFrameLength = samplesToDuration(
        this._queue.reduce((aac, { samples }) => samples + aac, 0),
        this._queue[0].header.sampleRate
      );
      const bFrameLength = samplesToDuration(
        this._syncQueue.reduce((aac, { samples }) => samples + aac, 0),
        this._syncQueue[0].header.sampleRate
      );

      const aDecodeStart =
        aFrameLength -
        samplesToDuration(aDecoded.samplesDecoded, aDecoded.sampleRate);
      const bDecodeStart =
        bFrameLength -
        samplesToDuration(bDecoded.samplesDecoded, bDecoded.sampleRate);

      const aOffset = samplesToDuration(
        this._synAudioResult.sampleOffset,
        aDecoded.sampleRate
      );
      const bTrim = samplesToDuration(
        this._synAudioResult.trim,
        bDecoded.sampleRate
      );

      this._bMinLength = aFrameLength - aOffset - bTrim;

      console.log(
        "aFrameLength",
        aFrameLength,
        "bFrameLength",
        bFrameLength,
        "aDecodeStart",
        aDecodeStart,
        "bDecodeStart",
        bDecodeStart,
        "offset",
        aOffset,
        "trim",
        bTrim,
        "minLength",
        this._bMinLength,
        "covariance",
        this._synAudioResult.covariance
      );
    }

    const bFrameLength =
      this._syncQueue[this._syncQueue.length - 1].totalDuration / 1000;

    console.log(bFrameLength, this._bMinLength);

    if (bFrameLength <= this._bMinLength) {
      // need more frames
      return [[], false];
    }

    let sliceIndex = this._syncQueue.length;
    for (; sliceIndex > 0; sliceIndex--) {
      if (
        this._syncQueue[sliceIndex - 1].totalDuration / 1000 <
        this._bMinLength
      )
        break;
    }

    console.log(
      "slice",
      sliceIndex,
      this._syncQueue[sliceIndex].totalDuration / 1000
    );

    const newFrames = this._syncQueue.slice(sliceIndex);
    this.initSync();
    this.initQueue();
    return [newFrames, true];

    /*
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
    return [syncQueue, false];
    */
  }
}
