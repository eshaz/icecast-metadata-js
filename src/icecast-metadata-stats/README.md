# Icecast Metadata Stats

Icecast Metadata Stats is a browser and NodeJS library that queries an Icecast compatible server for metadata and statistics. `IcecastMetadataStats` can be using along with [`IcecastMetadataPlayer`](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player) to show the "Now Playing" information while the stream is stopped.

  * Shows "Now Playing" information without playing audio.
  * Configurable metadata / statistics refresh interval.
  * Gathers information from multiple status pages / metadata sources.
  * Available as an [NPM Package](https://www.npmjs.com/package/icecast-metadata-stats) and as a file to include in a `<script>` tag.
    * See [Installing](#installing)

## Supported status APIs:
* **`ICY Metadata`** ICY metadata from a stream
* **`Ogg Metadata`** Ogg metadata from a stream
* **`/status-json.xsl`** Icecast JSON status API
* **`/stats`** Shoutcast V2 XML status API
* **`/7.html`** Shoutcast V1 status API
* **`/nextsongs`** Shoutcast V2 XML next songs API

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

* [Installing](#installing)
* [Usage](#usage)
* [Sources](#sources)
  * [ICY Metadata](#icy-metadata)
  * [Ogg Metadata](#ogg-metadata)
  * [/status-json.xsl](#status-json.xsl)
  * [/stats](#stats)
  * [/7.html](#7.html)
  * [/nextsongs](#nextsongs)
* [API](#api)
  * [Methods](#methods)
  * [Getters](#getters)
* [Instantiating](#instantiating)
  * [Options](#options)
  * [Callbacks](#callbacks)
* [Troubleshooting](#troubleshooting)
  * [Debugging](#debugging)

See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

---

## Installing

### Install via [NPM](https://www.npmjs.com/package/icecast-metadata-stats)
* `npm i icecast-metadata-stats`

  **Example**

  ```javascript
  import IcecastMetadataStats from "icecast-metadata-stats";

  const statsListener = new IcecastMetadataStats(
    "https://dsmrad.io/stream/isics-all", {
      sources: ["icy"],
      onStats: (stats) => { console.log(stats.icy) }
    }
  );
  ```

### Install as a standalone script
1. Download the <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-stats/build/icecast-metadata-stats-0.1.12.min.js" download>latest build</a>.
2. Include the file in a `<script>` tag in your html.
3. `IcecastMetadataStats` is made available as a global variable in your webpage to use wherever.

   **Example**

   ```html
   <script src="icecast-metadata-stats-0.1.12.min.js"></script>
   <script>
     const onStats = (stats) => {
       document.getElementById("stats").innerHTML = stats.icy.StreamTitle;
     };
     const statsListener = 
       new IcecastMetadataStats(
         "https://dsmrad.io/stream/isics-all",
         { sources: ["icy"], onStats }
       );
     statsListener.start();
   </script>
   <body>
     <p> Now Playing: <span id="stats"></span> </p>
   </body>
   ```

## Usage

1. To use `IcecastMetadataStats`, create a new instance by passing in the stream endpoint, and the options object (optional). See the [Options](#options) and [Callbacks](#callback) sections for more information.

    IcecastMetadataStats supports reading metadata and statistics from multiple sources. Each source has it's own use case. See [Sources](#sources) for more information on which source(s) to choose.

    ```javascript
    const statsListener = new IcecastMetadataStats("https://stream.example.com", {
      onStats: (stats) => { console.log(stats) },
      interval: 30,
      sources: ["icy"],
      ...options
    })
    ```

1. Metadata and statistics can be manually queried at any time using the methods listed in [Methods](#methods)
1. To start querying once every *n* seconds for metadata and statistics, call `start()`.
    ```javascript
    statsListener.start();
    ```
1. To stop querying, call `stop()`
    ```javascript
    statsListener.stop();
    ```

## Sources

IcecastMetadataStats supports multiple sources for server statistics and stream metadata. Each source has it's pros and cons. Generally, only one source should be chosen and that source should meet a good balance of information provided and data usage.

  ### `ICY Metadata`

  This source gathers metadata using the first instance of the stream's ICY metadata. Once the first metadata update is encountered, or no ICY metadata is detected, the request is closed.

  * **Availability**: high
    * Icy metadata is available on nearly all MP3 and AAC streams.
    * Availability is dependent on CORS configuration.
  * **Data Usage**: medium
    * The lower the ICY metadata interval, the less data usage this source requires.
    * Normally, at least 16000 bytes of data will need to be transferred before the ICY metadata is able to be read.
  * **Information Provided**: low
    * ICY metadata only provides `StreamTitle` and sometimes `StreamUrl` and `StreamNext`
  * Example:
    ```javascript
    {
      icy: {
        StreamTitle: "Jeff Bennets Lounge Experience - Let's Come Together",
        StreamUrl: "&title=Let's%20Come%20Together"
      }
    }
    ```

  ### `Ogg Metadata`

  This source gathers metadata using the first instance of the stream's Ogg metadata. Once the first metadata update is encountered, or no Ogg metadata is detected, the request is closed.

  * **Availability**: high
    * Ogg metadata is generally available with all streams using the Ogg container.
  * **Data Usage**: high
    * Data usage varies depending on underlying codec, but is generally highest data usage compared to all other methods.
  * **Information Provided**: low - high
    * Ogg metadata can contain anywhere from only title / artist to detailed information on a track.
  * Example
    ```javascript
    {
      ogg: {
        ALBUM: "La Sanpa",
        ARTIST: "La Sanpa",
        COMMENT: "https://lasanpa.bandcamp.com/album/la-sanpa↵CC BY 3.0",
        DATE: "2015",
        GENRE: "Folk",
        TITLE: "Swallow tail",
        TRACKNUMBER: "01",
        VENDOR_STRING: "ocaml-opus by the Savonet Team.",
        YEAR: "2015"
      }
    }
    ```

  ### `/status-json.xsl`

  This source uses the Icecast JSON status api to query for server statistics and metadata.

  * **Availability**: medium - high
    * Available on Icecast version 2.4 and up, and possibly more.
    * May be blocked if hosting Icecast through a reverse proxy.
  * **Data Usage**: low - medium
    * Data usage goes up as more streams are added to the server.
  * **Information Provided**: high
    * Almost all information about a stream and the Icecast server is provided.
  * Example: See [Icecast Docs](https://icecast.org/docs/icecast-latest/server-stats.html)
    ```javascript
    {
      icestats: {
        // see the Icecast docs
      }
    }
    ```

  ### `/stats`

  This source uses the Shoutcast V2 / Icecast XML status api to query for server statistics and metadata.

  **Not supported in NodeJS**

  * **Availability**: medium
    * Available on Shoutcast V2 and some versions of Icecast.
    * May be blocked if hosting Icecast through a reverse proxy.
  * **Data Usage**: low - medium
    * Data usage goes up as more streams are added to the server.
  * **Information Provided**: high
    * Almost all information about a stream and the server is provided.
  * Example: See [Shoutcast Docs](http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#General_Server_Summary)
    ```javascript
    {
      stats: {
        // see the Shoutcast docs
        // XML response is converted to JSON
      }
    }
    ```

  ### `/7.html`

  This source is the original stats page provided by Shoutcast servers. It is still supported by some Icecast servers.

  * **Availability**: medium
    * Available on old Shoutcast versions and some versions of Icecast.
    * May be blocked if hosting Icecast through a reverse proxy.
  * **Data Usage**: low
    * The simplicity of this source makes it the lowest in data usage
    * Data usage is usually less than 500 bytes.
  * **Information Provided**: medium
    * Provides minimal information on listeners and titles for each stream hosted on a server.
  * Example:
    ```javascript
    {
      sevenhtml: {
        StreamTitle: "Jeff Bennets Lounge Experience - Let's Come Together",
        bitrate: 192,
        currentListeners: 15,
        maxListeners: 1000,
        peakListeners: 64,
        serverListeners: 22,
        status: 1
      }
    }
    ```

  ### `/nextsongs`

  **Not supported in NodeJS**

  * **Availability**: low
    * Available on Shoutcast versions
    * Unavailable on Icecast
  * **Data Usage**: low
    * Contains a list of next songs in XML format
  * **Information Provided**: n/a
    * Provides information on upcoming songs.
    * This is the only api that provides this information.
  * Example: See [Shoutcast Docs](http://wiki.winamp.com/wiki/SHOUTcast_DNAS_Server_2_XML_Reponses#Nextsongs)
    ```javascript
    {
      nextsongs: {
        // see the Shoutcast docs
        // XML response is converted to JSON
      }
    }
    ```

## API

### Methods
* `start()` Start querying for metadata / stats once every *n* seconds where *n* is `options.interval`
* `stop()` Stops querying for metadata / stats
* `fetch()` *async* Manually queries for metadata using the sources passed into `options.sources`
* `getIcestats()` *async* Manually queries for the Icecast JSON api `/status-json.xsl`
* `getSevenhtml()` *async* Manually queries for the `/7.html` page
* `getStats()` *async* Manually queries for the `/stats` page
* `getNextsongs()` *async* Manually queries for the Icecast JSON api `/nextsongs`
* `getIcyMetadata()` *async* Manually queries the stream for ICY metadata
* `getOggMetadata()` *async* Manually queries the stream for Ogg metadata

### Getters
* `statsListener.state`
  * Returns the current state of the IcecastMetadataStats.
  * `"running", "fetching", "stopped"`
* `statsListener.icestatsEndpoint`
  * Returns the endpoint for the `icestats` source
* `statsListener.statsEndpoint`
  * Returns the endpoint for the `stats` source
* `statsListener.nextsongsEndpoint`
  * Returns the endpoint for the `nextsongs` source
* `statsListener.sevenhtmlEndpoint`
  * Returns the endpoint for the `sevenhtml` source

## Instantiating

You can create any number of instances of IcecastMetadataStats on your webpage. If you have a single Icecast server, you can create one instance and use it to get information on all of your streams.
```javascript
const statsListener = new IcecastMetadataStats("https://example.com/stream", {
  ...options,
  ...callbacks
});
```
### Options
* `endpoint` (required)
  * Stream HTTP(s) endpoint for the Icecast compatible stream.
  * This endpoint is used to derive the source endpoints by removing the last path part
    * i.e. For `icestats` https://example.com/stream.mp3 would be https://example.com/status-json.xsl
  * This endpoint is used directly for ICY and Ogg metadata.
* `sources` (optional) **Default** `["icestats"]`
  * The source(s) to query.
  * Values:
    * `"icestats"` - Icecast JSON api `/status-json.xsl`
    * `"stats"` - Shoutcast / Icecast XML api `/stats`
    * `"nextsongs"` - Shoutcast nextsongs api `/nextsongs`
    * `"sevenhtml"` - Shoutcast / Icecast `/7.html`
    * `"icy"` - ICY stream metadata
    * `"ogg"` - Ogg stream metadata
* `interval` (optional) **Default** `30` Seconds
  * The frequency in seconds for queries
* `icestatsEndpoint` (optional) **Default** `[stream endpoint]/status-json.xsl`
  * The endpoint for the `icestats` source
* `statsEndpoint` (optional) **Default** `[stream endpoint]/stats`
  * The endpoint for the `stats` source
* `nextsongsEndpoint` (optional) **Default** `[stream endpoint]/nextsongs`
  * The endpoint for the `nextsongs` source
* `sevenhtmlEndpoint` (optional) **Default** `[stream endpoint]/7.html`
  * The endpoint for the `sevenhtml` source

#### *Only used when `["icy"]` metadata type is enabled*
* `icyMetaInt` (optional) **Default** *reads from the response header*
  * ICY Metadata interval read from `Icy-MetaInt` header in the response
* `icyDetectionTimeout` (optional) **Default** `2000`
  * Duration in milliseconds to search for ICY metadata if icyMetaInt isn't passed in
  * Set to `0` to disable metadata detection

### Callbacks
* `onStats(stats)` (optional)
  * Called when the automatic stats query is completed with the stats returned.
  * Example:
    ```javascript
    {
      icestats: {admin: "icemaster@localhost" …}
      icy: {StreamTitle: "Song name"}
      nextsongs: undefined
      ogg: undefined
      sevenhtml: [{…}]
      stats: undefined
    }
    ```
* `onStatsFetch([sources])` (optional)
  * Called when the automatic stats query is started.
  * Called with the array or sources that are being queried.
---

## Troubleshooting

### Debugging

#### Source Map

IcecastMetadataStats builds are supplied with a source map, which allows the minified code to be viewed as fully formatted code in a browser debugger.
* To enable the source map, simply copy `icecast-metadata-stats-0.1.12.min.js.map` located in the build folder of this project to the location along side `icecast-metadata-stats-0.1.12.min.js` in your website.
* The source map can be used to step through and debug the code as well as see the full variable names and file origin on stack traces if you are facing any issues.
