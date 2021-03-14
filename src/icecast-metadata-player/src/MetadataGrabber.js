import { IcecastReadableStream } from "icecast-metadata-js";

const noOp = () => {};

const STOPPED = Symbol();
const RUNNING = Symbol();
const FETCHING = Symbol();

export default class MetadataGrabber {
  constructor(streamEndpoint, options = {}) {
    this._streamEndpoint = streamEndpoint;

    const url = this._streamEndpoint.split("/");
    const mountpoint = url.pop();
    const serverPath = url.join("/");

    this._icestatsEndpoint =
      options.icestatsEndpoint || `${serverPath}/status-json.xsl`;
    this._sevenHtmlEndpoint =
      options.sevenHtmlEndpoint || `${serverPath}/7.html`;

    this._statsMethods = options.statsMethods || [
      "icestats",
      "shoutcast",
      "icy",
      "ogg",
    ];
    this._interval = options.interval || 20000;
    this._onStats = options.onStats || noOp;

    this._state = STOPPED;
  }

  get state() {
    return this._state;
  }

  start() {
    if (this._state === STOPPED) {
      this._state = RUNNING;

      this.getStats().then((stats) => {
        console.log(stats);
        this._onStats(stats);
      });

      this._intervalId = setInterval(() => {
        console.log("interval");
        this.getStats().then((stats) => {
          console.log(stats);
          this._onStats(stats);
        });
      }, this._interval);
    }
  }

  stop() {
    if (this._state !== STOPPED) {
      this._state = STOPPED;

      clearInterval(this._intervalId);
      this._streamController.abort();
      this._icestatsController.abort();
      this._sevenHtmlController.abort();
    }
  }

  async getStats() {
    if (this._state === RUNNING) {
      this._streamController = new AbortController();
      this._icestatsController = new AbortController();
      this._sevenHtmlController = new AbortController();

      const promises = [];
      //if (this._statsMethods.includes("icestats"))
      promises.push(this.getIcestats());
      //if (this._statsMethods.includes("sevenHtml"))
      promises.push(this.getSevenHtml());
      if (
        this._statsMethods.includes("icy") ||
        this._statsMethods.includes("ogg")
      )
        promises.push(this.getStreamMetadata());

      const stats = await Promise.all(promises).then((stats) =>
        stats.reduce((acc, stat) => ({ ...acc, ...stat }), {})
      );
      this._state = RUNNING;
      return stats;
    }
  }

  async getIcestats() {
    this._state = FETCHING;

    return fetch(this._icestatsEndpoint, {
      signal: this._icestatsController.signal,
    })
      .then((res) => res.json())
      .catch((e) => {
        if (e.name !== "AbortError") {
          throw e;
        }
      });
  }

  /*
  <HTML><meta http-equiv="Pragma" content="no-cache"></head><body>350,1,132,1000,41,128,Dj Mixes Sety</body></html>
,141,1000,50,128,Gra AutoPilot audycje Energy 2000</body></html>
,27,1000,8,128,Gra Wavelogic audycje Rave With The Wave</body></html>
,578,1000,233,128,youtube.com/RadioPartyOfficial</body></html>
,15,1000,5,64,youtube.com/RadioPartyOfficial</body></html>
  */

  // http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#Equivalent_of_7.html
  // CURRENTLISTENERS STREAMSTATUS PEAKLISTENERS MAXLISTENERS UNIQUELISTENERS BITRATE SONGTITLE
  async getSevenHtml() {
    this._state = FETCHING;

    return fetch(this._sevenHtmlEndpoint, {
      signal: this._sevenHtmlController.signal,
    })
      .then((res) => res.text())
      .then((shoutcastStats) => ({
        sevenHtml: shoutcastStats.match(/(.*?)<\/body>/gi).map((s) => {
          const stats = s
            .match(/(<body>|,)(?<stats>.*)<\/body>/i)
            .groups.stats.split(",");

          return stats.length === 7
            ? {
                StreamTitle: stats[6],
                currentListeners: parseInt(stats[4]), // current listeners matches icestats page
                peakListeners: parseInt(stats[2]),
                maxListeners: parseInt(stats[3]),
                bitrate: parseInt(stats[5]),
                status: parseInt(stats[1]),
                totalListeners: parseInt(stats[0]), // total listeners on the server
              }
            : {
                StreamTitle: stats[4],
                currentListeners: parseInt(stats[2]),
                peakListeners: parseInt(stats[0]),
                maxListeners: parseInt(stats[1]),
                bitrate: parseInt(stats[3]),
              };
        }),
      }))
      .catch((e) => {
        if (e.name !== "AbortError") {
          throw e;
        }
      });
  }

  async getStreamMetadata() {
    this._state = FETCHING;

    return fetch(this._streamEndpoint, {
      headers: this._statsMethods.includes("icy") ? { "Icy-MetaData": 1 } : {},
      signal: this._streamController.signal,
    })
      .then(async (res) => {
        let meta;
        await new Promise((resolve) => {
          new IcecastReadableStream(res, {
            onMetadata: ({ metadata }) => {
              if (!meta) {
                this._streamController.abort();
                meta = metadata;
                resolve();
              }
            },
            metadataTypes: this._statsMethods,
          }).startReading();
        });

        this._streamController = new AbortController();

        return { icy: meta };
      })
      .catch((e) => {
        if (e.name !== "AbortError") {
          throw e;
        }
      });
  }
}
