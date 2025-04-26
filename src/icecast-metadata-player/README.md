# Icecast Metadata Player

Icecast Metadata Player is browser library that plays streaming audio with full cross-platform codec support and real-time metadata updates.

  * Plays streaming audio using [Media Source Extensions API](https://github.com/eshaz/mse-audio-wrapper), [Web Assembly audio decoders](https://github.com/eshaz/wasm-audio-decoders), and HTML5 audio.
  * Provides synchronized ICY metadata and Ogg metadata updates.
  * Seamless playback during network changes (i.e. Wifi to Cell network).
  * Seamlessly switch between endpoints during playback (i.e. moving between load balanced streams, or streams with different codecs).
  * Lazy loading of dependencies for faster and more efficient load times.
  * Available as an [NPM Package](https://www.npmjs.com/package/icecast-metadata-player) and as a file to include in a `<script>` tag.
    * See [Installing](#installing)

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

## Supported codecs:
* **MP3** `audio/mpeg`, `audio/mp4`
* **AAC** `audio/aac`, `audio/mp4`
* **FLAC** `audio/flac, application/ogg`, `audio/mp4`
* **Opus** `application/ogg`, `audio/mp4`, `audio/webm`
* **Vorbis** `application/ogg`, `audio/webm`

## Supported Browsers:
 * **All major browsers** (Chrome, Firefox, Opera, Android, iOS 12.4 and higher, Safari Desktop)
 * [**Check your Browser Here**](https://eshaz.github.io/icecast-metadata-js/demo.html#supported-codecs)

---

## Contents

* [Installing](#installing)
* [Usage](#usage)
  * [ICY Metadata](#icy-metadata)
  * [Ogg Metadata](#ogg-metadata)
  * [ICY and Ogg Metadata](#icy-and-ogg-metadata)
  * [Playing a Stream](#playing-a-stream)
    * [Metadata](#metadata)
* [Reconnecting](#reconnecting)
  * [Reconnect Lifecycle](#reconnect-lifecycle)
  * [Seamless Audio Playback](#seamless-audio-playback)
* [Switching Endpoints](#switching-endpoints)
  * [switchEndpoint Lifecycle](#switchendpoint-lifecycle)
* [API](#api)
  * [Methods](#methods)
  * [Getters](#getters)
* [Instantiating](#instantiating)
  * [Options](#options)
  * [Callbacks](#callbacks-all-optional)
* [Troubleshooting](#troubleshooting)
  * [Debugging](#debugging)
  * [Warning Messages](#warning-messages)
  * [Error Messages](#error-messages)

---

## Installing

### Install via [NPM](https://www.npmjs.com/package/icecast-metadata-player)
* `npm i icecast-metadata-player`

  **Example**

  ```javascript
  import IcecastMetadataPlayer from "icecast-metadata-player";

  const player = new IcecastMetadataPlayer(
    "https://dsmrad.io/stream/isics-all",
    { onMetadata: (metadata) => {console.log(metadata)} }
  );
  ```

### Install as a standalone script
1. Download all of the files <a href="https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player/build">here</a> for the latest build and save these to a path on your server.
   * Each module is automatically downloaded to the browser as needed.
   * **All `*.js` files must be saved into the same path on your server.**
   * The `*.js.map` files are optional source maps for debugging.
     | Filename | Functionality |
     | - | - |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.main.min.js" download>`icecast-metadata-player-1.17.10.main.min.js`</a> | Core functionality (playback, metadata) <br> **Use this file in your `<script>` tag** |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.synaudio.min.js" download>`icecast-metadata-player-1.17.10.synaudio.min.js`</a> | Gapless playback support |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.mediasource.min.js" download>`icecast-metadata-player-1.17.10.mediasource.min.js`</a> | Mediasource playback support |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.mpeg.min.js" download>`icecast-metadata-player-1.17.10.mpeg.min.js`</a> | MPEG playback support (webaudio) |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.flac.min.js" download>`icecast-metadata-player-1.17.10.flac.min.js`</a> | FLAC playback support (webaudio) |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.opus.min.js" download>`icecast-metadata-player-1.17.10.opus.min.js`</a> | Opus playback support (webaudio) |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.vorbis.min.js" download>`icecast-metadata-player-1.17.10.vorbis.min.js`</a> | Vorbis playback support (webaudio) |
     | <a href="https://raw.githubusercontent.com/eshaz/icecast-metadata-js/master/src/icecast-metadata-player/build/icecast-metadata-player-1.17.10.common.min.js" download>`icecast-metadata-player-1.17.10.common.min.js`</a> | Common functions (webaudio) |
2. Add a `<script>` tag referencing `icecast-metadata-player-1.17.10.main.min.js` in your html.
3. `IcecastMetadataPlayer` is made available as a global variable in your webpage to use wherever.

   **Example**

   ```html
   <script src="icecast-metadata-player-1.17.10.main.min.js"></script>
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

   ```javascript
   const player = new IcecastMetadataPlayer("https://stream.example.com", {
     onMetadata: (metadata) => {console.log(metadata)},
     ...options
   })
   ```
  IcecastMetadataPlayer supports reading ICY metadata, Ogg (Vorbis Comment) metadata, or both. Each section below describes how to instantiate `IcecastMetadataPlayer` to use these different metadata types.

  ### ICY Metadata

  * When reading ICY metadata, the client should be able to read the `Icy-MetaInt` header value on the response. If the CORS policy does not allow clients to read the `Icy-MetaInt` header, then `IcecastMetadataPlayer` will attempt to detect the metadata interval based on the incoming request data.

    ```javascript
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.mp3", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy"]
      ...options
    })
    ```

  ### Ogg Metadata

  * Ogg (Vorbis Comment) metadata, if available, usually offers more detail than ICY metadata.

    ```javascript
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.opus", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["ogg"]
      ...options
    })
    ```

  ### ICY and Ogg Metadata

  * ICY and Ogg metadata can both be read from the stream. Usually a stream will only have one or the other, but this option is possible if needed.

    ```javascript
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.flac", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy", "ogg"]
      ...options
    })
    ```

### Playing a Stream

1. To begin playing a stream, call the `.play()` method on the instance.

    *Note:* IcecastMetadataPlayer will use either the MediaSource api or, if that is not available, HTML5 audio with a second request for metadata.

    ```javascript
    const player = new IcecastMetadataPlayer("https://stream.example.com/stream.flac", {
      onMetadata: (metadata) => {console.log(metadata)},
      metadataTypes: ["icy"]
      ...options
    })

    player.play();
    ```

1. Metadata will be sent as soon as it is discovered via the `onMetadataEnqueue` callback and when the metadata is synchronized with the audio via the `onMetadata` callback. See the [Methods](#methods) section below for additional callbacks.
    
    #### Metadata
    ```javascript
    { 
      StreamTitle: "The stream's title", // ICY
      StreamUrl: "The stream's url", //     ICY
      TITLE: "The stream's title", //       Ogg
      ARTIST: "The stream's artist", //     Ogg
      ALBUM: "The stream's album" //        Ogg
    }
    ```

1. To stop playing the stream, call the `stop()` method on the instance.

    ```javascript
    player.stop();
    ```

See the [HTML demos](https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo/public/html-demos/) for examples.

## Reconnecting

IcecastMetadataPlayer enables retry / reconnect logic by default. When a fetch or network error occurs, IcecastMetadataPlayer will attempt to recover by retrying the fetch request.

This allows for seamless audio playback when switching networks, (i.e. from a cell network to a Wifi network).

See [Retry Options](#Retry-Options) to configure or disable reconnects. 

### Reconnect Lifecycle:

1. The `error` / `onError` event will be fired indicating the issue that caused the retry process to start.
1. IcecastMetadataPlayer will try to fetch the next stream endpoint periodically using an exponential back-off strategy configurable in the `options` object.
   * Each retry attempt will select the next stream endpoint when a list of stream endpoints are provided. These may be selected in the order they are provided, or in random order. See [options.endpointOrder](#options).
   * Each retry attempt will fire a `retry` / `onRetry` event.
1. Retries will stop when either of the below conditions are met:
   * The fetch request succeeds.
   * The audio element is paused / `stop()` is called.
   * The audio element buffer is empty **and** the retry timeout is met.
1. When the retry is successful, a `streamstart` / `onStreamStart` event will be fired and the audio will restart playing from the new request.
   * When using the MediaSource API, the old and new request will be synchronized together on a frame basis for seamless playback.
1. When the retry times out, a `retrytimeout` / `onRetryTimeout` event will be fired and the stream will stop.

### Seamless audio playback:

The audio will continue to play until the buffer runs out while reconnecting. If the reconnect is successful before the buffer runs out, there will be no gap in playback.

To increase the amount of audio that is buffered by clients, increase the `<burst-size>` setting in your Icecast server.

## Switching Endpoints

IcecastMetadataPlayer enables the stream endpoint to be switched during playback to any new endpoint by calling `switchEndpoint`.

The next endpoint will fetched and attempted to be synchronized with playback from the previous endpoint. The next endpoint is selected from either from the current list of endpoints, or the new passed in list. The transition from the old to new stream should be seamless using synchronization logic that first attempts to match the frame data exactly using CRC32 hashes, and if there is no exact match, by synchronizing the PCM streams using cross-correlation.

### `switchEndpoint` lifecycle

1. The old endpoint network request is aborted; however, any buffered audio will continue to play.
1. The new endpoint network request is started.
1. Playback will attempt to be synchronized with the next endpoint audio using two methods:
   * **CRC Syncing** If the data is an exact match between the old and new endpoints, the stream will be synchronized using CRC32 hashes of each codec frame and playback will continue seamlessly from the new endpoint.
     * See [codec-parser](https://github.com/eshaz/codec-parser) for the library that enables CRC syncing.
   * **PCM Syncing** If the data does not match, both the old and new audio data will be decoded to PCM and synchronized using a correlation algorithm. The correlation coefficient (-100% worst to 100% best) will be printed to the console if `enableLogging` is set to `true`.
     * See [synaudio](https://github.com/eshaz/synaudio) for the library that enables PCM syncing.
1. Once the new stream is synchronized, playback will begin from the new stream.
   * If the buffered audio runs out during synchronization, the new stream will begin to play immediately to prevent any gaps in playback.

---

## API

### Methods
* `player.play()` *async*
  * Plays the Icecast Stream.
  * Resolves when the stream begins playing.

* `player.stop()` *async*
  * Stops playing the Icecast Stream.
  * Resolves when the stream has stopped.

* `player.switchEndpoint(endpoints, options)` *async*
  * Switches to a new stream endpoint and synchronizes the old and new audio.
    * See [Switching Endpoints](#switching-endpoints) for more details. This is meant to be used when switching between streams containing the same audio.
  * `endpoints` *optional* Single URL or Array of URLs for the new stream endpoint(s). When left empty, and when multiple stream endpoints are present on the instance, the next URL will be selected.
  * `options` *optional* Object containing any new options to apply to the instance. All options are allowed except callbacks and the audio element. See [options](#options) for more details.

* `player.detachAudioElement()`
  * Removes all internal event listeners from the audio element
  * Stops audio playback
  * **Must be called if the audio element is going to be re-used outside of the current instance**

* `IcecastMetadataPlayer.canPlayType(mimeType)` *static*
  * Returns an object `{mediasource, html5, webaudio}` containing a string value indicating if passed in mime-type can be played.
  * Follows the [HTML5MediaElement canPlayType()](https://developer.mozilla.org/en-US/docs/Web/API/HTMLMediaElement/canPlayType) API:
    * `""` - Cannot play the codec
    * `"maybe"` - Might be able to play the codec
    * `"probably"` - Should be able to play the codec

### Getters
* `player.audioElement`
  * Returns the HTML5 Audio element.
* `player.endpoint`
  * Returns the current endpoint being played.
* `player.icyMetaInt`
  * Returns the ICY Metadata Interval of this instance.
* `player.metadataQueue`
  * Returns the array of enqueued `metadata` in FIFO order.
    ```javascript
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
* `player.playbackMethod`
  * Returns the playback method in use to play the stream.
  * The playback method is chosen after the codec of the incoming stream is determined.
  * `"mediasource", "webaudio", "html5"`

## Instantiating

You can create any number of instances of IcecastMetadataPlayer on your webpage.

**Each instance must have it's own audio element.**

```javascript
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
* `endpoints` (required)
  * HTTP(s) endpoint or array of endpoints for the Icecast compatible stream.
  * Multiple endpoints can be passed in for client side load balancing or failover.
* `endpointOrder` (optional) - **default** `ordered`
  * Order to select each endpoint when multiple endpoints are passed in.
  * Set to `ordered` to select each endpoint in the order they were provided.
  * Set to `random` to select each endpoint in random order.
* `audioElement` (optional) - **Default** `new Audio()`
  * HTML5 Audio Element to use to play the Icecast stream.
* `bufferLength` (optional) - **Default** `1`
  * Sets the number of seconds to buffer before starting playback
* `enableLogging` (optional) **Default** `false`
  * Set to `true` to enable warning and error logging to the console
* `enableCodecUpdate` (optional) **Default** `false`
  * Set to `true` to enable the `codecupdate` event.
  * Codec updates are always enabled if the `onCodecUpdate` callback is present.
* `playbackMethod` (optional) **Default** `mediasource`
  * Sets the preferred playback method. `"mediasource", "webaudio", "html5"`
  * IcecastMetadataPlayer will attempt to use this playback method first before other methods.
  * The playback method is automatically chosen depending on browser support for the codec of the Icecast stream.
* `authentication` (optional) **Default** *disabled*
  * When supplied, sets the user and password to use when connecting to an authenticated stream.
  * This sets the `Authorization` header in the HTTP request using basic auth.
  * Example `{user: 'myuser', password: 'mypassword'}`

#### Retry Options
* `retryTimeout` (optional) - **Default** `30` seconds
  * Number of seconds to wait before giving up on retries
  * Retries are enabled by default, Set to `0` to disable retries
  * Retries will continue until this duration is met **AND** the audio buffer has been exhausted

  *(advanced retry logic)*
  * `retryDelayMin` (optional) - **Default** `0.5` seconds
    * Minimum number of seconds between retries (start of the exponential back-off curve)
  * `retryDelayMax` (optional) - **Default** `2` seconds
    * Maximum number of seconds between retries (end of the exponential back-off curve)
  * `retryDelayRate` (optional) - **Default** `0.1` i.e. 10%
    * Percentage of seconds to increment after each retry (how quickly to increase the back-off)

#### Metadata Options
* `metadataTypes` (optional) - **Default** `["icy"]`
  * Array containing zero, one, or both metadata types to parse
  * Values:
    * `[]` - Will not parse metadata
    * `["icy"]` - **Default** Parse ICY metadata only 
    * `["ogg"]` - Parse Ogg (vorbis comment) metadata only
    * `["icy", "ogg"]` - Parse both ICY and Ogg metadata

  #### *Only used when `["icy"]` metadata type is enabled*
  * `icyMetaInt` (optional) **Default** *reads from the response header*
    * ICY Metadata interval read from `Icy-MetaInt` header in the response
  * `icyCharacterEncoding` (optional) **Default** `"uft-8"`
    * Sets the character encoding of the ICY metadata. Most Icecast servers use `utf-8`, but encodings such as `iso-8859-2` are also used.
    * See [Encoding API Encodings](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for a complete   list of character encodings
  * `icyDetectionTimeout` (optional) **Default** `2000`
    * Duration in milliseconds to search for ICY metadata if icyMetaInt isn't passed in
    * Set to `0` to disable metadata detection

### Callbacks *(all optional)*

#### Metadata
* `onMetadata(metadata, timestampOffset, timestamp)` Called when metadata is synchronized with the audio.
  * `metadata` ICY or Ogg metadata in an object of key value pairs
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time in seconds when is scheduled to be updated.
  * `timestamp` time in seconds when metadata was discovered on the stream.
* `onMetadataEnqueue(metadata, timestampOffset, timestamp)` Called when metadata is discovered on the stream.
  * `metadata` ICY or Ogg metadata in an object of key value pairs
    * ICY: `{ "StreamTitle: "The Stream Title" }`
    * Ogg: `{ "TITLE: "The Stream Title", "ARTIST": "Artist 1; Artist 2"... }`
  * `timestampOffset` time in seconds when is scheduled to be updated.
  * `timestamp` time in seconds when metadata was discovered on the stream.

#### Stream lifecycle
* `onLoad()` Called when the fetch request is started.
* `onStreamStart()` Called when fetch request begins to return data.
* `onBuffer(time)` Called when the audio buffer is being filled.
* `onPlay()` Called when the audio element begins playing.
* `onStream(streamData)` Called when stream data is sent to the audio element.
* `onStreamEnd()` Called when the fetch request completes.
* `onStop()` Called when the stream is completely stopped and all cleanup operations are complete.

#### Reconnects
* `onRetry()` Called when a retry / reconnect is attempted.
* `onRetryTimeout()` Called when the retry / reconnect attempts have stopped because they have timed-out.

#### Error / Warning
* `onWarn(message, ...messages)` Called with message(s) when a warning condition is met.
* `onError(message, error)` Called with a message and an Error object when an exception occurs when a fallback or error condition is met.

#### Informational
* `onCodecUpdate(codecInformation, updateTimestamp)` Called with audio codec information whenever there is a change. This callback is synchronized with the audio.
  * `codecInformation` such as `bitrate` and `samplingRate` are passed in as an object
  * `updateTimestamp` is the time in seconds within the audio stream when the codec information was updated

### Events

Each callback is made available as an event. The parameters for each callback are passed into `event.details` as an array.

```javascript
player.addEventListener('metadata', (event) => {
  const [metadata, timestampOffset, timestamp] = event.detail;
})
```

---

## Troubleshooting

### Debugging

#### Source Map

IcecastMetadataPlayer builds are supplied with a source map, which allows the minified code to be viewed as fully formatted code in a browser debugger.
* To enable the source map, simply copy `icecast-metadata-player-1.17.10.min.js.map` located in the build folder of this project to the location along side `icecast-metadata-player-1.17.10.min.js` in your website.
* The source map can be used to step through and debug the code as well as see the full variable names and file origin on stack traces if you are facing any issues.

### Common Issues

> ICY Metadata has incorrect characters such as "Zanzibar - Sz�lj M�r" when it should be "Zanzibar - Szólj Már"

* Try setting the `icyCharacterEncoding` option to match the character encoding of the metadata.
* A common ICY metadtata encoding other than `utf-8` is `iso-8859-2`

> I have an authenticated stream, and when I supply credentials in the `authentication` option, I get a CORS error.

* Ensure your Icecast server or your proxy has `Authorization` listed in the `Access-Control-Allow-Headers` header when it responses to the CORS `OPTIONS` request.
* Example: `Access-Control-Allow-Headers: Origin, Icy-MetaData, Range, Authorization`

### Warning messages

*Note: Warning messages are be enabled by setting `options.enableLogging = true`*

> Reconnected successfully after retry event. Found 145 frames (3.788 seconds) of overlapping audio data in new request. Synchronized old and new request.

* The stream successfully reconnected after a disconnect, and the old request was synchronized with the new request for seamless playback.
* This usually happens when switching networks, or if there was a brief interruption in your internet connection. (i.e. cell to WiFi, WiFi to ethernet, temporary loss of cell connection, etc.)

> Reconnected successfully after retry event. Found no overlapping frames from previous request. Unable to sync old and new request.

* The stream successfully reconnected after a disconnect, but there wasn't enough data in the buffer to synchronize the old request with new request.
* If this happens frequently, try increasing the [`burst-size` option](https://www.icecast.org/docs/icecast-trunk/config_file/#limits) (or equivalent) in your Icecast configuration to increase the client's buffered data.

> Passed in Icy-MetaInt is invalid. Attempting to detect ICY Metadata.

* The stream has been requested with ICY metadata, but the server did not respond with the `Icy-MetaInt` header. `IcecastMetadataPlayer` will attempt to detect the ICY metadata interval, and will timeout after a default of 2 seconds, or the value in milliseconds passed into the `icyDetectionTimeout` option.
* If your stream contains ICY metadata, and it is not detected, audio errors will occur. Increase the detection timeout to search longer for ICY metadata.
* This warning could also be displayed if the stream was requested with ICY metadata, but it does not contain ICY metadata. In this case, the ICY detection will timeout and the stream will play without ICY metadata. Please update your code to no longer request ICY metadata.

> This stream is not an Ogg stream. No Ogg metadata will be returned.

* IcecastMetadataPlayer has `"ogg"` passed into the `metadataTypes` options, but the stream response is not an ogg stream. ICY metadata and the stream will work without issues. Please remove the `"ogg"` option to remove this warning.

### Error messages

> This stream was requested with ICY metadata. If there is a CORS preflight failure, try removing "icy" from the metadataTypes option.

* A network error occurred while requesting the stream with the `Icy-MetaData: 1` header.
  * IcecastMetadataPlayer will attempt to retry the request using the retry configuration.
  * It's possible that this was caused by the Icecast server's CORS policy not allowing the `Icy-Metadata` header. If you want ICY metadata, your CORS policy must allow this header to be requested. See [CORS Troubleshooting](https://github.com/eshaz/icecast-metadata-js#cors) for more information.
  * Additionally, attempting to access a HTTP from a HTTPS origin will be blocked by modern browsers

> Your browser does not support this audio codec *mime-type*

> Unsupported Codec *mime-type*

* No playback methods are able to play the audio codec being streamed from the Icecast stream. Check the URL that was passed in. If the URL is correct, this stream cannot be played on your browser.

> The audio element encountered an error

* An error occurred while the browser was playing or decoding the audio. This may occur if your browser doesn't support a codec or if there is a problem with the Icecast stream.

> NotAllowedError: The play method is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.

> NotAllowedError: play() failed because the user didn't interact with the document first. https://goo.gl/xX8pDD

* This error occurs when attempting to call `play()` without it being triggered by a user interaction on the web page. See [#107](https://github.com/eshaz/icecast-metadata-js/issues/107) and this [guide](https://developer.mozilla.org/en-US/docs/Web/Media/Autoplay_guide) for more information.
