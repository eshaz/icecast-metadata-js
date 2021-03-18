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

const p = new WeakMap();

// variables
const icyController = Symbol();
const icyFetchStatus = Symbol();

const oggController = Symbol();
const oggFetchStatus = Symbol();

const icestatsEndpoint = Symbol();
const icestatsController = Symbol();
const icestatsFetchStatus = Symbol();

const statsEndpoint = Symbol();
const statsController = Symbol();
const statsFetchStatus = Symbol();

const nextsongsEndpoint = Symbol();
const nextsongsController = Symbol();
const nextsongsFetchStatus = Symbol();

const sevenhtmlEndpoint = Symbol();
const sevenhtmlController = Symbol();
const sevenhtmlFetchStatus = Symbol();

const streamEndpoint = Symbol();
const icyMetaInt = Symbol();
const icyDetectionTimeout = Symbol();
const sources = Symbol();
const interval = Symbol();
const onStats = Symbol();
const onStatsFetch = Symbol();

const state = Symbol();
const intervalId = Symbol();

// methods
const fetchStats = Symbol();
const getStreamMetadata = Symbol();

export default class IcecastMetadataStats {
  constructor(endpoint, options = {}) {
    p.set(this, {});

    p.get(this)[streamEndpoint] = endpoint;

    const url = p.get(this)[streamEndpoint].split("/");
    url.pop(); // mountpoint
    const serverPath = url.join("/");

    p.get(this)[icestatsEndpoint] =
      options.icestatsEndpoint || `${serverPath}/status-json.xsl`;
    p.get(this)[statsEndpoint] = options.statsEndpoint || `${serverPath}/stats`;
    p.get(this)[nextsongsEndpoint] =
      options.nextsongsEndpoint || `${serverPath}/nextsongs`;
    p.get(this)[sevenhtmlEndpoint] =
      options.sevenhtmlEndpoint || `${serverPath}/7.html`;

    p.get(this)[sources] = options.sources || [
      "icestats",
      "stats",
      "nextsongs",
      "sevenhtml",
      "icy",
      "ogg",
    ];

    p.get(this)[icyMetaInt] = options.icyMetaInt;
    p.get(this)[icyDetectionTimeout] = options.icyDetectionTimeout;
    p.get(this)[interval] = (options.interval || 30) * 1000;
    p.get(this)[onStats] = options.onStats || noOp;
    p.get(this)[onStatsFetch] = options.onStatsFetch || noOp;
    p.get(this)[icyController] = new AbortController();
    p.get(this)[oggController] = new AbortController();
    p.get(this)[icestatsController] = new AbortController();
    p.get(this)[statsController] = new AbortController();
    p.get(this)[nextsongsController] = new AbortController();
    p.get(this)[sevenhtmlController] = new AbortController();
    p.get(this)[state] = STOPPED;
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
    return p.get(this)[state];
  }

  get icestatsEndpoint() {
    return p.get(this)[icestatsEndpoint];
  }

  get statsEndpoint() {
    return p.get(this)[statsEndpoint];
  }

  get nextsongsEndpoint() {
    return p.get(this)[nextsongsEndpoint];
  }

  get sevenhtmlEndpoint() {
    return p.get(this)[sevenhtmlEndpoint];
  }

  start() {
    if (p.get(this)[state] === STOPPED) {
      p.get(this)[state] = RUNNING;

      this.fetch().then(p.get(this)[onStats]);

      p.get(this)[intervalId] = setInterval(() => {
        this.fetch().then(p.get(this)[onStats]);
      }, p.get(this)[interval]);
    }
  }

  stop() {
    if (p.get(this)[state] !== STOPPED) {
      p.get(this)[state] = STOPPED;

      clearInterval(p.get(this)[intervalId]);
      p.get(this)[icyController].abort();
      p.get(this)[oggController].abort();
      p.get(this)[icestatsController].abort();
      p.get(this)[statsController].abort();
      p.get(this)[sevenhtmlController].abort();
    }
  }

  async fetch() {
    if (p.get(this)[state] !== FETCHING) {
      const oldState = p.get(this)[state];

      p.get(this)[state] = FETCHING;
      p.get(this)[onStatsFetch](p.get(this)[sources]);

      const promises = [];
      if (p.get(this)[sources].includes("icestats"))
        promises.push(this.getIcestats());
      if (p.get(this)[sources].includes("sevenhtml"))
        promises.push(this.getSevenhtml());
      if (p.get(this)[sources].includes("stats"))
        promises.push(this.getStats());
      if (p.get(this)[sources].includes("nextsongs"))
        promises.push(this.getNextsongs());
      if (p.get(this)[sources].includes("icy"))
        promises.push(this.getIcyMetadata());
      if (p.get(this)[sources].includes("ogg"))
        promises.push(this.getOggMetadata());

      const stats = await Promise.all(promises).then((stats) =>
        stats.reduce((acc, stat) => ({ ...acc, ...stat }), {})
      );

      p.get(this)[state] =
        p.get(this)[state] !== FETCHING ? p.get(this)[state] : oldState;

      return stats;
    }
  }

  async getIcestats() {
    return this[fetchStats]({
      status: icestatsFetchStatus,
      endpoint: p.get(this)[icestatsEndpoint],
      controller: p.get(this)[icestatsController],
      mapper: (res) => res.json(),
    })
      .then((stats) => ({ icestats: stats && stats.icestats }))
      .finally(() => {
        p.get(this)[icestatsController] = new AbortController();
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
    return this[fetchStats]({
      status: sevenhtmlFetchStatus,
      endpoint: p.get(this)[sevenhtmlEndpoint],
      controller: p.get(this)[sevenhtmlController],
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
        p.get(this)[sevenhtmlController] = new AbortController();
      });
  }

  // http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#General_Server_Summary
  async getStats() {
    return this[fetchStats]({
      status: statsFetchStatus,
      endpoint: p.get(this)[statsEndpoint],
      controller: p.get(this)[statsController],
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
        p.get(this)[statsController] = new AbortController();
      });
  }

  // http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#Nextsongs
  async getNextsongs() {
    return this[fetchStats]({
      status: nextsongsFetchStatus,
      endpoint: p.get(this)[nextsongsEndpoint],
      controller: p.get(this)[nextsongsController],
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
        p.get(this)[nextsongsController] = new AbortController();
      });
  }

  async getIcyMetadata() {
    return this[getStreamMetadata]({
      status: icyFetchStatus,
      endpoint: p.get(this)[streamEndpoint],
      controller: p.get(this)[icyController],
      metadataType: "icy",
      headers: { "Icy-MetaData": 1 },
    }).finally(() => {
      p.get(this)[icyController] = new AbortController();
    });
  }

  async getOggMetadata() {
    return this[getStreamMetadata]({
      status: oggFetchStatus,
      endpoint: p.get(this)[streamEndpoint],
      controller: p.get(this)[oggController],
      metadataType: "ogg",
    }).finally(() => {
      p.get(this)[oggController] = new AbortController();
    });
  }

  async [getStreamMetadata]({
    status,
    endpoint,
    controller,
    headers,
    metadataType,
  }) {
    return this[fetchStats]({
      status,
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
            icyMetaInt: p.get(this)[icyMetaInt],
            icyDetectionTimeout: p.get(this)[icyDetectionTimeout],
          }).startReading();
        }),
    }).then((metadata) => ({ [metadataType]: metadata }));
  }

  async [fetchStats]({ status, endpoint, controller, mapper, headers = {} }) {
    if (!p.get(this)[status]) {
      p.get(this)[status] = true;
      return fetch(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      })
        .then((res) => {
          p.get(this)[status] = false;
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
}
