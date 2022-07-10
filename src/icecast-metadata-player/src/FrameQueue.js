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
import PlayerFactory from "./PlayerFactory.js";

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
    this._syncQueueDuration = 0;

    this._synAudioResult = null;
    this._a = null;
    this._b = null;
  }

  initQueue() {
    this._absoluteQueueIndex = 0;
    this._absoluteQueueDuration = 0;

    this._crcQueue = [];
    this._crcQueueDuration = 0;
    this._crcQueueIndexes = {};

    this._pcmQueue = [];
    this._pcmQueueDuration = 0;
  }

  get buffered() {
    return this._absoluteQueueDuration / 1000 - this._player.currentTime;
  }

  add(frame) {
    // crc queue
    const { crc32, duration } = frame;
    this._crcQueue.push({ crc32, duration });
    this._crcQueueDuration += duration;
    this._absoluteQueueDuration += duration;

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

  _addAllSyncQueue(frames) {
    for (const frame of frames) {
      this._syncQueueDuration += frame.duration;
      this._syncQueue.push(frame);
    }
  }

  /**
   *
   * @param {Array<CodecFrame|OggPage>} frames
   */
  async sync(frames) {
    this._addAllSyncQueue(frames);

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
    this.initQueue();
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

    let matched, outOfFrames, syncPoint;

    if (crcSyncPoints) {
      align_queues: for (const absoluteSyncPoint of crcSyncPoints) {
        syncPoint =
          absoluteSyncPoint -
          (this._absoluteQueueIndex - this._crcQueue.length);

        for (
          let i = syncQueueStartIndex;
          i < this._syncQueue.length && syncPoint + i < this._crcQueue.length;
          i++
        )
          if (this._crcQueue[syncPoint + i].crc32 !== this._syncQueue[i].crc32)
            continue align_queues; // failed to match

        outOfFrames =
          syncPoint + this._syncQueue.length <= this._crcQueue.length;
        matched = true;
        break; // full match
      }

      // have some overlapping frames, but none are new frames
      if (outOfFrames) return [[], SYNCING];

      if (matched) {
        const sliceIndex = this._crcQueue.length - syncPoint;
        // prettier-ignore
        this._icecast[fireEvent](
          event.WARN,
          `Reconnected successfully after ${this._icecast.state}.`,
          `Found ${sliceIndex} frames (${(this._crcQueue
            .slice(syncPoint)
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
                           |         sampleOffsetFromEnd    buffered (metadataTimestamp)
  
    (time scale)               -2 -1 0 +1 +2
    (new connection)                 |-----------|--->
                             |       ^^^^^^^^^^^^|^^^^
                             delay               syncLength
  */
  async _pcmSync() {
    try {
      const correlationSyncLength = 1; // seconds
      const initialGranularity = 7;

      const samplesToDuration = (samples, rate) => samples / rate;

      if (!this._synAudioResult) {
        const [pcmQueueDecoded, syncQueueDecoded, sampleRate] =
          await this._decodeQueues();

        const correlationSampleSize = sampleRate * correlationSyncLength;

        // more data is needed to meet the correlationSampleSize
        if (syncQueueDecoded.samplesDecoded <= correlationSampleSize)
          return [[], SYNCING];

        const synAudio = new SynAudio({
          correlationSampleSize,
          initialGranularity,
        });

        this._synAudioResult = await synAudio.syncWorkerConcurrent(
          pcmQueueDecoded,
          syncQueueDecoded,
          Math.max(navigator.hardwareConcurrency - 1, 1)
        );

        this._synAudioResult.sampleOffsetFromEnd =
          samplesToDuration(pcmQueueDecoded.samplesDecoded, sampleRate) -
          samplesToDuration(this._synAudioResult.sampleOffset, sampleRate); // total a samples decoded - sample offset (sampleOffset from end of buffer)
      }

      // anything lower than .5 is likely not synced, but it might sound better than some random sync point
      //if (this._synAudioResult.correlation > 0.5) {
      // "old" time scale
      const { correlation, sampleOffsetFromEnd } = this._synAudioResult;

      // "new" time scale
      let delay = (this.buffered - sampleOffsetFromEnd) * 1000; // if negative, sync is before playback, positive, sync after playback

      if (delay > this._syncQueueDuration)
        // more frames need to be cut than exist on the sync queue
        return [[], SYNCING];

      const frameOverlap = 2;
      if (delay < 0) {
        // slice the sync frame with 'n' frame overlap and start immediately
        let sliceIndex = 0;
        for (
          let t = 0;
          sliceIndex < this._syncQueue.length - frameOverlap && t >= delay;
          sliceIndex++
        )
          t -= this._syncQueue[sliceIndex].duration;

        this._syncQueue = this._syncQueue.slice(sliceIndex - frameOverlap);
      } else {
        // delay start with 'n' frame overlap
        for (let i = 0; i < frameOverlap && i < this._syncQueue.length; i++)
          delay -= this._syncQueue[i].duration;
      }

      // prettier-ignore
      this._icecast[fireEvent](
        event.WARN,
        `Reconnected successfully after ${this._icecast.state}.`,
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
    const decode = (queue) =>
      PlayerFactory.constructor.audioContext.decodeAudioData(
        concatBuffers(queue.map(({ data }) => data)).buffer
      );

    [this._a, this._b] = await Promise.all([
      // decode the pcm queue only once
      this._a ? this._a : decode(this._pcmQueue),
      decode(this._syncQueue),
    ]);

    const getDecodedAudio = (decodedAudioData) => {
      const decoded = {
        channelData: [],
        samplesDecoded: decodedAudioData.length,
      };

      for (let i = 0; i < decodedAudioData.numberOfChannels; i++)
        decoded.channelData.push(
          Float32Array.from(decodedAudioData.getChannelData(i))
        );

      return decoded;
    };

    return [
      getDecodedAudio(this._a),
      getDecodedAudio(this._b),
      this._a.sampleRate,
    ];
  }
}
