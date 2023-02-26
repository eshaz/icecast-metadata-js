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
import fetch from "node-fetch";
import path from "path";

import getArgs from "./get-args.js";
import IcecastMetadataArchiveRecorder from "./Recorder/IcecastMetadataArchiveRecorder.js";
import IcecastMetadataRecorder from "./Recorder/IcecastMetadataRecorder.js";

const recorderInstances = new Map();
let runningInstances = 0;

const getIcecastMetadataArchiveRecorder = (params) =>
  new IcecastMetadataArchiveRecorder({
    archiveInterval: params["archive-interval"],
    archivePath: params["archive-path"]
      ? path.join(
          path.isAbsolute(params["archive-path"]) ? "" : process.cwd(),
          params["archive-path"]
        )
      : process.cwd(),
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    prependDate: params["prepend-date"],
    dateEntries: params["date-entries"],
    metadataInterval: params["metadata-interval"],
    contentType: params["content-type"],
    output: path.join(
      path.isAbsolute(params.output)
        ? ""
        : params["output-path"] || process.cwd(),
      params.output
    ),
    fetch,
  });

const getIcecastMetadataRecorder = (params) =>
  new IcecastMetadataRecorder({
    name: params.name,
    endpoint: params.endpoint,
    cueRollover: params["cue-rollover"],
    prependDate: params["prepend-date"],
    dateEntries: params["date-entries"],
    metadataInterval: params["metadata-interval"],
    contentType: params["content-type"],
    output: path.join(
      path.isAbsolute(params.output)
        ? ""
        : params["output-path"] || process.cwd(),
      params.output
    ),
    fetch,
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

  Promise.allSettled(recorderInstances.map((recorder) => recorder.stop())).then(
    () => {
      process.exit(0);
    }
  );
};

const errorHandler = () => {
  runningInstances--;
  if (runningInstances === 0) {
    console.error("All streams have failed, exiting.");
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
    recorder.errorHandler = (e) => {
      console.error("Failed to record:", recorder.endpoint, e.message);
      errorHandler();
    };
    recorder.record();
  });
};

main();
