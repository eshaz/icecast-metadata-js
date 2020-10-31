import mp3parser from "mp3-parser";
import MetadataBuffer from "./metadata-js/MetadataBuffer";
import IcecastMetadataQueue from "./metadata-js/IcecastMetadataQueue";
import IcecastReadableStream from "./metadata-js/IcecastReadableStream";
import ISOBMFF from "../isobmff/ISOBMFF";

export default class MetadataPlayer {
  constructor({ onMetadataUpdate }) {
    this._icecastMetadataQueue = new IcecastMetadataQueue({
      onMetadataUpdate: (meta) => onMetadataUpdate(meta),
    });
    this._audioElement = new Audio();
    this._onMetadataUpdate = onMetadataUpdate;
    this._streamBuffer = new Uint8Array(0);

    this._playing = false;
  }

  get playing() {
    return this._playing;
  }

  async _createMediaSource(mimeType) {
    this._mediaSource = new MediaSource();
    this._audioElement.src = URL.createObjectURL(this._mediaSource);

    return new Promise((resolve) => {
      this._mediaSource.addEventListener(
        "sourceopen",
        () => {
          this._sourceBuffer = this._mediaSource.addSourceBuffer(mimeType);
          this._sourceBuffer.mode = "sequence";
          resolve();
        },
        { once: true }
      );
    });
  }

  _destroyMediaSource() {
    this._mediaSource = null;
    this._playPromise &&
      this._playPromise
        .then(() => this._audioElement.removeAttribute("src"))
        .then(() => this._audioElement.load())
        .catch(() => {});
  }

  async _appendSourceBuffer(chunk) {
    this._sourceBuffer.appendBuffer(chunk);

    return new Promise((resolve) => {
      this._sourceBuffer.addEventListener("updateend", resolve, { once: true });
    });
  }

  async fetchMimeType(endpoint) {
    const headResponse = await fetch(endpoint, {
      method: "HEAD",
      mode: "cors",
    }).catch(() => {});

    return headResponse ? headResponse : new Promise(() => {});
  }

  async fetchStream(endpoint) {
    return fetch(endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      },
      signal: this._controller.signal,
    });
  }

  async checkMediaSource(res) {
    const mimeType = res.headers.get("content-type");

    if (MediaSource.isTypeSupported('audio/mp4; codecs="mp3"')) {
      await this._createMediaSource('audio/mp4; codecs="mp3"');
      return this._streamPromise;
    } else {
      throw new Error(
        `Your browser does not support MediaSource ${mimeType}. Try using Google Chrome.`
      );
    }
  }

  download(bytes) {
    const a = window.document.createElement("a");

    a.href = window.URL.createObjectURL(
      new Blob([bytes], { type: "application/octet-stream" })
    );
    a.download = "download.mp4";

    // Append anchor to body.
    document.body.appendChild(a);
    a.click();
  }

  play(endpoint, icyMetaInt) {
    if (this._playing) {
      this.stop();
    }

    this._playing = true;
    this._controller = new AbortController();

    this._streamPromise = this.fetchStream(endpoint);

    Promise.race([this.fetchMimeType(endpoint), this._streamPromise])
      .then(this.checkMediaSource.bind(this))
      .then(async (res) => {
        this._playPromise = this._audioElement.play();

        await this._appendSourceBuffer(ISOBMFF.header);

        const icecast = new IcecastReadableStream(res, {
          icyMetaInt,
          onStream: async ({ stream }) => {
            const newBuffer = new Uint8Array(
              this._streamBuffer.length + stream.length
            );
            newBuffer.set(this._streamBuffer);
            newBuffer.set(stream, this._streamBuffer.length);

            const newBufferView = new DataView(newBuffer.buffer);

            let frames = [];
            let offset = 0;
            while (offset < newBuffer.length) {
              try {
                const frame = mp3parser.readFrame(newBufferView, offset, true);
                if (!frame) break;
                frames.push(frame);
                offset = frame._section.nextFrameIndex;
              } catch (e) {
                break;
              }
            }

            this._streamBuffer = newBuffer.subarray(offset);

            if (frames.length) {
              const appendBuffer = new Uint8Array([
                ...ISOBMFF.wrap(
                  frames.map((frame) => frame._section.byteLength),
                  newBuffer.subarray(0, offset)
                ),
              ]);

              //this.download(appendBuffer);

              await this._appendSourceBuffer(appendBuffer);
            }
          },
          onMetadata: (value) => {
            this._icecastMetadataQueue.addMetadata(
              value,
              this._sourceBuffer.timestampOffset -
                this._audioElement.currentTime
            );
          },
        });

        for await (const stream of icecast.asyncIterator) {
        }
      });
    /*.catch((e) => {
        if (e.name !== "AbortError") {
          this._onMetadataUpdate(`Error Connecting: ${e.message}`);
        }
        this._destroyMediaSource();
      });*/
  }

  stop() {
    this._playing = false;
    this._controller.abort();
    this._icecastMetadataQueue.purgeMetadataQueue();
  }
}
