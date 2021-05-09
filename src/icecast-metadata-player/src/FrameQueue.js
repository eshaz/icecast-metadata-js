import { event, fireEvent } from "./global";

export default class FrameQueue {
  constructor(icecast) {
    this.CACHE_DURATION = 30000; // milliseconds of burst on connect data
    this.SYNC_SIZE = 300; // milliseconds to match
    this._queue = [];
    this._icecast = icecast;

    this.initSync();
  }

  initSync() {
    this._syncQueue = [];
    this._syncIndex = null;
    this._syncPosition = null;
  }

  push({ crc32, totalDuration, duration }) {
    this._queue.push({ crc32, totalDuration, duration });

    if (this._queue[0].totalDuration + this.CACHE_DURATION < totalDuration) {
      this._queue.pop();
    }
  }

  /*
  Aligns the queue with a new incoming data by searching for the
  first matching set crc32 hashes based on audio duration and then returning only the
  frames that do not existing on the queue.
  
                    old data|common data|new data
  (old connection) |--------[--]--------|
  (new connection)         |[--]--------[----->
                            ^ (sync)    ^ (frames to return)
  */
  sync(frames) {
    if (this._syncIndex === null) {
      let syncQueueDuration = this._syncQueue.reduce(
        (acc, { duration }) => acc + duration,
        0
      );

      for (const frame of frames) {
        this._syncQueue.push(frame);
        syncQueueDuration += frame.duration;

        if (syncQueueDuration > this.SYNC_SIZE) break;
      }

      // need more data before we can search
      if (syncQueueDuration < this.SYNC_SIZE) return [];

      // search for matching hashes
      for (
        this._syncIndex = 0;
        this._syncIndex < this._queue.length - this._syncQueue.length;
        this._syncIndex++
      ) {
        if (
          this._syncQueue.every(
            (frame, i) => frame.crc32 === this._queue[this._syncIndex + i].crc32
          )
        ) {
          // match
          this._syncPosition = this._syncIndex - this._queue.length;
          const overlappingDuration =
            this._queue
              .slice(this._syncIndex)
              .reduce((acc, { duration }) => acc + duration, 0) / 1000;

          // prettier-ignore
          this._icecast[fireEvent](
              event.WARN,
              "Reconnected successfully after retry event.",
              `Syncing on ${this._syncQueue.length} frames (${(syncQueueDuration / 1000).toFixed(3)} seconds) of audio.`,
              `Found ${-this._syncPosition} frames (${overlappingDuration.toFixed(3)} seconds) of overlapping audio data in new request.`,
            );
          break;
        }
      }

      // no match
      if (this._syncPosition === null) {
        // prettier-ignore
        this._icecast[fireEvent](
          event.WARN,
          "Reconnected successfully after retry event.",
          `Syncing on ${this._syncQueue.length} frames (${(syncQueueDuration / 1000).toFixed(3)} seconds) of audio.`,
          "Found no overlapping frames from previous request."
        );

        this.initSync();
        return frames;
      }
    }

    this._syncPosition += frames.length;

    // gather new frames until there is at least one new frame
    if (this._syncPosition < 1) return [];

    const newFrames = frames.slice(-this._syncPosition);
    this.initSync();
    return newFrames;
  }
}
