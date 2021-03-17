/**
 * @license
 * @see https://github.com/eshaz/icecast-metadata-js
 * @copyright 2021 Ethan Halsall
 *  This file is part of icecast-metadata-stats.
 *
 *  icecast-metadata-stats free software: you can redistribute it and/or modify
 *  it under the terms of the GNU Lesser General Public License as published by
 *  the Free Software Foundation, either version 3 of the License, or
 *  (at your option) any later version.
 *
 *  icecast-metadata-stats distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Lesser General Public License for more details.
 *
 *  You should have received a copy of the GNU Lesser General Public License
 *  along with this program.  If not, see <https://www.gnu.org/licenses/>
 */

import { IcecastReadableStream } from "icecast-metadata-js";

const noOp = () => {};

const STOPPED = "stopped";
const RUNNING = "running";
const FETCHING = "fetching";

export default class IcecastMetadataStats {
  constructor(streamEndpoint, options = {}) {
    this._streamEndpoint = streamEndpoint;

    const url = this._streamEndpoint.split("/");
    url.pop(); // mountpoint
    const serverPath = url.join("/");

    this._icestatsEndpoint =
      options.icestatsEndpoint || `${serverPath}/status-json.xsl`;
    this._statsEndpoint = options.statsEndpoint || `${serverPath}/stats`;
    this._nextsongsEndpoint =
      options.nextsongsEndpoint || `${serverPath}/nextsongs`;
    this._sevenhtmlEndpoint =
      options.sevenhtmlEndpoint || `${serverPath}/7.html`;

    this._sources = options.sources || [
      "icestats",
      "stats",
      "nextsongs",
      "sevenhtml",
      "icy",
      "ogg",
    ];

    this._icyMetaInt = options.icyMetaInt;
    this._icyDetectionTimeout = options.icyDetectionTimeout;

    this._interval = (options.interval || 30) * 1000;
    this._onStats = options.onStats || noOp;
    this._onStatsFetch = options.onStatsFetch || noOp;

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

    const serialize = (element) => {
      if (!element.children.length) {
        return Number.isNaN(Number(element.innerHTML))
          ? element.innerHTML
          : Number(element.innerHTML);
      }

      const json = {};

      for (const child of element.children) {
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

  get icestatsEndpoint() {
    return this._icestatsEndpoint;
  }

  get statsEndpoint() {
    return this._statsEndpoint;
  }

  get nextsongsEndpoint() {
    return this._nextsongsEndpoint;
  }

  get sevenhtmlEndpoint() {
    return this._sevenhtmlEndpoint;
  }

  start() {
    if (this._state === STOPPED) {
      this._state = RUNNING;

      this.fetch().then((stats) => this._onStats(stats));

      this._intervalId = setInterval(() => {
        this.fetch().then((stats) => this._onStats(stats));
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

  async fetch() {
    if (this._state !== FETCHING) {
      this._onStatsFetch(this._sources);
      const promises = [];
      if (this._sources.includes("icestats")) promises.push(this.getIcestats());
      if (this._sources.includes("sevenhtml"))
        promises.push(this.getSevenhtml());
      if (this._sources.includes("stats")) promises.push(this.getStats());
      if (this._sources.includes("nextsongs"))
        promises.push(this.getNextsongs());
      if (this._sources.includes("icy")) promises.push(this.getIcyMetadata());
      if (this._sources.includes("ogg")) promises.push(this.getOggMetadata());

      const stats = await Promise.all(promises).then((stats) =>
        stats.reduce((acc, stat) => ({ ...acc, ...stat }), {})
      );
      return stats;
    }
  }

  async getIcestats() {
    return this._fetch({
      endpoint: this._icestatsEndpoint,
      controller: this._icestatsController,
      mapper: (res) => res.json(),
    })
      .then((stats) => ({ icestats: stats && stats.icestats }))
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
                currentListeners: parseInt(stats[4]),
                peakListeners: parseInt(stats[2]),
                maxListeners: parseInt(stats[3]),
                bitrate: parseInt(stats[5]),
                status: parseInt(stats[1]),
                serverListeners: parseInt(stats[0]),
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

  // http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#General_Server_Summary
  async getStats() {
    return this._fetch({
      endpoint: this._statsEndpoint,
      controller: this._statsController,
      mapper: async (res) =>
        res
          .text()
          .then(
            (xml) =>
              IcecastMetadataStats.xml2Json(xml).SHOUTCASTSERVER.STREAMSTATS
          ),
    })
      .then((stats) => ({
        stats,
      }))
      .finally(() => {
        this._statsController = new AbortController();
      });
  }

  // http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#Nextsongs
  async getNextsongs() {
    return this._fetch({
      endpoint: this._nextsongsEndpoint,
      controller: this._nextsongsController,
      mapper: async (res) =>
        res
          .text()
          .then(
            (xml) =>
              IcecastMetadataStats.xml2Json(xml).SHOUTCASTSERVER.NEXTSONGS
          ),
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
            icyMetaInt: this._icyMetaInt,
            icyDetectionTimeout: this._icyDetectionTimeout,
          }).startReading();
        }),
    }).then((metadata) => ({ [metadataType]: metadata }));
  }

  async _fetch({ endpoint, controller, mapper, headers = {} }) {
    let oldState = this._state;
    this._state = FETCHING;

    return fetch(endpoint, {
      method: "GET",
      headers,
      signal: controller.signal,
    })
      .then((res) => {
        this._state = oldState;
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
