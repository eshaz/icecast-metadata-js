# Icecast Metadata Player

Icecast Metadata Player is a simple to use Javascript class that plays an Icecast stream with real-time metadata updates.

  * Plays an Icecast stream using the Media Source Extensions API and HTML5 audio.
  * Pushes synchronized metadata updates taken from ICY metadata and OGG metadata.
  * Seamless playback during network changes (i.e. Wifi to Cell network).
  * Small bundle size: *50KB minified, 17KB gziped*
  * Available as an [NPM Package](https://www.npmjs.com/package/icecast-metadata-player) and as a file to include in a `<script>` tag.
    * See [Installing](#installing)

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

## Supported codecs:
* **MP3** `audio/mpeg`, `audio/mp4`
* **AAC** `audio/aac`, `audio/mp4`
* **FLAC** `application/ogg`, `audio/mp4`
* **Opus** `application/ogg`, `audio/mp4`, `audio/webm`
* **Vorbis** `application/ogg`, `audio/webm`
* All other browser supported MediaSource and HTML5 Audio codecs

## Supported Browsers:
 * **Android, Chrome, Firefox, Opera** `audio/mpeg`, `audio/aac`, `application/ogg` (FLAC, Opus, Vorbis)
 * **iOS 12.4 and higher, Safari Desktop** `audio/mpeg`, `audio/aac`
   * *unsupported* `application/ogg` (FLAC, Opus, Vorbis)
 * [**Check your Browser Here**](https://eshaz.github.io/icecast-metadata-js/demo.html#supported-codecs)

*Media Source Extension support is expanded by wrapping the audio in the ISOBMFF (mp4) or WEBM containers using* [`mse-audio-wrapper`](https://github.com/eshaz/mse-audio-wrapper)



* [Installing](#installing)
* [Usage](#usage)
  * [ICY Metadata](#icy-metadata)
  * [OGG Metadata](#ogg-metadata)
  * [ICY and OGG Metadata](#icy-and-ogg-metadata)
  * [Playing a Stream](#playing-a-stream)
    * [Metadata](#metadata)
* [Reconnecting](#reconnecting)
  * [Reconnect Lifecycle](#reconnect-lifecycle)
  * [Seamless Audio Playback](#seamless-audio-playback)
* [API](#api)
  * [Methods](#methods)
  * [Getters](#getters)
* [Instantiating](#instantiating)
  * [Options](#options)
  * [Callbacks](#callbacks)
* [Troubleshooting](#troubleshooting)
  * [Debugging](#debugging)
  * [Error Messages](#error-messages)

---

## Installing

### Install via [NPM](https://www.npmjs.com/package/icecast-metadata-player)
* `npm i icecast-metadata-player`

  **Example**

  ```
  import IcecastMetadataPlayer from "icecast-metadata-player";

  const player = new IcecastMetadataPlayer(
    "https://dsmrad.io/stream/isics-all",
    { onMetadata: (metadata) => {console.log(metadata)} }
  );
  ```

### Install as a standalone script
1. Download the <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.1.3.min.js" download>latest build</a>.
2. Include the file in a `<script>` tag in your html.
3. `IcecastMetadataPlayer` is made available as a global variable in your webpage to use wherever.

   **Example**

   ```
   <script src="icecast-metadata-player-1.1.3.min.js"></script>
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

* To use `IcecastMetadataPlayer`, create a new instance by passing in the stream endpoint, and the options object (optional). See the [Options](#options) and [Callbacks](#callback) sections for more information.

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

    *Note:* IcecastMetadataPlayer will use either the MediaSource api or, if that is not available, HTML5 audio with a second request for metadata.

    ```
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.flac", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy"]
      ...options
    })

    player.play();
    ```

1. Metadata will be sent as soon as it is discovered via the `onMetadataEnqueue` callback and when the metadata is synchronized with the audio via the `onMetadata` callback. See the [Methods](#methods) section below for additional callbacks.
    
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

## Reconnecting

IcecastMetadataPlayer enables retry / reconnect logic by default. When a fetch or network error occurs, IcecastMetadataPlayer will attempt to recover by retrying the fetch request.

This allows for seamless audio playback when switching networks, (i.e. from a cell network to a Wifi network).

See [Retry Options](#Retry-Options) to configure or disable reconnects. 

### Reconnect Lifecycle:

1. The `error` / `onError` event will be fired indicating the issue that caused the retry process to start.
1. IcecastMetadataPlayer will retry the initial fetch request periodically using an exponential back-off strategy configurable in the `options` object.
   * Each retry attempt will fire a `retry` / `onRetry` event.
1. Retries will stop when either of the below conditions are met:
   * The fetch request succeeds. ***or***
   * The audio element is paused or `stop()` is called. ***or***
   * The audio element buffer is empty **and** the retry timeout is met.
1. When the retry is successful, a `streamstart` / `onStreamStart` event will be fired and the audio will restart playing from the new request.
1. When the retry times out, a `retrytimeout` / `onRetryTimeout` event will be fired and the stream will stop.

### Seamless audio playback:

The audio will continue to play until the buffer runs out while reconnecting. If the reconnect is successful before the buffer runs out, there will only be a minimal blip in playback after a network change.

To increase the amount of audio that is buffered by clients, increase the `<burst-size>` setting in your Icecast server.

---

## API

### Methods
* `player.play()` *async*
  * Plays the Icecast Stream
  * Resolves when the stream begins playing.

* `player.stop()` *async*
  * Stops playing the Icecast Stream
  * Resolves when the stream has stopped.

* `player.detachAudioElement()`
  * Removes all internal event listeners from the audio element
  * **Must be called if the audio element is going to be re-used outside of the current instance**

* `IcecastMetadataPlayer.canPlayType(mimeType)` *static*
  * Returns an object `{mediasource, html5}` containing a string value indicating if passed in mime-type can be played.
  * Follows the [HTML5MediaElement canPlayType()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType) API:
    * `""` - Cannot be played the codec
    * `"maybe"` - Might be able to play the codec
    * `"probably"` - Should be able to play the codec

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
* `player.state`
  * Returns the current state of the IcecastMetadataPlayer.
  * `"loading", "playing", "stopping", "stopped", "retrying"`

## Instantiating

You can create any number of instances of IcecastMetadataPlayer on your webpage.

**Each instance must have it's own audio element.**

```
const player_1 = new IcecastMetadataPlayer("https://example.com/stream_1", {
  ...options,
  ...callbacks
});

const player_2 = new IcecastMetadataPlayer("https://example.com/stream_2", {
  ...options,
  ...callbacks
})
```
### Options
* `endpoint` (required)
  * HTTP(s) endpoint for the Icecast compatible stream.
* `audioElement` (optional) - **Default** `new Audio()`
  * HTML5 Audio Element to use to play the Icecast stream.
* `enableLogging` (optional) **Default** `false`
  * Set to `true` to enable warning and error logging to the console

#### Retry Options
* `retryTimeout` (optional) - **Default** `30` seconds
  * Number of seconds to wait before giving up on retries
  * Retries are enabled by default, Set to `0` to disable retries
  * Retries will continue until this duration is met **AND** the audio buffer has been exhausted

  *(advanced retry logic)*
  * `retryDelayMin` (optional) - **Default** `0.5` seconds
    * Minimum number of seconds between retries (start of the   exponential back-off curve)
  * `retryDelayMax` (optional) - **Default** `2` seconds
    * Maximum number of seconds between retries (start of the   exponential back-off curve)
  * `retryDelayRate` (optional) - **Default** `0.1` i.e. 10%
    * Percentage of seconds to increment after each retry (how   quickly to increase the back-off)

#### Metadata Options
* `metadataTypes` (optional) - **Default** `["icy"]`
  * Array containing zero, one, or both metadata types to parse
  * Values:
    * `[]` - Will not parse metadata
    * `["icy"]` - **Default** Parse ICY metadata only 
    * `["ogg"]` - Parse OGG (vorbis comment) metadata only
    * `["icy", "ogg"]` - Parse both ICY and OGG metadata

  #### *Only used when `["icy"]` metadata type is enabled*
  * `icyMetaInt` (optional) **Default** *reads from the response header*
    * ICY Metadata interval read from `Icy-MetaInt` header in the response
  * `icyDetectionTimeout` (optional) **Default** `2000`
    * Duration in milliseconds to search for ICY metadata if icyMetaInt isn't passed in
    * Set to `0` to disable metadata detection

### Callbacks *(all optional)*

#### Metadata
* `onMetadata(metadata, timestampOffset, timestamp)` Called when metadata is synchronized with the audio.
  * `metadata` ICY or Ogg metadata in an object of key value pairs
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time when is scheduled to be updated.
  * `timestamp` time when metadata was discovered on the stream.
* `onMetadataEnqueue(metadata, timestampOffset, timestamp)` Called when metadata is discovered on the stream.
  * `metadata` ICY or Ogg metadata in an object of key value pairs
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time when is scheduled to be updated.
  * `timestamp` time when metadata was discovered on the stream.

#### Stream lifecycle
* `onLoad()` Called when the fetch request is started.
* `onStreamStart()` Called when fetch request begins to return data.
* `onPlay()` Called when the audio element begins playing.
* `onStream(streamData)` Called when stream data is sent to the audio element.
* `onStreamEnd()` Called when the fetch request completes.
* `onStop()` Called when the stream is completely stopped and all cleanup operations are complete.

#### Reconnects
* `onRetry()` Called when a retry / reconnect is attempted.
* `onRetryTimeout()` Called when the retry / reconnect attempts have stopped because they have timed-out.

#### Error / Warning
* `onWarn(message, ...messages)` Called with message(s) when a warning condition is met.
* `onError(message, ...messages)` Called with message(s) when a fallback or error condition is met.

#### Informational
* `onCodecUpdate({ ...codecInformation })` Called with audio codec information whenever there is a change
  * Information such as `bitrate` and `samplingRate` are passed in as an object to this callback
  * **Only called when [`mse-audio-wrapper`](https://github.com/eshaz/mse-audio-wrapper) is being used to wrap the response in ISOBMFF or WEBM**

### Events

Each callback is made available as an event. The parameters for each callback are passed into `event.details` as an array.

```
player.addEventListener('metadata', (event) => {
  const [metadata, timestampOffset, timestamp] = event.details;
})
```

---

## Troubleshooting

### Debugging

#### Source Map

IcecastMetadataPlayer builds are supplied with a source map, which allows the minified code to be viewed as fully formatted code in a browser debugger.
* To enable the source map, simply copy `icecast-metadata-player-1.1.3.min.js.map` located in the build folder of this project to the location along side `icecast-metadata-player-1.1.3.min.js` in your website.
* The source map can be used to step through and debug the code as well as see the full variable names and file origin on stack traces if you are facing any issues.

### Error messages

> Passed in Icy-MetaInt is invalid. Attempting to detect ICY Metadata.

* The stream has been requested with ICY metadata, but the server did not respond with the `Icy-MetaInt` header. `IcecastMetadataPlayer` will attempt to detect the ICY metadata interval, and will timeout after a default of 2 seconds, or the value in milliseconds passed into the `icyDetectionTimeout` option.
* If your stream contains ICY metadata, and it is not detected, audio errors will occur. Increase the detection timeout to search longer for ICY metadata.
* This warning could also be displayed if the stream was requested with ICY metadata, but it does not contain ICY metadata. In this case, the ICY detection will timeout and the stream will play without ICY metadata. Please update your code to no longer request ICY metadata.

> This stream is not an OGG stream. No OGG metadata will be returned.

* IcecastMetadataPlayer has `"ogg"` passed into the `metadataTypes` options, but the stream response is not an ogg stream. ICY metadata and the stream will work without issues. Please remove the `"ogg"` option to remove this warning.

> This stream was requested with ICY metadata. If there is a CORS preflight failure, try removing "icy" from the metadataTypes option.

* A network error occurred while requesting the stream with the `Icy-MetaData: 1` header.
  * IcecastMetadataPlayer will attempt to retry the request using the retry configuration.
  * It's possible that this was caused by the Icecast server's CORS policy not allowing the `Icy-Metadata` header. If you want ICY metadata, your CORS policy must allow this header to be requested. See [CORS Troubleshooting](https://github.com/eshaz/icecast-metadata-js#cors) for more information.
  * Additionally, attempting to access a HTTP from a HTTPS origin will be blocked by modern browsers

> Media Source Extensions API in your browser is not supported. Using two requests, one for audio, and another for metadata.

* Your browser doesn't support the Media Source API extensions. IcecastMetadataPlayer will use one request for audio through HTML5 audio, and another request to read the metadata. Both requests will be synchronized for real-time metadata updates.

> Media Source Extensions API in your browser does not support `codec`, `audio/mp4; codec="codec"`

* The Media Source API in your browser does not support the audio codec of the Icecast stream. This message should be followed up with the below message.

> Falling back to HTML5 audio by using two requests: one for audio, and another for metadata. See the console for details on the error.

* A general error occurred while playing the stream. This is likely due to an issue with the MediaSource api. The stream should recover using HTML5 audio and another request for real-time metadata.

> The audio element encountered an error

* An error occurred while the browser was playing or decoding the audio. This may occur if your browser doesn't support a codec.
