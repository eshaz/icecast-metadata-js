import { event, fireEvent } from "./global.js";

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
  }

  initQueue() {
    this._queue = [];
    this._queueDuration = 0;

    this._queueIndexes = {};
    this._absolutePosition = 0;
  }

  add({ crc32, duration }) {
    this._queue.push({ crc32, duration });
    this._queueDuration += duration;

    // update queue index
    let indexes = this._queueIndexes[crc32];
    if (!indexes) {
      indexes = [];
      this._queueIndexes[crc32] = indexes;
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
  sync(frames) {
    this._syncQueue.push(...frames);

    // get all indexed matches for crc and check
    const syncQueueStartIndex = 0;
    const syncQueueCrc = this._syncQueue[syncQueueStartIndex].crc32;
    const syncPoints = this._queueIndexes[syncQueueCrc];

    let matched, outOfFrames;

    if (syncPoints) {
      align_queues: for (const absoluteSyncPoint of syncPoints) {
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
  }
}
