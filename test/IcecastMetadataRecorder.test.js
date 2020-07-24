const IcecastMetadataRecorder = require("../src/IcecastMetadataRecorder");

const testStream = new IcecastMetadataRecorder({
    fileName: "isics-all.mp3",
    streamTitle: "ISICS All",
    streamEndpoint: "https://dsmrad.io/stream/isics-all",
  });
  
testStream.record();