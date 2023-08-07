import {
  audioContext,
  concatBuffers,
  event,
  state,
  fireEvent,
  SYNCED,
  PCM_SYNCED,
  SYNCING,
  NOT_SYNCED,
  noOp,
} from "./global.js";

// test if worker can spawn a worker for (i.e. everything but iOS)
let canSpawnWorker;
const spawnWorkerTest = new Worker(
  URL.createObjectURL(
    new Blob(["self.onmessage = () => self.postMessage(!!self.Worker)"], {
      type: "text/javascript",
    }),
  ),
);
spawnWorkerTest.onmessage = (r) => {
  canSpawnWorker = r.data;
  spawnWorkerTest.terminate();
};
spawnWorkerTest.postMessage(null);

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
    clearTimeout(this._syncTimeout);
    this._syncTimeout = null;
    this._syncTimeoutReason = null;
    this._crcSyncPending = true;

    this._syncQueue = [];
    this._syncQueueDuration = 0;

    this._synAudioResult = null;
    this._a = null;
    this._b = null;
  }

  initQueue() {
    this._queueIndex = 0;
    this._queueSamples = 0;
    this._queueSampleRate = 0;

    this._crcQueue = [];
    this._crcQueueDuration = 0;
    this._crcQueueIndexes = {};

    this._pcmQueue = [];
    this._pcmQueueDuration = 0;
  }

  get buffered() {
    return (
      this._queueSamples / this._queueSampleRate - this._player.currentTime || 0
    );
  }

  add(frame) {
    // crc queue
    const { crc32, duration, samples } = frame;
    this._queueSamples += samples;
    this._queueSampleRate = frame.header.sampleRate;

    this._crcQueue.push({ crc32, duration });
    this._crcQueueDuration += duration;

    // update queue index
    let indexes = this._crcQueueIndexes[crc32];
    if (!indexes) {
      indexes = [];
      this._crcQueueIndexes[crc32] = indexes;
    }
    indexes.push(this._queueIndex++);

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
    // stop syncing if the buffer runs out
    if (this._syncTimeout === null) {
      const currentBuffered = this.buffered;

      this._syncReject = noOp;
      this._syncTimeout = setTimeout(() => {
        this._syncTimeoutReason = `Buffer underrun after syncing for ${currentBuffered.toFixed(
          2,
        )} seconds.`;
        this._syncReject(this._syncTimeoutReason);
      }, currentBuffered * 1000);
    }

    this._addAllSyncQueue(frames);

    return new Promise(async (resolve, reject) => {
      if (this._syncTimeoutReason !== null) reject(this._syncTimeoutReason);
      else this._syncReject = reject;

      let syncState;
      // try syncing using crc32 hashes (if the stream data matches exactly)
      if (this._crcSyncPending) syncState = this._crcSync();

      // try syncing using decoded audio and corelation (if audio data matches)
      if (!syncState) {
        this._crcSyncPending = false;
        syncState = await this._pcmSync();
      }

      // streams do not match (not synced)
      if (!syncState) reject("Old and new request do not match.");
      else resolve(syncState);
    })
      .catch((e) => {
        if (
          this._icecast.state !== state.STOPPING &&
          this._icecast.state !== state.STOPPED
        )
          this._icecast[fireEvent](
            event.WARN,
            `Reconnected successfully after ${this._icecast.state}.`,
            "Unable to sync old and new request.",
            e,
          );

        const syncQueue = this._syncQueue;
        this.initSync();
        this.initQueue();
        return [syncQueue, NOT_SYNCED];
      })
      .then((syncState) => {
        if ([SYNCED, PCM_SYNCED].includes(syncState[1])) {
          this.initSync();
        }

        return syncState;
      });
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
          absoluteSyncPoint - (this._queueIndex - this._crcQueue.length);

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

        return [this._syncQueue.slice(sliceIndex), SYNCED];
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
      const initialGranularity = 16;

      const samplesToDuration = (samples, rate) => samples / rate;

      if (!this._synAudioResult) {
        let SynAudio;
        try {
          SynAudio = (
            await import(
              /* webpackChunkName: "synaudio", webpackPrefetch: true */
              "synaudio"
            )
          ).default;
        } catch (e) {
          this._icecast[fireEvent](
            event.WARN,
            "Failed to synchronize old and new stream",
            "Missing `synaudio` dependency.",
          );

          return;
        }

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

        this._synAudioResult = await (canSpawnWorker
          ? synAudio.syncWorkerConcurrent(
              pcmQueueDecoded,
              syncQueueDecoded,
              Math.max(navigator.hardwareConcurrency - 1, 1),
            )
          : synAudio.syncWorker(pcmQueueDecoded, syncQueueDecoded));

        this._synAudioResult.offsetFromEnd = samplesToDuration(
          pcmQueueDecoded.samplesDecoded - this._synAudioResult.sampleOffset,
          sampleRate,
        ); // total queue samples decoded - sample offset (sampleOffset from end of buffer)
      }

      // anything lower than .5 is likely not synced, but it might sound better than some random sync point
      const { correlation, offsetFromEnd } = this._synAudioResult;

      let delay = (this.buffered - offsetFromEnd) * 1000; // if negative, sync is before playback position, positive, sync after playback position

      // more frames need to be cut than exist on the sync queue
      if (-delay > this._syncQueueDuration) return [[], SYNCING];

      const frameOverlap = 0;
      if (delay < 0) {
        // slice the sync frame with 'n' frame overlap and start immediately
        let sliceIndex = 0;
        for (
          let t = 0;
          sliceIndex < this._syncQueue.length - frameOverlap && t > delay;
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

      this.initQueue();
      return [this._syncQueue, PCM_SYNCED, delay];
    } catch {}
  }

  async _decodeQueues() {
    const decode = (queue, timeFromEnd) => {
      let sliceIndex = queue.length - 1;

      for (
        let duration = 0;
        duration < timeFromEnd && sliceIndex > 0;
        sliceIndex--
      )
        duration += queue[sliceIndex].duration;

      return this._icecast[audioContext].decodeAudioData(
        concatBuffers(queue.slice(sliceIndex).map(({ data }) => data)).buffer,
      );
    };

    [this._a, this._b] = await Promise.all([
      // decode the pcm queue only once, decode only up to twice the amount of buffered audio
      this._a ? this._a : decode(this._pcmQueue, this.buffered * 2000),
      decode(this._syncQueue, Infinity),
    ]);

    const getDecodedAudio = (decodedAudioData) => {
      const decoded = {
        channelData: [],
        samplesDecoded: decodedAudioData.length,
      };

      for (let i = 0; i < decodedAudioData.numberOfChannels; i++)
        decoded.channelData.push(
          Float32Array.from(decodedAudioData.getChannelData(i)),
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
