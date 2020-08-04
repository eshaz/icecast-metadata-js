# Icecast Metadata JS

_Please Note: This is an unreleased work in progress. Expect frequent breaking changes and bug fixes!_

Iceacast Metadata JS is an evolving Javascript based tool set for parsing, recording, and archiving Icecast streams with metadata.

## npm package coming soon!

## Modules:
 * [Stream Recorder](#stream-recorder)
   * NodeJS based application for recording / archiving Icecast audio and metadata
 * [Icecast Metadata Parser](#icecast-metadata-parser)
   * NodeJS and Browser based module for reading audio and metadata from an Icecast response body
   * This module actively used here to display realtime metadata updates: https://dsmrad.io

---

# Stream Recorder

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


# Icecast Metadata Parser

Icecast Metadata Parser is NodeJS and browser module that takes in an Icecast response body and extracts audio data and metadata. Metadata that is extracted from the Icecast response are exposed via an immediate `onMetadata` callback and a scheduled `onMetadataUpdate` callback that is synchronized to exactly match the audio data.

## API

To use `IcecastMetadataParser`, create a new instance of it with the `Icy-Br` and `Icy-MetaInt` passed in from the Icecast response headers as well as the callbacks that you would like executed when metadata is discovered or scheduled.

```

const headers = myHTTPResponse.headers;

const myOnMetadataCallback = (metadata) => {
  console.log("I discovered metadata", metadata);
};
const myOnMetadataUpdateCallback = (metadata) => {
  console.log("I am synced with the audio", metadata);
};

const icecastParser = new IcecastMetadataParser({
  onMetadata: myOnMetadataCallback,
  onMetadataUpdate: myOnMetadataUpdateCallback,
  icyMetaInt: parseInt(headers.get("icy-metaint")),
  icyBr: parseInt(headers.get("icy-br")),
});
```

## Reading Audio

When your HTTP request has some data in the response body, call the `readBuffer` on the `IcecastMetadataParser` to parse the audio and metadata from the stream. If you are using this with an audio player, pass in the current time, and total buffered time that is reported by the audio player.

```
icecastParser.readBuffer(data, currentTime, totalBufferedTime);
```

When you are ready to start adding data to the audio player, call the `stream` getter to return all of the audio data from the parser. This will clear out any stream data stored internally in the `IcecastMetadataParser`.

```
const streamData = icecastParser.stream;
myAudioPlayer.addData(streamData);
```

## Metadata Callbacks

Metadata is interlaced in the response body of an Icecast stream. The `onMetadata` and `onMetadataUpdate` callbacks are used to expose metadata.

```
onMetadata(metadata, time);
```
  * Called immediately when metadata is discovered on the stream.

```
onMetadataUpdate(metadata, time)
```
  * Called using a timeout based on the audio player time passed into `readBuffer`

#### Parameters

`metadata`
  * An object containing any key value pairs discovered in the metadata.
  * Example: `{StreamTitle: "Title", StreamUrl: "Some URL"}`

`time`
  * Time in seconds in relation to the audio stream that the metadata was discovered.
  * Accuracy improves if:
    * Audio player times passed in are accurate.
    * Frequency of metadata updates is greater (i.e. smaller `Icy-MetaInt`)
    * Stream is a constant bitrate, and this is passed in to the `icyBr` parameter.


## Example Usage

The below example uses the `MediaSource` API to add the audio data to a `SourceBuffer` which can be added as a `src` to an HTML5 Audio Element. The `onMetadataUpdate` callback will be executed in time with the audio in the `SourceBuffer`

https://developer.mozilla.org/en-US/docs/Web/API/MediaSource

*This code has not been tested, and is presented as an example only.*

<pre>
const mediaSource = new MediaSource();
const sourceBuffer = mediaSource.addSourceBuffer("audio/mpeg");

fetch("https://example.com/stream", {
  method: "GET",
  headers: {
    "Icy-MetaData": "1",
  },
  mode: "cors",
}).then((response) => {
  const icecastParser = new IcecastMetadataParser({
    icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
    icyBr: parseInt(headers.get("Icy-Br")),
    onMetadataUpdate: myMetadataUpdateCallback,
    onMetadata: myMetadataCallback,
  });

  const reader = response.body.getReader();

  const readNextResponse = () =>
    reader.read().then(({ done, value }) => {
      icecastParser.readBuffer(
        value,
        currentPlayerTime, // audio element current playing time
        sourceBuffer.timestampOffset
      );

      sourceBuffer.updating ||
        sourceBuffer.appendBuffer(icecastParser.stream);

      return readNextResponse();
    });
  readNextResponse();
});

</pre>

