# Icecast Metadata JS

Icecast Metadata JS is NodeJS and browser module that takes in an Icecast response body and extracts audio data and metadata, and schedules metadata events.

## Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

* [`IcecastMetadataReader`](#icecastmetadatareader)
  * Gets stream data and metadata from a raw Icecast response
  * Supports ICY and OGG (Vorbis Comment) metadata
* [`IcecastMetadataQueue`](#icecastmetadataqueue)
  * Queues metadata and schedules metadata updates
* [`IcecastMetadataStream`](#icecastmetadatastream)
  * NodeJS streams wrapper for IcecastMetadataReader
* [`IcecastReadableStream`](#icecastreadablestream)
  * Browser ReadableStream wrapper for IcecastMetadataReader


See the main page of this repo for other Icecast JS tools:
https://github.com/eshaz/icecast-metadata-js

## `IcecastMetadataReader`

A generator that takes in raw icecast response data and return stream data and metadata.

### Usage

1. To use `IcecastMetadataReader`, create a new instance with the `Icy-MetaInt` header from the Icecast response as well as the optional `onStream` and `onMetadata` callbacks.
   * If `icyMetaInt` is falsy, for example if the CORS policy does not allow clients to read the `Icy-MetaInt` header, then `IcecastMetadataReader` will attempt to detect the metadata interval based on the incoming request data.

   *The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to enable ICY metadata.*
   
   <pre>
   const headers = myHTTPResponse.headers;
   
   const onStream = (value) => {
     // do something with the data in value.stream
   };
   const onMetadata = (value) => {
     // do something with the data in value.metadata
   };
   
   const icecastReader = new IcecastMetadataReader({
     icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
     onStream: onStream,
     onMetadata: onMetadata,
   });
   </pre>

 1. To begin reading stream data and metadata, pass in the raw response into the instance's `.iterator()` or `.asyncIterator()`. Iterate over this iterator using a `for ...of` or `for await...of` loop.

    <pre>
    const responseData = response.body;
    
    for (const i of icecastReader.iterator(responseData)) {
      if (i.stream) {
        // do something with stream data
      }
      if (i.metadata) {
        // do something with metadata
      }
    }
    </pre>
 
    Each iteration will return an object containing either `stream` or `metadata`
    
    #### `stream`
    <pre>
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
    </pre>
    
    #### `metadata`
    <pre>
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
    </pre>

1. The iteration will complete once all of the response data is parsed. When more raw data is available, repeat the steps above to continue parsing the data.

**Note: Stream data is always returned immediately when it is discovered in the raw response. Metadata is stored within the IcecastMetadataReader until a full chunk of metadata can be parsed and returned. The IcecastMetadataReader also internally tracks the metadata interval to properly return metadata. If you are reading a continuous stream of raw response data, be sure to use the same instance of the IcecastMetadataReader.**

### Methods

`const icecastReader = new IcecastMetadataReader({icyMetaInt, onStream, onMetadata})`

* `new IcecastMetadataReader({icyMetaInt, icyDetectionTimeout, onStream, onMetadata})`
  * `icyMetaInt`
    * ICY Metadata interval read from `Icy-MetaInt` header in the response
  * `icyDetectionTimeout`
    * Duration in milliseconds to search for metadata if icyMetaInt isn't passed in
    * Set to `0` to disable metadata detection
    * default: `2000`
  * `onStream`
    * Async callback when stream data is returned
  * `onMetadata`
    * Async callback when stream data is returned
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
* `icecastReader.parseMetadataBytes(data: Uint8Array)`
  * Takes in a byte array of Icecast metadata
  * Returns object with metadata parsed into key value pairs (see below)
* `IcecastMetadataReader.parseMetadataString(metadataString: string)`
  * Takes in a string of unparsed Icecast metadata
  * Returns object with metadata parsed into key value pairs
    * `"StreamTitle='A Stream Title';"` -> `{StreamTitle: "A Stream Title"}` 

## `IcecastMetadataQueue`

Schedules metadata updates based on audio time or bytes read.

### Accuracy

Metadata updates can be highly accurate because they are embedded inline with the audio data. Metadata can be queued using either of the below methods.

1. Decode the audio and use the exact audio offset time to queue metadata.
   * Great Accuracy
   * *Used by: Icecast Metadata JS Demo*
1. Derive the offset time based on a constant audio bitrate.
   * Good Accuracy
   * *Used by: Stream Recorder*

#### Improving Accuracy
  * Ensure your Icecast stream source accurately updates metadata
  * Increase the frequency of metadata updates by reducing the size of `Icy-MetaInt`

### Usage

1. To use `IcecastMetadataQueue`, create a new instance with the `Icy-Br` header from the Icecast response representing the bitrate of your stream as well as the optional `onMetadataUpdate` callback.

   *Note: The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to    enable metadata.*
  
   <pre>
   const headers = myHTTPResponse.headers;
   
   const onMetadataUpdate = (value) => {
     // do something with the scheduled metadata
   };
   
   const metadataQueue = new IcecastMetadataQueue({
     icyBr: parseInt(headers.get("Icy-Br")),
     onMetadataUpdate: onMetadataUpdate,
   });
   </pre>

1. When metadata is discovered in an Icecast stream, add the metadata to the queue using `.addMetadata()`

   <pre>
   let audio; // some audio player
   
   const icecastMetadataReader = new IcecastMetadataReader({
     icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
     onMetadata: (value) => metadataQueue.addMetadata(value, audio.timestampOffset - audio.currentTime)
   })
   </pre>


1. When the metadata is due to be updated, the metadata will be popped from the queue and `onMetadataUpdate()` will be called with the metadata.

### Methods

`const metadataQueue = new IcecastMetadataQueue({icyBr, onMetadataUpdate})`

* `metadataQueue.metadataQueue`
  * Gets the contents of the metadata queue
* `metadataQueue.addMetadata(metadata: object, seconds: number)`
  * Takes in a `metadata` object and the number of seconds to delay the metadata update
  * The buffer offset should be the total seconds of audio in the player buffer when the metadata was read.
* `metadataQueue.getTimeByBytes(numberOfBytes: number)`
  * Takes in a number of stream bytes read and derives the seconds to delay the metadata update based on a constant audio bitrate.
  * This only works for constant bitrate streams.
* `metadataQueue.purgeMetadataQueue()`
  * Purges the metadata queue and clears any pending metadata updates.

## `IcecastMetadataStream`

A NodeJS Writable stream that exposes stream and metadata via NodeJS Readable streams.

### Usage

1. To use `IcecastMetadataStream`, create a new instance with the `Icy-Br` and `Icy-MetaInt` headers from the Icecast response.

   *Note: The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to enable metadata.*
   
   <pre>
   const headers = myHTTPResponse.headers;
   
   const icecastStream = new IcecastMetadataStream({
     icyBr: parseInt(headers.get("Icy-Br")),
     icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
   });
   </pre>

2. To read stream and metadata, you can `pipe` the stream and metadata Readable streams to a Writable stream.
   <pre>
   let someStreamWritable;
   let someMetadataWritable;
   
   icecastStream.stream.pipe(someStreamWritable);
   icecastStream.metadata.pipe(someMetadataWritable);
   </pre>

3. Then `pipe` the raw icecast response data into the instance of `IcecastMetadataStream`.

   <pre>
   myHTTPResponse.body.pipe(icecastStream);
   </pre>

### Methods
`const icecastStream = new IcecastMetadataStream({icyBr, icyMetaInt, icyDetectionTimeout})`

* `icecastStream.stream`
  * Gets the Readable for `stream` data
* `icecastStream.metadata`
  * Gets the Readable for `metadata`

*See documentation on NodeJS Writable Streams for additional methods.*
https://nodejs.org/api/stream.html#stream_writable_streams

## `IcecastReadableStream`

A Browser ReadableStream wrapper for IcecastMetadataReader. The `IcecastReadableStream` can be used to easily extract stream and metadata from a `fetch` response.

### Usage

1. To use `IcecastReadableStream`, make your `fetch` request to the Icecast stream endpoint, and then create a new instance with the fetch `Response` and `options` for the internal `IcecastMetadataReader` instance.

    Notes: 
    * The GET request to the Icecast server must contain the `Icy-Metadata: 1` header to enable metadata.
      * CORS must allow the `Icy-Metadata` header. Without this header, metadata is not returned in the Icecast response.
    * An inadequate CORS policy on the Icecast server may prevent the `Icy-MetaInt` header from being read. To work around this, `IcecastMetadataReader` will attempt to detect the metadata interval. Alternatively, the metadata interval can be manually determined an passed into the `icyMetaInt` option.
    * See the [Troublshooting](#troublshooting) section for more information on CORS.
   
    <pre>
    fetch(endpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      }
    })
    .then(async (response) => {
      const icecast = new IcecastReadableStream(
        response,
        {
          icyMetaInt, // only use Icy-MetaInt is not in the response header
          onStream: async (value) => // do something with the stream,
          onMetadata: async (value) => // do something with the metadata
        }
      );
      
      await icecast.startReading();
    });
    </pre>

### Methods
`const icecastReadable = new IcecastReadableStream(fetchResponse, options)`

* `new IcecastReadableStream(fetchResponse, options)`
  * `fetchResponse`
    * Response object from the `fetch` API
  * `options`
    * See the constructor parameters for `IcecastMetadataReader`
* `icecastStream.startReading`
  * Starts reading and parsing the response. Resolves once response had ended.
  * `onStream` is called and awaited when stream data is discovered
  * `onMetadata` is called and awaited when metadata is discovered

*See documentation on ReadableStream for additional methods.*
https://developer.mozilla.org/en-US/docs/Web/API/ReadableStream