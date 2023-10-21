import fs from "fs/promises";
import path from "path";
import ServerMock from "mock-http-server";
import IcecastMetadataStats from "icecast-metadata-stats";

describe("IcecastMetadataStats", () => {
  let testData;

  const DATA_PATH = new URL("data", import.meta.url).pathname;
  const server = new ServerMock({ host: "localhost", port: 9000 });

  beforeAll(async () => {
    testData = await Promise.all([
      fs.readFile(path.join(DATA_PATH, "icy")),
      fs.readFile(path.join(DATA_PATH, "ogg")),
      fs.readFile(path.join(DATA_PATH, "status-json.xsl")),
      fs.readFile(path.join(DATA_PATH, "7.html")),
    ]).then((data) => ({
      icy: data[0],
      ogg: data[1],
      icestats: data[2],
      sevenhtml: data[3],
    }));
  });

  beforeEach((done) => {
    server.start(done);
  });

  afterEach((done) => {
    server.stop(done);
  });

  describe("ICY Metadata", () => {
    it("should parse ICY metadata", async () => {
      server.on({
        method: "GET",
        path: "/stream",
        reply: {
          status: 200,
          headers: { IcyMetaInt: "16000" },
          body: testData.icy,
        },
      });

      const expectedResult = {
        icy: {
          StreamTitle: "Afterlife - Deeper - Into Places",
        },
      };

      const icecastMetadataStats = new IcecastMetadataStats(
        "http://localhost:9000/stream",
      );

      const actualResult = await icecastMetadataStats.getIcyMetadata();

      expect(expectedResult).toEqual(actualResult);
    });
  });

  describe("Ogg Metadata", () => {
    it("should parse Ogg Metadata", async () => {
      server.on({
        method: "GET",
        path: "/stream",
        reply: {
          status: 200,
          body: testData.ogg,
        },
      });

      const expectedResult = {
        ogg: {
          ALBUM: "Victory Lane",
          ARTIST: "AC '83 & THALREX",
          DESCRIPTION: "3c84B2Skya9kqJ4lxKegrO",
          ENCODER: "Lavf58.67.100",
          TITLE: "Victory Lane",
          VENDOR_STRING: "Lavf58.67.100",
        },
      };

      const icecastMetadataStats = new IcecastMetadataStats(
        "http://localhost:9000/stream",
      );

      const actualResult = await icecastMetadataStats.getOggMetadata();

      expect(expectedResult).toEqual(actualResult);
    });
  });

  describe("Icestats", () => {
    it("should parse Icestats status-json.xsl", async () => {
      server.on({
        method: "GET",
        path: "/status-json.xsl",
        reply: {
          status: 200,
          headers: { "Content-Type": "application/json; charset=UTF-8" },
          body: testData.icestats,
        },
      });

      const expectedResult = {
        icestats: {
          admin: "mscp@localhost",
          host: "mscp3.live-streams.nl",
          location: "MSCP",
          server_id: "Icecast 2.4.4 (MSCP)",
          server_start: "Thu, 08 Jun 2023 23:29:34 +0200",
          server_start_iso8601: "2023-06-08T23:29:34+0200",
          source: [
            {
              FLAC_version: 1,
              bitrate: 128,
              genre: "Classical",
              listener_peak: 44,
              listeners: 13,
              listenurl: "http://mscp3.live-streams.nl:8250/class-flac.flac",
              server_description: "Naim Radio Classical Channel",
              server_name: "Naim Classical",
              server_type: "audio/ogg",
              server_url: "https://www.naimaudio.com",
              stream_start: "Tue, 04 Jul 2023 18:18:09 +0200",
              stream_start_iso8601: "2023-07-04T18:18:09+0200",
              dummy: null,
            },
            {
              bitrate: 320,
              genre: "Classical",
              listener_peak: 58,
              listeners: 22,
              listenurl: "http://mscp3.live-streams.nl:8250/class-high.aac",
              server_description: "Naim Radio Classical Channel",
              server_name: "Naim Classical",
              server_type: "audio/aac",
              server_url: "https://www.naimaudio.com",
              stream_start: "Tue, 04 Jul 2023 18:18:09 +0200",
              stream_start_iso8601: "2023-07-04T18:18:09+0200",
              title:
                "Vermeer Quartet - String Quartet No. 9 in D minor, B. 75 (Op.34) (once listed as Op. 43)~3. Adagio",
              yp_currently_playing:
                "Vermeer Quartet - String Quartet No. 9 in D minor, B. 75 (Op.34) (once listed as Op. 43)~3. Adagio",
            },
            {
              bitrate: 128,
              genre: "Classical",
              listener_peak: 11,
              listeners: 0,
              listenurl: "http://mscp3.live-streams.nl:8250/class-low.mp3",
              server_description: "Naim Radio Classical Channel",
              server_name: "Naim Classical",
              server_type: "audio/mpeg",
              server_url: "https://www.naimaudio.com",
              stream_start: "Tue, 04 Jul 2023 18:18:09 +0200",
              stream_start_iso8601: "2023-07-04T18:18:09+0200",
              title:
                "Vermeer Quartet - String Quartet No. 9 in D minor, B. 75 (Op.34) (once listed as Op. 43)~3. Adagio",
              dummy: null,
            },
          ],
        },
      };

      const icecastMetadataStats = new IcecastMetadataStats(
        "http://localhost:9000/stream",
      );

      const actualResult = await icecastMetadataStats.getIcestats();

      expect(expectedResult).toEqual(actualResult);
    });
  });

  describe("7.html", () => {
    it("should parse 7.html", async () => {
      server.on({
        method: "GET",
        path: "/7.html",
        reply: {
          status: 200,
          headers: { "Content-Type": "text/html; charset=ISO8859-1" },
          body: testData.sevenhtml,
        },
      });

      const expectedResult = {
        sevenhtml: [
          {
            StreamTitle: "The HHA - HHA Show 26 Oct 2018",
            currentListeners: 9,
            peakListeners: 61,
            maxListeners: 1000,
            bitrate: 64,
            status: 1,
            serverListeners: 24,
          },
          {
            StreamTitle: "The HHA - HHA Show 26 Oct 2018",
            currentListeners: 13,
            peakListeners: 37,
            maxListeners: 1000,
            bitrate: null,
          },
        ],
      };

      const icecastMetadataStats = new IcecastMetadataStats(
        "http://localhost:9000/stream",
      );

      const actualResult = await icecastMetadataStats.getSevenhtml();

      expect(expectedResult).toEqual(actualResult);
    });
  });

  /*
  // not implemented in node js
  describe("stats", () => {
    it("should parse stats", async () => {
    });
  });

  describe("nextsongs", () => {
    it("should parse nextsongs", async () => {
    });
  });
  */
});
