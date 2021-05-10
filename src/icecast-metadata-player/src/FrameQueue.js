import { event, fireEvent } from "./global";

export default class FrameQueue {
  constructor(icecast) {
    this.CACHE_DURATION = 60000; // milliseconds of burst on connect data

    this._icecast = icecast;

    this.initSync();
    this.initQueue();
  }

  initSync() {
    this._syncQueue = [];
    this._matchIndex = 0;
    this._syncPosition = 0;
    this._syncQueueIndex = 0;
  }

  initQueue() {
    this._queue = [];
    this._queueDuration = 0;
  }

  push({ crc32, duration }) {
    this._queue.push({ crc32, duration });
    this._queueDuration += duration;

    if (this._queueDuration >= this.CACHE_DURATION) {
      const { duration } = this._queue.shift();
      this._queueDuration -= duration;
    }
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
  sync(frames) {
    this._syncQueue.push(...frames);

    // search from sync index until end of queue or sync queue
    match: for (; this._matchIndex < this._queue.length; this._matchIndex++) {
      for (
        ;
        this._syncQueueIndex < this._syncQueue.length &&
        this._matchIndex + this._syncQueueIndex < this._queue.length;
        this._syncQueueIndex++
      ) {
        if (
          this._syncQueue[this._syncQueueIndex].crc32 !==
          this._queue[this._matchIndex + this._syncQueueIndex].crc32 // failed to match
        ) {
          this._syncQueueIndex = 0; // reset sync queue index and start over
          continue match;
        }
      }

      // matched all data in sync queue
      break;
    }

    // no matches
    if (this._matchIndex === this._queue.length) {
      // prettier-ignore
      this._icecast[fireEvent](
        event.WARN,
        "Reconnected successfully after retry event.",
        "Found no overlapping frames from previous request."
      );

      const syncQueue = this._syncQueue;
      this.initSync();
      this.initQueue(); // clear queue since there is a gap in data
      return syncQueue;
    }

    const sliceIndex = this._queue.length - this._matchIndex;

    if (this._syncQueue.length > sliceIndex) {
      const newFrames = this._syncQueue.slice(sliceIndex);

      const overlappingDuration =
        this._queue
          .slice(this._matchIndex)
          .reduce((acc, { duration }) => acc + duration, 0) / 1000;

      // prettier-ignore
      this._icecast[fireEvent](
          event.WARN,
          "Reconnected successfully after retry event.",
          `Found ${sliceIndex} frames (${overlappingDuration.toFixed(3)} seconds) of overlapping audio data in new request.`,
        );

      this.initSync();
      return newFrames;
    }

    return [];
  }
}
