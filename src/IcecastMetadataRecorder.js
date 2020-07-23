const fetch = require("node-fetch");
const IcecastMetadataReadableStream = require("./IcecastMetadataReadableStream");
const CueFileGenerator = require("./CueFileGenerator");

class IcecastMetadataRecorder {
    constructor({fileName, endpoint}) {
        this._fileName = fileName;
        this._endpoint = endpoint;
        this._cueGenerator = new CueFileGenerator({name: "isics", audioFile: "isics-all.mp3"});
    }

    _getIcecast(headers) {
        const icecastParams = {
          icyMetaInt: parseInt(headers.get("Icy-MetaInt")),
          icyBr: parseInt(headers.get("Icy-Br")),
          onMetadataQueue: this._recordMetadata.bind(this)
        };
        this._icecast = new IcecastMetadataReadableStream(icecastParams);
        this._cueGenerator.addEntry(0, "");
      }

    _responseHandler(response) {
        this._getIcecast(response.headers);
        const reader = response.body.pipe(this._icecast.writableStream);
    }

    record() {
        return fetch(this._endpoint, {
            method: "GET",
            headers: {
              "Icy-MetaData": "1",
            },
            cache: "no-store",
            mode: "cors"
          })
            .then(this._responseHandler.bind(this))
    }

    _recordMetadata(meta) {
        this._cueGenerator.addEntry(meta.time, meta.metadata)
    }
}

const testStream = new IcecastMetadataRecorder({
    endpoint: "https://dsmrad.io/stream/isics-all"
})

testStream.record();

module.exports = IcecastMetadataRecorder;