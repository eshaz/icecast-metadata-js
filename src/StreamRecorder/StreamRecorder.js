const getArgs = require("./get-args");
const {
  IcecastMetadataArchiveRecorder,
} = require("../Recorder/IcecastMetadataArchiveRecorder");
const path = require("path");

const icecastMetadataRecorders = new Map();

const getIcecastMetadataRecorder = (params) =>
  new IcecastMetadataArchiveRecorder({
    archiveInterval: params["archive-interval"],
    archivePath: path.join(__dirname, params["archive-path"]),
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    output: path.join(__dirname, params.output),
  });

const constructIcecastMetadataReaders = (args) => {
  if (args.streams) {
    args.streams.forEach((stream) => {
      icecastMetadataRecorders.set(
        stream.output,
        getIcecastMetadataRecorder({ ...args, ...stream }) // stream args should override global args
      );
    });
  } else {
    icecastMetadataRecorders.set(
      args.output,
      getIcecastMetadataRecorder({ ...args })
    );
  }
};

const main = () => {
  const args = getArgs();
  const command = args._[0];

  constructIcecastMetadataReaders(args);
  icecastMetadataRecorders.forEach((recorder) => recorder.record());

  setTimeout(() => icecastMetadataRecorders.get("isics-all.mp3").stop(), 1000);
};

main();
