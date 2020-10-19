# Icecast Metadata JS

Icecast Metadata JS is an evolving Javascript based tool set for parsing, recording, and archiving Icecast streams with metadata.

## Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

### npm package coming soon!

## Modules:
 * [Icecast Metadata JS](#icecast-metadata-js)
   * NodeJS and Browser based module for reading audio and metadata from an Icecast response body
   * This module actively used here to display realtime metadata updates: https://dsmrad.io
 * [Stream Recorder](#stream-recorder)
   * NodeJS based application for recording / archiving Icecast audio and metadata
 * [Demo](#demo)
   * React application that demonstrates how to use the MediaSource Extensions API with `icecast-metadata-js`

---

# Icecast Metadata JS

https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-js

Icecast Metadata JS is NodeJS and browser module that takes in an Icecast response body and extracts audio data and metadata, and schedules metadata events.

* [`IcecastMetadataReader`](#icecastmetadatareader)
  * Gets stream data and metadata from a raw Icecast response 
* [`IcecastMetadataQueue`](#icecastmetadataqueue)
  * Queues metadata and schedules metadata updates
* [`IcecastMetadataStream`](#icecastmetadatastream)
  * Wraps IcecastMetadataReader using NodeJS streams


## `IcecastMetadataReader`

A generator that takes in raw icecast response data and returnsx stream data and metadata.

### Usage

1. To use `IcecastMetadataReader`, create a new instance with the `Icy-MetaInt` header from the Icecast response as well as the optional `onStream` and `onMetadata` callbacks.

   *Note: The GET request to the Icecast server must contain a `Icy-Metadata: 1` header to    enable metadata.*
   
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

 1. To begin reading stream data and metadata, call the instance's `.next()` function  with the raw response data as the parameter.
 
    The `.next()` function will return an object containing either `stream` or `metadata`
    
    #### `stream`
    <pre>
    { 
      value: {
        stream: Uint8Array, // stream bytes
        stats: {
          metadataBytesRead: number, // total metadata bytes read
          streamBytesRead: number, // total stream bytes read
          totalBytesRead: number, // total raw bytes read
          currentStreamPosition: number, // relative position of stream bytes
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
          metadataBytesRead: number, // total metadata bytes read
          streamBytesRead: number, // total stream bytes read
          totalBytesRead: number, // total raw bytes read
          currentStreamPosition: number, // relative position of stream bytes
        }
      },
      done: false
    }
    </pre>
    
 1. Continue to call `.next()` with no parameters until `.next()` returns:
    <pre>
    {
      value: undefined,
      done: false
    }
    </pre>

The below example will read all of the stream and metadata from `responseData`.

<pre>
const responseData = response.body;

for (
  let iterator = icecastReader.next(responseData);
  iterator.value;
  iterator = icecastReader.next()
) {
  if (value.stream) {
    // do something with stream data
  }
  if (value.metadata) {
    // do something with metadata
  }
}
</pre>

When you have more response data to read, pass it into the `.next()` function and repeat the steps above.

### Methods

`const icecastReader = new IcecastMetadataReader({metaInt, onStream, onMetadata})`

* `icecastReader.readAll(data: Uint8Array)`
  * Takes in a byte array of raw icecast response body
  * Reads all of the stream and metadata from the raw response data
  * `onStream` is called when stream is read
  * `onMetadata` is called when metadata is read
* `icecastReader.next(data: Uint8Array)`
  * Takes in `Uint8Array` of raw icecast response body
  * Returns object containing stream or metadata
    * `{value: {steam|metadata, stats}, done: false}`
  * Continue to call with __no__ parameter until `.next()` returns `undefined`
  * When `.next()` returns `undefined`, pass in more raw response data
  * `onStream` is called when stream is read
  * `onMetadata` is called when metadata is read
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
  * Metadata time can be derived from the total number of stream bytes read since the latest buffer input. The buffer offset should be the total seconds of audio in the player buffer when the metadata was read.
* `metadataQueue.getTimeByBytes(numberOfBytes: number)`
  * Takes in a number of bytes read and derives the seconds to delay the metadata update based on the bitrate and number of stream bytes read for the current raw response.
  * This can be used in place of an audio buffer offset; however, it is not as accurate as actually decoding the stream and getting the offset in seconds.
* `metadataQueue.purgeMetadataQueue()`
  * Purges the metadata queue and clears any pending metadata updates.

## `IcecastMetadataStream`

A Writable stream that exposes stream and metadata via Readable streams.

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
`const icecastStream = new IcecastMetadataStream({icyBr, icyMetaInt})`

* `icecastStream.stream`
  * Gets the Readable for `stream` data
* `icecastStream.metadata`
  * Gets the Readable for `metadata`

*See documentation on NodeJS Writable Streams for additional methods.*
https://nodejs.org/api/stream.html#stream_writable_streams

---


# Stream Recorder

https://github.com/eshaz/icecast-metadata-js/tree/master/src/stream-recorder

Stream Recorder is a NodeJS application for recording and archiving Icecast streams. It saves both the audio and inline metadata updates.

### Run Locally

* `npm i`
* `npm run build-recorder`
* `node dist/recorder.js record -e https://example.com -o example.mp3`

### commands

<pre>node StreamRecorder.js <b>[record|archive]</b> [options]</pre>

The Stream Recorder CLI has two commands `record` and `archive`.

* `record`
  * Records Icecast stream(s) into an audio file and a cue file.
  * Record will continue indefinitely until the Icecast stream or process has ended.

* `archive`
  * Archives Icecast streams(s) into an audio and a cue file.
  * Archive will "archive" or rollover the current files given a cron interval.
    * Archiving will stop recording, save the current files into an archiving directory, and then restart recording.
  * Archive will continue indefinitely until the process ends.


### options

<pre>node StreamRecorder.js [record|archive] <b>[options]</b></pre>

`record` and `archive` options:

* `--endpoint, -e <https://example.com>`
  * Web address of the stream.
* `--output, -o <myfile.mp3>`
  * Filename to save audio stream and metadata.
  * Metadata is saved in a cue file with the same `basename` of this argument.
* `--name, -n ["Some Name"]`
  * Name of the stream that will be save to the `TITLE` of the cue file. Overrides the value in the `icy-name` header
* `--date-entries, -d`
  * Saves a `DATE` into each `TRACK` of the cue file
  * `DATE` entry formatting: `YYYY-MM-DDTHH:MMZ` UTC
* `--prepend-date`
  * Prepends an ISO date to the `TITLE` of each `TRACK` of the cue file
  * Prepended date formatting: `YYYY-MM-DDTHH:MM:SS.SSSZ` UTC
* `--cue-rollover, -r [999]`
  * Creates a new cue file after every nth cue entry
  * Useful for playback in applications with track number limitations such as a CD which can contain 99 tracks, or foobar2000 which can only playback cue files with 999 tracks or less.
* `--metadata-interval, -m [16000]`
  * Manually specify the metadata interval.
  * <u>*Warning:* Only use when server does not respond with valid `Icy-MetaInt` header</u>
* `--bitrate, -b [320]`
  * Manually specify the bitrate.
  * <u>*Warning:* Only use when server does not respond with valid `Icy-Br` header</u>

`archive` options:

* `--archive-interval, -i <"0 */6 * * *">`
  * Cron expression that is used to trigger an archive rollover
* `--archive-path, -p <"path/to/archive">`
  * Archived files will be moved into a directory in this path during the rollover
  * Directory name formatting: `YYYY-MM-DD`

JSON configuration

* `--config <path/to/file.json>`
  * All of the above options can be noted in a configuration JSON file.
* `streams`
  * A JSON array of streams to record or archive.
  * Stream level options override global options.
  * `endpoint`, `output`, and `name` cannot be used globally with the `streams` option set.
  * Required: `{endpoint, output}`
  * Optional: `{name, output-path, archive-interval, archive-path, cue-rollover, date-entries, prepend-date}`
* `output-path`
  * Filepath to save all output files to.
  * This is only useful while used in conjunction with the `streams` array so that you can leave out long file paths in the each `streams` element.

### Examples

<pre>node StreamRecorder.js record --endpoint "https://example.com/stream.mp3" --output "stream.mp3"</pre>
   * Saves https://example.com/stream to stream.mp3 and stream.cue
   ---
<pre>node StreamRecorder.js record --config "config.json"`</pre>
   * Records stream(s) defined in config.json
   ---
<pre>
node StreamRecorder.js archive \
-e "https://example.com/stream.mp3" \
-o "stream.mp3" \
-i "0 */6 * * *" \
-p "archived-streams"`
</pre>  
  * Records and archives the stream at minute 0 past every 6th hour
  ---
<pre>node StreamRecorder.js archive --config config.json</pre>
  * Records and archives the stream(s) using JSON configuration

     ```
     ./config.json:
     {
         "cue-rollover": 999,
         "output-path": "/out",
         "archive-path": "/out/archive",
         "archive-interval": "* */6 * * *",
         "streams": [
             {
                 "output": "myfile.mp3",
                 "endpoint": "https://example.com/streams/my-stream"
             },
             {
                 "output": "mystream.mp3",
                 "name": "Another Stream",
                 "date-entries": true,
                 "endpoint": "https://example.com/streams/another-stream"
             },
         ]
     }
     ```
---


# Demo

The Icecast Metadata Reader Demo is a React application that demonstrates how to use `icecast-metadata-js` with the [MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource).

https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo

## View the live demo here: https://eshaz.github.io/icecast-metadata-js/

### Browser compatibility

The demo is based on the MediaSource Extentions (MSE) API. Some browsers do not support common audio formats with the MSE API. *(i.e. Firefox does not support audio/mpeg or audio/aac)*

Checkout this link to see which codecs your browser supports.
https://cconcolato.github.io/media-mime-support/#audio_codecs


#### Supported Browsers:
 * Chrome

#### Un-supported Browsers:
 * Firefox *MediaSource codecs `audio/mpeg` and `audio/aac` are not supported*

### Running Locally

* `cd src/demo`
* `npm i`
* `npm start` -> Runs a local server on http://localhost:3000

## Adding your own Icecast stream

### CORS

If you want to serve your stream and website on a different origin, you will need make sure your CORS configuration includes the below configuration to enable metadata and stream information.

```
Access-Control-Allow-Origin: 'https://your-website-origin.example.com'
Access-Control-Allow-Methods: 'GET, HEAD, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type, Icy-Metadata'
Access-Control-Expose-Headers: 'Icy-MetaInt, Icy-Br, Icy-Description, Icy-Genre, Icy-Name, Ice-Audio-Info, Icy-Url, Icy-Sr, Icy-Vbr, Icy-Pub';
```

