class CueFileGenerator {
    constructor({streamName, audioFile}) {
        this._cueFile = 
        `TITLE "${streamName}"
        FILE "${audioFile}" WAVE
        `;
        this._trackNumber = 1;
    }

    _getFrame(secondFraction) {
        return Math.floor(75 / (millis % 1000) / 1000) 
    }

    _getMinutesSeconds(millis) {
        const second = Math.floor(millis / 1000);
        const minute = seconds % 60;
        const frame = this._getFrame(millis);

        return `${minute}:${second}:${frame}`
    }

    addEntry(millis, title) {
        this._cueFile += `
        TRACK ${this._trackNumber++} AUDIO
          TITLE "${title}"
          INDEX 01 ${this._getMinutesSeconds(millis)}`;
    }

    getQueueFile() {
        return this._cueFile;
    }
}