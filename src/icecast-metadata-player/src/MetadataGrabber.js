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
    this._statsEndpoint = options.statsEndpoint || `${serverPath}/stats`;
    this._sevenHtmlEndpoint =
      options.sevenHtmlEndpoint || `${serverPath}/7.html`;

    this._statsMethods = options.statsMethods || [
      "icestats",
      "stats",
      "sevenHtml",
      "icy",
      "ogg",
    ];
    this._interval = options.interval || 20000;
    this._onStats = options.onStats || console.log;

    this._state = STOPPED;
  }

  get state() {
    return this._state;
  }

  start() {
    if (this._state === STOPPED) {
      this._state = RUNNING;

      this.getMetadata();

      this._intervalId = setInterval(() => {
        console.log("interval");
        this.getMetadata();
      }, this._interval);
    }
  }

  stop() {
    if (this._state !== STOPPED) {
      this._state = STOPPED;

      clearInterval(this._intervalId);
      this._icyController.abort();
      this._oggController.abort();
      this._icestatsController.abort();
      this._sevenHtmlController.abort();
    }
  }

  async getMetadata() {
    if (this._state === RUNNING) {
      this._icyController = new AbortController();
      this._oggController = new AbortController();
      this._icestatsController = new AbortController();
      this._sevenHtmlController = new AbortController();

      const promises = [];
      //if (this._statsMethods.includes("icestats"))
      promises.push(this.getIcestats());
      //if (this._statsMethods.includes("sevenHtml"))
      promises.push(this.getSevenHtml());
      //if (this._statsMethods.includes("stats"))
      //promises.push(this.getStats());
      //if (this._statsMethods.includes("icy"))
      promises.push(this.getIcyMetadata());
      //if (this._statsMethods.includes("ogg"))
      promises.push(this.getOggMetadata());

      const stats = await Promise.all(promises).then((stats) =>
        stats.reduce((acc, stat) => ({ ...acc, ...stat }), {})
      );
      this._state = RUNNING;
      this._onStats(stats);
      return stats;
    }
  }

  async getIcestats() {
    return this._fetch({
      endpoint: this._icestatsEndpoint,
      controller: this._icestatsController,
      mapper: (res) => res.json(),
    }).finally(() => {
      this._icestatsController = new AbortController();
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
    return this._fetch({
      endpoint: this._sevenHtmlEndpoint,
      controller: this._sevenHtmlController,
      mapper: async (res) => ({
        sevenHtml: (await res.text()).match(/(.*?)<\/body>/gi).map((s) => {
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
      }),
    }).finally(() => {
      this._sevenHtmlController = new AbortController();
    });
  }

  async getIcyMetadata() {
    return this._getStreamMetadata({
      endpoint: this._streamEndpoint,
      controller: this._icyController,
      metadataType: "icy",
      headers: { "Icy-MetaData": 1 },
    }).finally(() => {
      this._icyController = new AbortController();
    });
  }

  async getOggMetadata() {
    return this._getStreamMetadata({
      endpoint: this._streamEndpoint,
      controller: this._oggController,
      metadataType: "ogg",
    }).finally(() => {
      this._oggController = new AbortController();
    });
  }

  async _getStreamMetadata({ endpoint, controller, headers, metadataType }) {
    return this._fetch({
      endpoint,
      controller,
      headers,
      mapper: async (res) =>
        new Promise((resolve) => {
          new IcecastReadableStream(res, {
            onMetadata: ({ metadata }) => {
              controller.abort();
              resolve({ [metadataType]: metadata });
            },
            onMetadataFailed: () => {
              controller.abort();
              resolve({ [metadataType]: {} });
            },
            metadataTypes: metadataType,
          }).startReading();
        }),
    });
  }

  async _fetch({ endpoint, controller, mapper, headers = {} }) {
    this._state = FETCHING;

    return fetch(endpoint, {
      headers,
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
        return res;
      })
      .then(mapper)
      .catch((e) => {
        if (e.name !== "AbortError") {
          console.warn(`Failed to fetch ${endpoint}`, e);
        }
      });
  }
}
