const EBML = require("simple-ebml-builder");
const crypto = require("crypto");
const { Writable } = require("stream");

class EBMLBuilder extends Writable {
  constructor({ title, bitrate }) {
    super();
    this._getStart();

    this._title = title;
    this._bitrate = bitrate;

    this._audioBytesRead = 0;
    this._blocksPerCluster = 4;
    this._framesPerBlock = 4;
    this._frameSize = 400;
    this._dataBuffer = new Uint8Array();

    this._chapters = [];
    this._tracks = [];
    this._cues = [];
    this._clusters = [];
    this._blocks = [];
    this._currentTrackNumber = 0;
  }

  _getStart() {
    this._start = EBML.element(EBML.ID.EBML, [
      EBML.element(EBML.ID.EBMLVersion, EBML.number(1)),
      EBML.element(EBML.ID.EBMLReadVersion, EBML.number(1)),
      EBML.element(EBML.ID.EBMLMaxIDLength, EBML.number(4)),
      EBML.element(EBML.ID.DocType, EBML.string("matroska")),
      EBML.element(EBML.ID.DocTypeVersion, EBML.number(4)),
      EBML.element(EBML.ID.DocTypeVersion, EBML.number(2)),
    ]);
  }

  getSegment() {
    return EBML.element(EBML.ID.Segment, [
      this.getSegmentInformation(this._title),
      this.getTracks(),
      this.getChapters(),
      this.getCues(),
      ...this._clusters,
    ]);
  }

  getSegmentInformation(title) {
    return EBML.element(EBML.ID.Info, [
      EBML.element(EBML.ID.TimecodeScale, EBML.number(1000000)),
      EBML.element(EBML.ID.MuxingApp, EBML.string("IcecastMetadataRecorder")),
      EBML.element(EBML.ID.WritingApp, EBML.string("IcecastMetadataRecorder")),
      EBML.element(EBML.ID.Title, EBML.string(title)),
      EBML.element(EBML.ID.SegmentUID, EBML.bytes(EBMLBuilder.getBinUID())),
    ]);
  }

  getChapters() {
    return EBML.element(
      EBML.ID.Chapters,
      EBML.element(EBML.ID.EditionEntry, [
        EBML.element(EBML.ID.EditionFlagHidden, EBML.number(0)),
        EBML.element(EBML.ID.EditionFlagDefault, EBML.number(0)),
        EBML.element(EBML.ID.EditionUID, EBML.number(EBMLBuilder.getUintUID())),
        ...this._chapters,
      ])
    );
  }

  getCues() {
    return EBML.element(EBML.ID.Cues, [...this._cues]);
  }

  getTracks() {
    return EBML.element(EBML.ID.Tracks, this._tracks);
  }

  build() {
    return Buffer.concat([
      EBML.build(this._start),
      EBML.build(this.getSegment()),
    ]);
  }

  static getBinUID() {
    const array = crypto.randomBytes(16);

    return array;
  }

  static getUintUID() {
    return parseInt(Math.random().toString().substring(2, 16));
  }

  static getTimestamp(time) {
    return time * 1000000000;
  }

  getBitrateTimestamp() {
    return (this._audioBytesRead / (this._bitrate * 125)) * 1000;
  }

  addTrack() {
    this._currentTrackNumber++;
    this._tracks.push(
      EBML.element(EBML.ID.TrackEntry, [
        EBML.element(
          EBML.ID.TrackNumber,
          EBML.number(this._currentTrackNumber)
        ),
        EBML.element(EBML.ID.TrackUID, EBML.number(EBMLBuilder.getUintUID())),
        EBML.element(EBML.ID.TrackType, EBML.number(2)),
        EBML.element(EBML.ID.CodecID, EBML.string("A_MPEG/L3")),
      ])
    );
  }

  addChapter(title, time) {
    this._chapters.push(
      EBML.element(EBML.ID.ChapterAtom, [
        EBML.element(EBML.ID.ChapterUID, EBML.number(EBMLBuilder.getUintUID())),
        EBML.element(
          EBML.ID.ChapterTimeStart,
          EBML.number(EBMLBuilder.getTimestamp(time))
        ),
        EBML.element(EBML.ID.ChapterFlagHidden, EBML.number(0)),
        EBML.element(EBML.ID.ChapterFlagEnabled, EBML.number(1)),
        EBML.element(EBML.ID.ChapterDisplay, [
          EBML.element(EBML.ID.ChapString, EBML.string(title)),
        ]),
      ])
    );
  }

  _write(data, enc, cb) {
    this.addData(data);
    cb();
  }

  addData(data) {
    let position = 0;
    let bytesToRead = data.length;

    const blockSize = this._frameSize * this._framesPerBlock;

    while (bytesToRead > 0) {
      const clusterTimestamp = this.getBitrateTimestamp();
      let blockNumber = 0;

      while (bytesToRead > 0 && blockNumber < this._blocksPerCluster) {
        this._addSimpleBlock(
          data.subarray(position, position + blockSize),
          clusterTimestamp
        );
        blockNumber++;

        position += blockSize;
        bytesToRead -= blockSize;
      }

      this._addCluster(clusterTimestamp);
    }
  }

  _addCue(time, position) {
    this._cues.push(
      EBML.element(EBML.ID.CuePoint, [
        EBML.element(EBML.ID.CueTime, EBML.number(time)),
        EBML.element(EBML.ID.CueTrackPositions, [
          EBML.element(EBML.ID.CueTrack, EBML.number(this._currentTrackNumber)),
          EBML.element(EBML.ID.CueClusterPosition, EBML.number(position)),
        ]),
      ])
    );
  }

  _addCluster(time) {
    this._clusters.push(
      EBML.element(EBML.ID.Cluster, [
        EBML.element(EBML.ID.Timecode, EBML.number(time)),
        ...this._blocks,
      ])
    );
    this._addCue(time, this._audioBytesRead);
    this._blocks = [];
  }

  _addSimpleBlock(data, clusterTimestamp) {
    this._blocks.push(
      EBML.element(EBML.ID.SimpleBlock, [
        EBML.bytes(Uint8Array.from([0x81, 0x00])),
        EBML.bytes(
          Int16Array.from([this.getBitrateTimestamp() - clusterTimestamp])
        ),
        EBML.bytes(Uint8Array.from([0x00])),
        EBML.bytes(data),
      ])
    );
    this._audioBytesRead += data.length;
  }
}

module.exports = EBMLBuilder;
