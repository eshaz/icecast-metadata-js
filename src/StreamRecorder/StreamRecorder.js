const getArgs = require("./get-args");
const {
  IcecastMetadataArchiveRecorder,
} = require("../Recorder/IcecastMetadataArchiveRecorder");
const {
  IcecastMetadataRecorder,
} = require("../Recorder/IcecastMetadataRecorder");
const path = require("path");

const recorderInstances = new Map();

const getIcecastMetadataArchiveRecorder = (params) =>
  new IcecastMetadataArchiveRecorder({
    archiveInterval: params["archive-interval"],
    archivePath: path.join(__dirname, params["archive-path"]),
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    output: path.join(__dirname, params.output),
  });

const getIcecastMetadataRecorder = (params) =>
  new IcecastMetadataRecorder({
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    output: path.join(__dirname, params.output),
  });

const constructIcecastMetadataReaders = (args, recorder) => {
  if (args.streams) {
    args.streams.forEach((stream) => {
      recorderInstances.set(
        stream.output,
        recorder({ ...args, ...stream }) // stream args should override global args
      );
    });
  } else {
    recorderInstances.set(args.output, recorder({ ...args }));
  }
};

const signalHandler = (signal) => {
  console.log(`Received ${signal}. Cleaning up and exiting`);

  recorderInstances.forEach((recorder) => recorder.stop());

  process.exit(0);
};

const main = () => {
  const args = getArgs();
  const command = args._[0];

  if (command === "archive") {
    constructIcecastMetadataReaders(args, getIcecastMetadataArchiveRecorder);
  } else {
    constructIcecastMetadataReaders(args, getIcecastMetadataRecorder);
  }

  recorderInstances.forEach((recorder) => recorder.record());

  process.on("SIGQUIT", signalHandler);
  process.on("SIGTERM", signalHandler);
  process.on("SIGINT", signalHandler);
};

main();
