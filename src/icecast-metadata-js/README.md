# Icecast Metadata JS

Icecast Metadata JS is javascript (client-side and NodeJS) library that takes in an Icecast response body, extracts audio data and metadata, and schedules metadata events.

## Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

* [`IcecastMetadataReader`](#icecastmetadatareader)
  * Gets stream data and metadata from a raw Icecast response
  * Supports ICY and Ogg (Vorbis Comment) metadata
* [`IcecastMetadataQueue`](#icecastmetadataqueue)
  * Queues metadata and schedules metadata updates
* [`IcecastMetadataStream`](#icecastmetadatastream)
  * NodeJS streams wrapper for IcecastMetadataReader
* [`IcecastReadableStream`](#icecastreadablestream)
  * Browser and NodeJS ReadableStream wrapper for IcecastMetadataReader


See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

## Installing

icecast-metadata-js is avaiable on [NPM](https://www.npmjs.com/package/icecast-metadata-js). 

* Run `npm i icecast-metadata-js` in the same diretory as your `package.json` file to install it.
* Once icecast-metadata-js is installed, you can import each module listed above.
  * ES6 import (browser): `import { IcecastMetadataReader } from ("icecast-metadata-js");`
  * CommonJS require (NodeJS): `const { IcecastMetadataReader } = require("icecast-metadata-js");`

---

## `IcecastMetadataReader`

A generator that takes in raw icecast response data and return stream data and metadata. 

### Instantiating

* To use `IcecastMetadataReader`, create a new instance and pass in the optional `onStream` and `onMetadata` callbacks. With no other options, `IcecastMetadataReader` will default to reading only ICY metadata.

   ```javascript
   import { IcecastMetadataReader } from ("icecast-metadata-js");

   const icecastReader = new IcecastMetadataReader({
     onStream: (value) => {
       // do something with the data in value.stream
     },
     onMetadata: (value) => {
       // do something with the data in value.metadata
     };,
   });
   ```
  IcecastMetadataReader supports reading ICY metadata, Ogg (Vorbis Comment) metadata, or both. Each section below describes how to instantiate `IcecastMetadataReader` to use these different metadata types.

  ### ICY Metadata

  * When reading ICY metadata, it is preferable, but not required, to pass in the `Icy-MetaInt` into the constructor of `IcecastMetadataReaader`. If `icyMetaInt` is falsy, for example if the CORS policy does not allow clients to read the `Icy-MetaInt` header, then `IcecastMetadataReader` will attempt to detect the metadata interval based on the incoming request data.

    ```javascript
    const headers = myHTTPResponse.headers;
    
    const icecastReader = new IcecastMetadataReader({
      onStream,
      onMetadata,
      onError,
      enableLogging: true,
      metadataTypes: ["icy"]
      icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
    });
    ```

  ### Ogg Metadata

  * Ogg (Vorbis Comment) metadata, if available, usually offers more detail than ICY metadata.

    ```javascript
    const icecastReader = new IcecastMetadataReader({
      onStream,
      onMetadata,
      metadataTypes: ["ogg"]
    });
    ```

  ### ICY and Ogg Metadata

  * ICY and Ogg metadata can both be read from the stream. Usually a stream will only have one or the other, but this option is possible if needed.

    ```javascript
    const icecastReader = new IcecastMetadataReader({
      metadataTypes: ["icy", "ogg"]
    });
    ```

### Usage

1. To begin reading stream data and metadata, pass in the raw response into the instance's `.iterator()` or `.asyncIterator()`. Iterate over this iterator using a `for ...of` or `for await...of` loop.

    ```javascript
    const responseData = response.body;
    
    for (const i of icecastReader.iterator(responseData)) {
      if (i.stream) {
        // do something with stream data
      }
      if (i.metadata) {
        // do something with metadata
      }
    }
    ```
 
    Each iteration will return an object containing either `stream` or `metadata`
    
    #### `stream`
    ```
    { 
      value: {
        stream: Uint8Array, // stream bytes
        stats: {
          totalBytesRead: number, // total bytes read
          streamBytesRead: number, // total stream bytes read
          metadataLengthBytesRead: number, // total metadata length bytes read
          metadataBytesRead: number, // total metadata bytes read
          currentBytesRemaining: number, // bytes remaining in the current iteration
          currentStreamBytesRemaining: number, // stream bytes remaining
          currentMetadataBytesRemaining: number, // metadata bytes remaining
        }
      },
      done: false
    }
    ```
    
    #### `metadata`
    ```
    {
      value: {
        metadata: {
          StreamTitle: "The stream's title",
          ... // key value pairs of metadata
        },
        stats: {
          totalBytesRead: number, // total bytes read
          streamBytesRead: number, // total stream bytes read
          metadataLengthBytesRead: number, // total metadata length bytes read
          metadataBytesRead: number, // total metadata bytes read
          currentBytesRemaining: number, // bytes remaining in the current iteration
          currentStreamBytesRemaining: number, // stream bytes remaining
          currentMetadataBytesRemaining: number, // metadata bytes remaining
        }
      },
      done: false
    }
    ```

1. The iteration will complete once all of the response data is parsed. When more raw data is available, repeat the steps above to continue parsing the data.

**Note: Stream data is always returned immediately when it is discovered in the raw response. Metadata is stored within the IcecastMetadataReader until a full chunk of metadata can be parsed and returned. The IcecastMetadataReader also internally tracks the metadata interval to properly return metadata. If you are reading a continuous stream of raw response data, be sure to use the same instance of the IcecastMetadataReader.**

```javascript
const options = {
  metadataTypes: ["icy"],
  icyCharacterEncoding: "utf-8",
  icyMetaInt: 16000,
  icyDetectionTimeout: 2000,
  enableLogging: false,
  onStream: () => {},
  onMetadata: () => {},
  onError: () => {}
}
```

### Options

* `metadataTypes`
  * Array containing zero, one, or both metadata types to parse
  * Values:
    * `[]` - Will not parse metadata
    * `["icy"]` - Parse ICY metadata only
    * `["ogg"]` - Parse Ogg (vorbis comment) metadata only
    * `["icy", "ogg"]` - Parse both ICY and Ogg metadata
  * default: `["icy"]`
* `enableLogging`
  * Set to `true` to enable console warnings
  * default: `false`

#### *Only used when `["icy"]` metadata type is enabled*
* `icyMetaInt`
  * ICY Metadata interval read from `Icy-MetaInt` header in the response
* `icyCharacterEncoding`
  * Sets the character encoding of the ICY metadata. Most Icecast servers use `utf-8`, but encodings such as `iso-8859-2` are also used.
  * See [Encoding API Encodings](https://developer.mozilla.org/en-US/docs/Web/API/Encoding_API/Encodings) for a complete list of character encodings.
  * default: `"utf-8"`
* `icyDetectionTimeout`
  * Duration in milliseconds to search for ICY metadata if icyMetaInt isn't passed in
  * Set to `0` to disable metadata detection
  * default: `2000`

### Callbacks
* `onStream`
  * Async callback when stream data is returned
* `onMetadata`
  * Async callback when stream data is returned
* `onMetadataFailed(metadataType)`
  * Callback when there was a problem detecting metadata. Metadata will not be returned after this function is called.
  * Parameters `"icy"` or `"ogg"`
* `onError(message)`
  * Callback when a warning / error occurs

```javascript
const icecastReader = 
  new IcecastMetadataReader(options);
```

### Methods
* `icecastReader.iterator(data: Uint8Array)`
  * Takes in a byte array of raw icecast response body
  * Returns an Iterator that can be used in a `for ...of` loop to read stream or metadata
  * `onStream` is called when stream is read
  * `onMetadata` is called when metadata is read
* `icecastReader.asyncIterator(data: Uint8Array)`
  * Takes in a byte array of raw icecast response body
  * Returns an AsyncIterator that can be used in a `for await...of` loop to read stream or metadata
  * Iteration will pause until the `onStream` and `onMetadata` resolve.
  * `onStream` is called and awaited when stream is read
  * `onMetadata` is called and awaited when metadata is read
* `icecastReader.readAll(data: Uint8Array)`
  * Takes in a byte array of raw icecast response body and parses the data.
  * `onStream` is called when stream is read
  * `onMetadata` is called when metadata is read
* `icecastReader.asyncReadAll(data: Uint8Array)`
  * Takes in a byte array of raw icecast response body and parses the data.
  * Iteration will pause until the `onStream` and `onMetadata` resolve.
  * `onStream` is called and awaited when stream is read
  * `onMetadata` is called and awaited when metadata is read
* `icecastReader.icyMetaInt`
  * Returns the ICY metadata interval for this instance.
  * This can be used to return the detected metadata interval.
* `IcecastMetadataReader.parseIcyMetadata(metadataString: string)`
  * Takes in a string of unparsed ICY metadata
  * Returns object with metadata parsed into key value pairs
    * `"StreamTitle='A Stream Title';/0/0/0/0"` -> `{StreamTitle: "A Stream Title"}` 

---

## `IcecastMetadataQueue`

Schedules metadata updates based on audio time or bytes read.

### Accuracy

Metadata updates can be highly accurate because they are embedded inline with the audio data. Metadata can be queued using either of the below methods.

1. Decode the audio and use the exact audio offset time to queue metadata.
   * Great Accuracy
   * *Used by: Icecast Metadata Player*
1. Derive the offset time based on a constant audio bitrate.
   * Good Accuracy
   * *Used by: Stream Recorder*

#### Improving Accuracy
  * Ensure your Icecast stream source accurately updates metadata
  * Increase the frequency of metadata updates by reducing the size of `Icy-MetaInt`

### Usage

1. To use `IcecastMetadataQueue`, create a new instance with the `Icy-Br` header from the Icecast response representing the bitrate of your stream as well as the optional `onMetadataUpdate` and `onMetadataEnqueue` callback.

   *Note: The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to    enable metadata.*
  
   ```javascript
   const headers = myHTTPResponse.headers;
   
   const onMetadataUpdate = (value) => {
     // do something with the scheduled metadata
   };
   
   const metadataQueue = new IcecastMetadataQueue({
     icyBr: parseInt(headers.get("Icy-Br")),
     onMetadataUpdate: onMetadataUpdate,
     onMetadataEnqueue: onMetadataEnqueue,
     paused: false // set to true to start the queue as paused. To start metadata updates, call `metadataQueue.startQueue(currentTime)`
   });
   ```

1. When metadata is discovered in an Icecast stream, add the metadata to the queue using `.addMetadata()`

   ```javascript
   let audio; // some audio player
   
   const icecastMetadataReader = new IcecastMetadataReader({
     icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
     onMetadata: (value) => metadataQueue.addMetadata(value, audio.timestampOffset, audio.currentTime)
   })
   ```

1. The `onMetadataEnqueue()` callback will be executed with the values passed in.

1. When the metadata is due to be updated, the metadata will be popped from the queue and `onMetadataUpdate()` will be called with the metadata.

### Methods

`const metadataQueue = new IcecastMetadataQueue({icyBr, onMetadataUpdate, onMetadataEnqueue})`

* `metadataQueue.metadataQueue`
  * Gets the contents of the metadata queue
  * Array of `{metadata, timestampOffset, timestamp}` objects in FILO order.
* `metadataQueue.addMetadata(metadata, timestampOffset, currentTime)`
  * Takes in a `metadata` object, total buffered audio in seconds, and the current time in seconds
  * `timestampOffset` should be the total seconds of audio in the player buffer when the metadata was read.
  * `currentTime` (optional, if icyBr is passed in) the current time in the audio player.
* `metadataQueue.getTimeByBytes(numberOfBytes: number)`
  * Takes in a number of stream bytes read and derives the seconds to delay the metadata update based on a constant audio bitrate.
  * This only works for constant bitrate streams.
* `metadataQueue.startQueue(currentTime)`
  * Starts the metadata queue if it was paused.
  * `currentTime` (optional, if icyBr is passed in) the current time in the audio player.
* `metadataQueue.purgeMetadataQueue()`
  * Purges the metadata queue and clears any pending metadata updates.

---

## `IcecastMetadataStream`

A NodeJS Writable stream that exposes stream and metadata via NodeJS Readable streams.

### Usage

1. To use `IcecastMetadataStream`, create a new instance with the `Icy-MetaInt` headers from the Icecast response. You may also provide the `Icy-Br` or `Content-Type` headers to enable metadata times to be detected from the stream.

   *Note: The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to enable metadata.*
   
   ```javascript
   const headers = myHTTPResponse.headers;
   
   const icecastStream = new IcecastMetadataStream({
     icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
     mimeType: parseInt(headers.get("Content-Type")),
     ...options // See IcecastMetadataReader
   });
   ```

2. To read stream and metadata, you can `pipe` the stream and metadata Readable streams to a Writable stream.
   ```javascript
   let someStreamWritable;
   let someMetadataWritable;
   
   icecastStream.stream.pipe(someStreamWritable);
   icecastStream.metadata.pipe(someMetadataWritable);
   ```

3. Then `pipe` the raw icecast response data into the instance of `IcecastMetadataStream`.

   ```javascript
   myHTTPResponse.body.pipe(icecastStream);
   ```

### Options
`const icecastStream = new IcecastMetadataStream({icyBr ...options})`

* `mimeType` (optional)
  * Mimetype pulled from the `Content-Type` header of the Icecast stream (i.e. `audio/mpeg` or `application/ogg`)
  * If this is provided, the metadata times will be based on the frame duration of the audio stream. (more accurate)
* `icyBr` (optional)
  * Constant bitrate for the stream
  * If this is provided, the metadata times will be based on the constant bitrate of the audio stream. (less accurate)
* `options`
  * See the constructor parameters for [`IcecastMetadataReader`](#icecastmetadatareader)

### Methods
* `icecastStream.stream`
  * Gets the Readable stream for `stream` data
* `icecastStream.metadata`
  * Gets the Readable stream for `metadata`

*See documentation on NodeJS Writable Streams for additional methods.*
https://nodejs.org/api/stream.html#stream_writable_streams

---

## `IcecastReadableStream`

A Browser ReadableStream wrapper for IcecastMetadataReader. The `IcecastReadableStream` can be used to easily extract stream and metadata from a `fetch` response.

### Usage

1. To use `IcecastReadableStream`, make your `fetch` request to the Icecast stream endpoint, and then create a new instance with the fetch `Response` and `options` for the internal `IcecastMetadataReader` instance.

    Notes: 
    * For ICY metadata, the GET request to the Icecast server must contain the `Icy-Metadata: 1` header to enable metadata.
      * CORS must allow the `Icy-Metadata` header. Without this header, ICY metadata is not returned in the Icecast response.
    * An inadequate CORS policy on the Icecast server may prevent the `Icy-MetaInt` header from being read. To work around this, `IcecastMetadataReader` will attempt to detect the metadata interval. Alternatively, the metadata interval can be manually determined and passed into the `icyMetaInt` option.
    * See the [Troublshooting](#troublshooting) section for more information on CORS.
   
    ```javascript
    fetch(endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      }
    })
    .then(async (response) => {
      const icecast = new IcecastReadableStream(
        response,
        options // see IcecastMetadataReader
      );
      
      await icecast.startReading();
    });
    ```

### Instantiating
`const icecastReadable = new IcecastReadableStream(fetchResponse, options)`

* `new IcecastReadableStream(fetchResponse, options)`
  * `fetchResponse`
    * Response object from the `fetch` API
  * `options`
    * See the constructor parameters for [`IcecastMetadataReader`](#icecastmetadatareader)

### Methods
* `icecastStream.startReading`
  * Starts reading and parsing the response. Resolves once response had ended.
  * `onStream` is called and awaited when stream data is discovered
  * `onMetadata` is called and awaited when metadata is discovered

### Getters
* `icecastStream.readableStream`
  * Returns the underlying [ReadableStream](https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream)
