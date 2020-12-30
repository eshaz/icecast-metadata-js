# Icecast Metadata JS

Icecast Metadata JS is an evolving Javascript based tool set for parsing, recording, and archiving Icecast streams with metadata.

## Checkout the demo [here](https://eshaz.github.io/icecast-metadata-js/)!

## Modules:
 * [**Icecast Metadata JS**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-js#readme) (click for further documentation)
   * Browser and NodeJS module for reading audio and metadata from an Icecast response body
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-js) - Install using `npm i icecast-metadata-js`
   * This module actively used here to display realtime metadata updates: https://dsmrad.io
   * LGPL 3.0 or Greater
 * [**Stream Recorder**](#stream-recorder)
   * NodeJS based application for recording / archiving Icecast audio and metadata
   * NPM Package coming soon!
   * GPL 3.0 or Greater
 * [**Demo**](#demo)
   * React application that demonstrates how to use the MediaSource Extensions API with `icecast-metadata-js`

## Troubleshooting
  * [**Cross-Origin Resource Sharing (CORS)**](#cors)

---

# Stream Recorder

https://github.com/eshaz/icecast-metadata-js/tree/master/src/stream-recorder

Stream Recorder is a NodeJS application for recording and archiving Icecast streams. It saves both the audio and inline metadata updates.

### Run Locally

* `git clone https://github.com/eshaz/icecast-metadata-js.git`
* `cd src/stream-recorder`
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

The demo is based on the MediaSource Extensions (MSE) API. Some browsers do not support common audio formats with the MSE API. If you find that your browser doesn't support an MSE codec that you would like to use for Icecast, please enter a GitHub issue.

Checkout this link to see which codecs your browser supports.
https://cconcolato.github.io/media-mime-support/#audio_codecs


#### Supported Browsers / Codecs:
 * Chrome, Firefox `audio/mpeg`, `audio/aac`, `application/ogg` (FLAC, Opus)
 * iOS, Safari, Edge, others... *support unknown* - Let me know if it works!

#### Un-supported Codecs:
 * Chrome, Firefox `application/ogg` (vorbis)

### Running Locally

* `git clone https://github.com/eshaz/icecast-metadata-js.git`
* `cd src/demo`
* `npm i`
* `npm start` -> Runs a local server on http://localhost:3000


---


# Troubleshooting

## CORS

Cross-Origin Response Sharing is a client side security mechanism to prevent scripts from accessing other websites outside of the website the script originated from. Websites can opt-in to CORS by responding with various `Allow-Control` headers. Browsers will send an pre-flight `OPTIONS` request to the cross-origin resource when a script attempts to access a cross-origin resource. The actual request will be allowed only if the `OPTIONS` response contains the appropriate `Allow-Control` headers.

Read more about CORS here: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

OGG Metadata is not dependent on requesting or reading any headers, but still relies on CORS for reading the response cross-origin.

ICY metadata is dependent on being able to request and read headers (specifically the `Icy-*` headers). If you intend on serving your Icecast stream on a website that is not on the same origin as your Icecast server, you will need to add the below CORS headers.


### CORS configuration for OGG metadata:
* **OGG Metadata will not work in a browser without this configuration.**
```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type'
```

### Bare minimum CORS configuration for ICY metadata:

* **ICY Metadata will not work in a browser without this configuration.**
```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type, Icy-Metadata'
```

### Preferred CORS configuration for ICY metadata:

```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type, Icy-Metadata'
Access-Control-Expose-Headers: 'Icy-MetaInt, Icy-Br, Icy-Description, Icy-Genre, Icy-Name, Ice-Audio-Info, Icy-Url, Icy-Sr, Icy-Vbr, Icy-Pub';
```

