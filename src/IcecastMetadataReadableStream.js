const IcecastMetadataParser = require("./IcecastMetadataParser");
const stream = require('stream');

class IcecastMetadataReadableStream extends IcecastMetadataParser {
    constructor(params) {
        const {
            audioStream,
            metadataStream,
            ...superParams
        } = params;

        super(superParams);
        this._totalReadBytes = 0;

        this.audioStream = audioStream;
        this.metadataStream = metadataStream;
        this.writableStream = this._getWritableStream();
    }

    _getTotalTime() {
        return this._totalReadBytes / (this._icyBr * 125)
    }

    _getWritableStream() {
        const icecast = this;
        return new stream.Writable({
            write(chunk, encoding, done) {
                icecast.readBuffer(chunk, 0, icecast._getTotalTime());

                const stream = icecast.getStream();
                icecast._totalReadBytes += stream.length;

                console.log("writing", icecast._totalReadBytes, icecast._getTotalTime())
                
               // icecast.audioStream.push(stream);
                done();
            }
        });
    }
}

module.exports = IcecastMetadataReadableStream;