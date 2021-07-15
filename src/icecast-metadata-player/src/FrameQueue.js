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
    this._alignIndex = 0;
    this._syncIndex = 0;
  }

  initQueue() {
    this._queue = [];
    this._queueDuration = 0;
  }

  add({ crc32, duration }) {
    this._queue.push({ crc32, duration });
    this._queueDuration += duration;

    if (this._queueDuration >= this.CACHE_DURATION) {
      const { duration } = this._queue.shift();
      this._queueDuration -= duration;
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

    // find the index of the element in the queue that aligns with the sync queue
    align_queues: while (this._alignIndex < this._queue.length) {
      while (
        this._syncIndex < this._syncQueue.length &&
        this._alignIndex + this._syncIndex < this._queue.length
      ) {
        if (
          this._syncQueue[this._syncIndex].crc32 !==
          this._queue[this._alignIndex + this._syncIndex].crc32 // failed to match
        ) {
          this._syncIndex = 0; // reset sync queue index and start over
          this._alignIndex++;
          continue align_queues;
        }
        this._syncIndex++;
      }
      break; // full match, queues are aligned
    }

    // no matching data (not synced)
    if (this._alignIndex === this._queue.length) {
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

    const sliceIndex = this._queue.length - this._alignIndex;

    // new frames (synced)
    if (this._syncQueue.length > sliceIndex) {
      // prettier-ignore
      this._icecast[fireEvent](
          event.WARN,
          "Reconnected successfully after retry event.",
          `Found ${sliceIndex} frames (${(this._queue
            .slice(this._alignIndex)
            .reduce((acc, { duration }) => acc + duration, 0) / 1000).toFixed(3)} seconds) of overlapping audio data in new request.`,
          "Synchronized old and new request."
        );

      const newFrames = this._syncQueue.slice(sliceIndex);
      this.initSync();
      return [newFrames, true];
    }

    // no new frames yet
    return [[], false];
  }
}
