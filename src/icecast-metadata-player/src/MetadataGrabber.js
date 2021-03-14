import { IcecastReadableStream } from "icecast-metadata-js";

const noOp = () => {};

const STOPPED = "stopped";
const RUNNING = "running";
const FETCHING = "fetching";

export default class MetadataGrabber {
  constructor(streamEndpoint, options = {}) {
    this._streamEndpoint = streamEndpoint;

    const url = this._streamEndpoint.split("/");
    const mountpoint = url.pop();
    const serverPath = url.join("/");

    this._icestatsEndpoint =
      options.icestatsEndpoint || `${serverPath}/status-json.xsl`;
    this._statsEndpoint = options.statsEndpoint || `${serverPath}/stats`;
    this._nextsongsEndpoint =
      options.statsEndpoint || `${serverPath}/nextsongs`;
    this._sevenhtmlEndpoint =
      options.sevenhtmlEndpoint || `${serverPath}/7.html`;

    this._statsMethods = options.statsMethods || [
      "icestats",
      "stats",
      "nextsongs",
      "sevenhtml",
      "icy",
      "ogg",
    ];
    this._interval = options.interval || 20000;
    this._onStats = options.onStats || console.log;

    this._icyController = new AbortController();
    this._oggController = new AbortController();
    this._icestatsController = new AbortController();
    this._statsController = new AbortController();
    this._nextsongsController = new AbortController();
    this._sevenhtmlController = new AbortController();

    this._state = STOPPED;
  }

  static xml2Json(xml) {
    const deserialize = (xml) =>
      new DOMParser().parseFromString(xml, "application/xml");

    const serialize = (dom) => {
      if (!dom.children.length) {
        return Number.isNaN(Number(dom.innerHTML))
          ? dom.innerHTML
          : Number(dom.innerHTML);
      }

      const json = {};

      for (const child of dom.children) {
        if (child.nodeName in json) {
          if (Array.isArray(json[child.nodeName])) {
            json[child.nodeName].push(serialize(child));
          } else {
            json[child.nodeName] = [json[child.nodeName], serialize(child)];
          }
        } else {
          json[child.nodeName] = serialize(child);
        }
      }

      return json;
    };

    return serialize(deserialize(xml));
  }

  get state() {
    return this._state;
  }

  start() {
    if (this._state === STOPPED) {
      this._state = RUNNING;

      this.getMetadata();

      this._intervalId = setInterval(() => {
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
      this._statsController.abort();
      this._sevenhtmlController.abort();
    }
  }

  async getMetadata() {
    if (this._state === RUNNING) {
      console.log("fetching");
      const promises = [];
      //if (this._statsMethods.includes("icestats"))
      promises.push(this.getIcestats());
      //if (this._statsMethods.includes("sevenhtml"))
      promises.push(this.getSevenhtml());
      //if (this._statsMethods.includes("stats"))
      promises.push(this.getStats());
      //if (this._statsMethods.includes("nextsongs"))
      promises.push(this.getNextsongs());
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
    })
      .then((stats) => ({ icestats: stats ? stats.icestats : {} }))
      .finally(() => {
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
  async getSevenhtml() {
    return this._fetch({
      endpoint: this._sevenhtmlEndpoint,
      controller: this._sevenhtmlController,
      mapper: async (res) =>
        (await res.text()).match(/(.*?)<\/body>/gi).map((s) => {
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
    })
      .then((sevenhtml) => ({
        sevenhtml,
      }))
      .finally(() => {
        this._sevenhtmlController = new AbortController();
      });
  }

  async getStats() {
    return this._fetch({
      endpoint: this._statsEndpoint,
      controller: this._statsController,
      mapper: async (res) =>
        res.text().then((xml) => MetadataGrabber.xml2Json(xml)),
    })
      .then((stats) => ({
        stats: stats || "",
      }))
      .finally(() => {
        this._statsController = new AbortController();
      });
  }

  async getNextsongs() {
    return this._fetch({
      endpoint: this._nextsongsEndpoint,
      controller: this._nextsongsController,
      mapper: async (res) =>
        res.text().then((xml) => MetadataGrabber.xml2Json(xml)),
    })
      .then((nextsongs) => ({
        nextsongs,
      }))
      .finally(() => {
        this._nextsongsController = new AbortController();
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
              resolve(metadata);
            },
            onMetadataFailed: () => {
              controller.abort();
              resolve();
            },
            metadataTypes: metadataType,
          }).startReading();
        }),
    }).then((metadata) => ({ [metadataType]: metadata }));
  }

  async _fetch({ endpoint, controller, mapper, headers = {} }) {
    this._state = FETCHING;

    return fetch(endpoint, {
      method: "GET",
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
