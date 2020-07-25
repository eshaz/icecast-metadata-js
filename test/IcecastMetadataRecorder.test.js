const IcecastMetadataRecorder = require("../src/IcecastMetadataRecorder");

const isicsAll = new IcecastMetadataRecorder({
  fileName: "isics-all",
  streamTitle: "ISICS All",
  streamEndpoint: "https://dsmrad.io/stream/isics-all",
  cueRolloverInterval: 5,
});

const saraAll = new IcecastMetadataRecorder({
  fileName: "sara-all",
  streamTitle: "SARA All",
  streamEndpoint: "https://dsmrad.io/stream/sara-all",
  cueRolloverInterval: 5,
});

isicsAll.record();
saraAll.record();

setTimeout(() => isicsAll.stop(), 2000);
