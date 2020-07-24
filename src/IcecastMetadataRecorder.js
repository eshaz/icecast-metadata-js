const fetch = require("node-fetch");
const fs = require("fs");
const { Readable } = require("stream");
const IcecastMetadataTransformStream = require("./IcecastMetadataTransformStream");
const CueFileGenerator = require("./CueFileGenerator");

class IcecastMetadataRecorder {
  constructor({ fileName, streamTitle, streamEndpoint }) {
    this._fileName = fileName;
    this._streamTitle = streamTitle;
    this._streamEndpoint = streamEndpoint;
    this._audioFileWritable = fs.createWriteStream(fileName);
    this._cueFileWritable = fs.createWriteStream(`${fileName}.cue`);
  }

  _getIcecast(headers) {
    this._icecast = new IcecastMetadataTransformStream({
      icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
      icyBr: parseInt(headers.get("Icy-Br")),
      onMetadataQueue: this._recordMetadata.bind(this),
    });
  }

  _getCueReadable() {
    this._cue = new CueFileGenerator({
      title: this._streamTitle,
      fileName: this._fileName,
    });
    this._cue.addEntry(0, ""); // initialize cue file with first track
  }

  _responseHandler(response) {
    this._getIcecast(response.headers);
    this._getCueReadable();

    this._cue.pipe(this._cueFileWritable);
    response.body.pipe(this._icecast).pipe(this._audioFileWritable);
  }

  record() {
    return fetch(this._streamEndpoint, {
      method: "GET",
      headers: {
        "Icy-MetaData": "1",
      },
      cache: "no-store",
      mode: "cors",
    }).then(this._responseHandler.bind(this));
  }

  _recordMetadata(meta) {
    this._cue.addEntry(meta.time, meta.metadata);
    console.log(meta.metadata);
  }
}

module.exports = IcecastMetadataRecorder;
