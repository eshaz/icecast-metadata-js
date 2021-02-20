# Icecast Metadata Player

Icecast Metadata Player is a simple to use Javascript class that plays an Icecast stream with real-time metadata updates.

  * Plays an Icecast stream using the Media Source Extensions API and HTML5 audio.
  * Pushes synchronized metadata updates taken from ICY metadata, or OGG metadata.
  * Available as an [NPM Package](https://www.npmjs.com/package/icecast-metadata-player) and as a file to include in a `<script>` tag.
    * See [Installing](#installing)

## Supported codecs:

* **MP3** `audio/mpeg`
* **AAC, AAC+, AAC-HE** `audio/aac`
* **FLAC, OPUS, Vorbis** `application/ogg`

*Media Source Extension support is expanded by wrapping the audio in the ISOBMFF (mp4) or WEBM containers using* [`mse-audio-wrapper`](https://github.com/eshaz/mse-audio-wrapper)

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

* [Installing](#installing)
* [Usage](#usage)
  * [ICY Metadata](#icy-metadata)
  * [OGG Metadata](#ogg-metadata)
  * [ICY and OGG Metadata](#icy-and-ogg-metadata)
  * [Playing a Stream](#playing-a-stream)
    * [Metadata](#metadata)
* [API](#api)
  * [Instantiating](#instantiating)
  * [Options](#options)
  * [Callbacks](#callbacks)
  * [Getters](#getters)
  * [Methods](#methods)
* [Troubleshooting](#troubleshooting)
  * [Debugging](#debugging)
  * [Error Messages](#error-messages)

See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

---

## Installing

### Install via [NPM](https://www.npmjs.com/package/icecast-metadata-player)
* `npm i icecast-metadata-player`

### Install as a standalone script
1. Download the <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-0.2.0.min.js" download>latest build</a>.
2. Include the file in a `<script>` tag in your html.
3. `IcecastMetadataReader` is made available as a global variable in your webpage to use wherever.

   **Example**

   ```
   <script src="icecast-metadata-player-0.2.0.min.js"></script>
   <script>
     const onMetadata = (metadata) => {
       document.getElementById("metadata").innerHTML = metadata.StreamTitle;
     };
     const player = 
       new IcecastMetadataPlayer(
         "https://dsmrad.io/stream/isics-all",
         { onMetadata }
       );
   </script>
   <body>
     <button onclick="player.play();"> Play </button>
     <button onclick="player.stop();"> Stop </button>
     <p> Now Playing: <span id="metadata"></span> </p>
   </body>
   ```
---

## Usage

* To use `IcecastMetadataPlayer`, create a new instance by passing in the stream endpoint, and the options object (optional). See the [Methods](#methods) section below for additional options.

   ```
   const player = new IcecastMetadataPlayer("https://stream.example.com", {
     onMetadata: (metadata) => {console.log(metadata)},
     ...options
   })
   ```
  IcecastMetadataPlayer supports reading ICY metadata, Ogg (Vorbis Comment) metadata, or both. Each section below describes how to instantiate `IcecastMetadataPlayer` to use these different metadata types.

  ### ICY Metadata

  * When reading ICY metadata, the client should be able to read the `Icy-MetaInt` header value on the response. If the CORS policy does not allow clients to read the `Icy-MetaInt` header, then `IcecastMetadataPlayer` will attempt to detect the metadata interval based on the incoming request data.

    ```
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.mp3", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy"]
      ...options
    })
    ```

  ### OGG Metadata

  * OGG (Vorbis Comment) metadata, if available, usually offers more detail than ICY metadata.

    ```
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.opus", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["ogg"]
      ...options
    })
    ```

  ### ICY and OGG Metadata

  * ICY and OGG metadata can both be read from the stream. Usually a stream will only have one or the other, but this option is possible if needed.

    ```
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.flac", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy", "ogg"]
      ...options
    })
    ```

### Playing a Stream

1. To begin playing a stream, call the `.play()` method on the instance.

    *Note:* IcecastMetadataPlayer will attempt to "fallback" on any CORS issues or Media Source API issues. See the [Troubleshooting](#troubleshooting) section for more details.

    ```
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.flac", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy"]
      ...options
    })

    player.play();
    ```

1. Metadata will be sent as soon as it is discovered via the `onMetadataEnqueue` and when the metadata is synchronized with the audio via the `onMetadata` callback. See the [Methods](#methods) section below for additional callbacks.
    
    #### Metadata
    ```
    { 
      StreamTitle: "The stream's title", // ICY
      StreamUrl: "The stream's url", //     ICY
      TITLE: "The stream's title", //       OGG
      ARTIST: "The stream's artist", //     OGG
      ALBUM: "The stream's album" //        OGG
    }
    ```

1. To stop playing the stream, call the `stop()` method on the instance.

    ```
    player.stop();
    ```

See the [HTML demos](https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo/public/html-demos/) for examples.

---

## API

### Instantiating

```
const player = new IcecastMetadataPlayer(endpoint, {
  audioElement,
  icyMetaInt,
  icyDetectionTimeout,
  metadataTypes,
  onStream,
  onMetadata,
  onMetadataEnqueue,
  onCodecUpdate
  onError
})
```
### Options
* `endpoint` (required)
  * HTTP(s) endpoint for the Icecast compatible stream.
* `audioElement` (optional) - **Default** `new Audio()`
  * HTML5 Audio Element to use to play the Icecast stream.
* `metadataTypes` (optional) - **Default** `["icy"]`
  * Array containing zero, one, or both metadata types to parse
  * Values:
    * `[]` - Will not parse metadata
    * `["icy"]` - **Default** Parse ICY metadata only 
    * `["ogg"]` - Parse OGG (vorbis comment) metadata only
    * `["icy", "ogg"]` - Parse both ICY and OGG metadata
* `icyMetaInt` (optional)
  * ICY Metadata interval read from `Icy-MetaInt` header in the response
* `icyDetectionTimeout` (optional)
  * Duration in milliseconds to search for ICY metadata if icyMetaInt isn't passed in
  * Set to `0` to disable metadata detection
  * default: `2000`

### Callbacks
* `onStream(streamData)` (optional)
  * Called when stream audio data is sent to the audio element.
* `onMetadata(metadata, timestampOffset, timestamp)` (optional)
  * Called when metadata is synchronized with the audio.
  * `metadata` ICY or Ogg metadata in an object of key value pairs
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time when is scheduled to be updated.
  * `timestamp` time when metadata was discovered on the stream.
* `onMetadataEnqueue(metadata, timestampOffset, timestamp)` (optional)
  * Called when metadata is discovered on the stream.
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time when is scheduled to be updated.
  * `timestamp` time when metadata was discovered on the stream.
* `onCodecUpdate({ ...codecInformation })` (optional)
  * Called with audio codec information whenever there is a change
  * Information such as `bitrate` and `samplingRate` are passed in as an object to this callback
  * **Only called when [`mse-audio-wrapper`](https://github.com/eshaz/mse-audio-wrapper) is being used to wrap the response in ISOBMFF or WEBM**
* `onError(message)` (optional)
  * Called when a fallback condition or error condition is met.

### Getters
* `player.audioElement`
  * Returns the HTML5 Audio element.
* `player.icyMetaInt`
  * Returns the ICY Metadata Interval of this instance.
* `player.metadataQueue`
  * Returns the array of `metadata` objects in FIFO order.
    ```
    [
      {
        metadata: { StreamTitle: "Title 1" },
        timestampOffset: 2.5,
        timestamp: 1
      },
      {
        metadata: { StreamTitle: "Title 2" },
        timestampOffset: 5,
        timestamp: 2
      }
    ]
    ```
* `player.playing`
  * Returns `true` if the IcecastMetadataPlayer is playing and `false` if it is not.

### Methods
* `player.play()`
  * Plays the Icecast Stream

* `player.stop()`
  * Stops playing the Icecast Stream

---

## Troubleshooting

### Debugging

#### Source Map

IcecastMetadataPlayer builds are supplied with a source map, which allows the minified code to be viewed as fully formatted code in a browser debugger.
* To enable the source map, simply copy `icecast-metadata-player-0.2.0.min.js.map` located in the build folder of this project to the location along side `icecast-metadata-player-0.2.0.min.js` in your website.
* The source map can be used to step through and debug the code as well as see the full variable names and file origin on stack traces if you are facing any issues.

### Error messages

> Passed in Icy-MetaInt is invalid. Attempting to detect ICY Metadata.

* The stream has been requested with ICY metadata, but the server did not respond with the `Icy-MetaInt` header. `IcecastMetadataPlayer` will attempt to detect the ICY metadata interval, and will timeout after a default of 2 seconds, or the value in milliseconds passed into the `icyDetectionTimeout` option.
* This warning could also be displayed if the stream was requested with ICY metadata, but it does not contain ICY metadata. In this case, the ICY detection should timeout and the stream should play without ICY metadata. Please update your code to no longer request ICY metadata.

> This stream is not an OGG stream. No OGG metadata will be returned.

* IcecastMetadataReader has `"ogg"` passed into the `metadataTypes` options, but the stream response is not an ogg stream. ICY metadata and the stream will work without issues. Please remove the `"ogg"` option to remove this warning.

> Network request failed, possibly due to a CORS issue. Trying again without ICY Metadata.

* A network error occurred while requesting the stream with the `Icy-MetaData: 1` header.
  * If you want ICY metadata, your CORS policy must allow this header to be requested. See [CORS Troubleshooting](https://github.com/eshaz/icecast-metadata-js#cors) for more information.
  * Additionally, attempting to access a HTTP from a HTTPS origin will be blocked by modern browsers

> Media Source Extensions API in your browser does not support `codec`, `audio/mp4; codec="codec"`

* The Media Source API in your browser does not support the audio codec of the Icecast stream. Metadata playback is currently not possible with this stream endpoint. This message should be followed up with the below message.

> Falling back to HTML5 audio with no metadata updates. See the console for details on the error.

* A general error occurred when playing the stream. IcecastMetadataPlayer should continue to play the stream, but there will be no metadata updates.
* This may be caused by lack of browser support for the Media Source API, which varies across platforms.