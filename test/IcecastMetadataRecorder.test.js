const IcecastMetadataRecorder = require("../src/IcecastMetadataRecorder");

const isicsAll = new IcecastMetadataRecorder({
  fileName: "isics-all",
  streamTitle: "ISICS All",
  streamEndpoint: "https://dsmrad.io/stream/isics-all",
  cueRolloverInterval: 999,
});

const saraAll = new IcecastMetadataRecorder({
  fileName: "sara-all",
  streamTitle: "SARA All",
  streamEndpoint: "https://dsmrad.io/stream/sara-all",
  cueRolloverInterval: 999,
});

isicsAll.record();
// saraAll.record();
