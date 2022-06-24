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
  constructor(icecast) {
    this.CACHE_DURATION = 60000; // milliseconds of burst on connect data

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

    const minSyncLength = 1; // seconds

    if (
      this._syncQueue[this._syncQueue.length - 1].totalDuration < minSyncLength
    ) {
      return [[], SYNCING];
    }

    const samplesToDuration = (samples, rate) => samples / rate;
    const durationToSamples = (duration, rate) => Math.round(duration * rate);

    if (!this._synAudioResult) {
      const audioCtx = WebAudioPlayer.constructor.audioContext;

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
        // need to handle this situation where buffered data continues to go into this player while doing pcm sync
        // maybe another sync state that creates a new player immediately when it is known that there are no crc data matches
        console.log("need more data");
        return [[], SYNCING]; // need more data
      }

      console.log("decoded", performance.now());

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

      const aDecodeStart =
        aFrameLength -
        samplesToDuration(aDecoded.samplesDecoded, aDecoded.sampleRate);
      const bDecodeStart =
        bFrameLength -
        samplesToDuration(bDecoded.samplesDecoded, bDecoded.sampleRate);

      console.log(
        "aFrameLength",
        aFrameLength,
        "bFrameLength",
        bFrameLength,
        "aDecodeStart",
        aDecodeStart,
        "bDecodeStart",
        bDecodeStart,
        "aDecodeLength",
        samplesToDuration(this._a.length, this._a.sampleRate),
        "bDecodeLength",
        samplesToDuration(this._b.length, this._b.sampleRate)
      );

      this._synAudioResult = await synAudio.syncWorker(
        aDecoded,
        bDecoded,
        aDecoded.sampleRate
      );

      console.log("synced", performance.now());

      const aOffset = samplesToDuration(
        this._synAudioResult.sampleOffset,
        aDecoded.sampleRate
      );

      this._bMinLength = aFrameLength - aOffset - (aDecodeStart + bDecodeStart);

      console.log(
        "offset",
        aOffset,
        "minLength",
        this._bMinLength,
        "correlation",
        this._synAudioResult.correlation
      );
    }

    const bFrameLength =
      this._syncQueue[this._syncQueue.length - 1].totalDuration / 1000;

    console.log(bFrameLength, this._bMinLength);

    if (bFrameLength <= this._bMinLength) {
      // need more frames
      return [[], SYNCING];
    }

    let sliceIndex = 0;
    for (; sliceIndex < this._syncQueue.length - 1; sliceIndex++) {
      if (this._syncQueue[sliceIndex].totalDuration / 1000 > this._bMinLength)
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
    return [newFrames, PCM_SYNCED];

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
