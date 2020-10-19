/* Copyright 2020 Ethan Halsall

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

const getArgs = require("./get-args");
const IcecastMetadataArchiveRecorder = require("./Recorder/IcecastMetadataArchiveRecorder");
const IcecastMetadataRecorder = require("./Recorder/IcecastMetadataRecorder");
const path = require("path");

const recorderInstances = new Map();
let runningInstances = 0;

const getIcecastMetadataArchiveRecorder = (params) =>
  new IcecastMetadataArchiveRecorder({
    archiveInterval: params["archive-interval"],
    archivePath: path.join(
      path.isAbsolute(params["archive-path"]) ? "" : __dirname,
      params["archive-path"]
    ),
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    prependDate: params["prepend-date"],
    dateEntries: params["date-entries"],
    metadataInterval: params["metadata-interval"],
    bitrate: params["bitrate"],
    output: path.join(
      path.isAbsolute(params.output) ? "" : params["output-path"] || __dirname,
      params.output
    ),
  });

const getIcecastMetadataRecorder = (params) =>
  new IcecastMetadataRecorder({
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    prependDate: params["prepend-date"],
    dateEntries: params["date-entries"],
    metadataInterval: params["metadata-interval"],
    bitrate: params["bitrate"],
    output: path.join(
      path.isAbsolute(params.output) ? "" : params["output-path"] || __dirname,
      params.output
    ),
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

const errorHandler = () => {
  runningInstances--;
  if (runningInstances === 0) {
    process.exit(1);
  }
};

const main = () => {
  const args = getArgs();
  const command = args._[0];

  if (command === "archive") {
    constructIcecastMetadataReaders(args, getIcecastMetadataArchiveRecorder);
  } else if (command === "record") {
    constructIcecastMetadataReaders(args, getIcecastMetadataRecorder);
  } else {
    console.error(`Invalid command: ${command}`);
    process.exit(1);
  }

  process.on("SIGQUIT", signalHandler);
  process.on("SIGTERM", signalHandler);
  process.on("SIGINT", signalHandler);

  recorderInstances.forEach((recorder) => {
    runningInstances++;
    recorder.record().catch((e) => {
      console.error("Failed to record:", recorder.endpoint, e.message);
      errorHandler();
    });
  });
};

main();
