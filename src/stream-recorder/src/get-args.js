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

import fs from "fs";
import yargs from "yargs";
import cron from "cron-parser";

const exclusive = (obj, a, b) => {
  if (!(obj[a] || obj[b])) {
    throw new Error(`Arguments ${a} or ${b} are required`);
  } else if (obj[a] && obj[b]) {
    throw new Error(`Arguments ${a} and ${b} are mutually exclusive`);
  }
  return true;
};

const assertType = (obj, a, type) => {
  if (
    obj[a] !== undefined &&
    (typeof obj[a] !== type || (type === "number" && isNaN(obj[a])))
  ) {
    throw new Error(`Argument ${a} must be of type ${type}. Found '${obj[a]}'`);
  }

  return true;
};

const assertArray = (obj, a) => {
  if (!Array.isArray(obj[a])) {
    throw new Error(`Argument ${a} must be of type Array. Found '${obj[a]}'`);
  }

  return true;
};

const assertNotNull = (obj, a) => {
  if (obj[a] === null || obj[a] === undefined) {
    throw new Error(`Argument ${a} is required`);
  }

  return true;
};

const assertCronString = (obj, a) => {
  try {
    return obj[a] && cron.parseExpression(obj[a]);
  } catch (e) {
    throw new Error(
      `Argument ${a} is not a valid cron expression. ${e.message}`
    );
  }
};

const getArgs = () =>
  yargs(process.argv.slice(2))
    .check((yarg) => {
      // assert exclusive or condition for streams
      const exclusiveValid = ["output", "endpoint"].reduce(
        (acc, field) => exclusive(yarg, "streams", field),
        false
      );

      // assert per stream options
      if (yarg.streams) {
        assertArray(yarg, "streams");
        // assert each item inside the stream object
        yarg.streams.forEach((stream) => {
          // required fields
          assertNotNull(stream, "output");
          assertNotNull(stream, "endpoint");
          // optional type checks
          assertType(stream, "output", "string");
          assertType(stream, "output-path", "string");
          assertType(stream, "name", "string");
          assertType(stream, "endpoint", "string");
          assertType(stream, "cue-rollover", "number");
          assertType(stream, "archive-interval", "string");
          assertType(stream, "archive-path", "string");
          assertType(stream, "metadata-interval", "number");
          assertType(stream, "content-type", "string");
          assertCronString(stream, "archive-interval");
        });
      } else {
        // if there is no streams array
        // required fields
        assertNotNull(yarg, "output");
        assertNotNull(yarg, "endpoint");
        // optional type checks
        assertType(yarg, "output", "string");
        assertType(yarg, "name", "string");
        assertType(yarg, "endpoint", "string");
        assertType(yarg, "metadata-interval", "number");
        assertType(yarg, "content-type", "string");
      }

      // assert global options
      assertType(yarg, "cue-rollover", "number");
      assertType(yarg, "archive-interval", "string");
      assertType(yarg, "archive-path", "string");
      assertCronString(yarg, "archive-interval");

      return true;
    })
    .command("record", "Records Icecast stream(s) with metadata", (yargs) =>
      yargs
        .example([
          [
            '$0 record --config "config.json"',
            "Records stream(s) using JSON configuration",
          ],
          [
            '$0 record --endpoint "https://example.com/stream.mp3" --output "stream.mp3"',
            "Saves https://example.com/stream to stream.mp3 and stream.cue",
          ],
        ])
        .options({
          streams: {
            type: "array",
            describe:
              "JSON Array containing a list of streams to record. \nRequired: {endpoint, output} \nOptional: {name, output-path, cue-rollover, date-entries, prepend-date}",
          },
        })
        .epilog(
          "For more information, see https://github.com/eshaz/icecast-metadata-js"
        )
    )
    .command(
      "archive",
      "Records Icecast stream(s) with metadata and archives over a given interval.",
      (yargs) =>
        yargs
          .options({
            "archive-interval": {
              alias: "i",
              describe: "cron expression that sets the archive interval",
              type: "string",
              requiresArg: true,
            },
            "archive-path": {
              alias: "p",
              describe: "File path to save archived streams",
              type: "string",
              requiresArg: true,
            },
            streams: {
              type: "array",
              describe:
                "JSON Array containing a list of streams to archive. \nRequired: {endpoint, output} \nOptional: {name, output-path, archive-interval, archive-path, cue-rollover, date-entries, prepend-date}",
            },
          })
          .group(["archive-interval", "archive-path"], "Options:")
          .example([
            [
              "$0 archive --config config.json",
              "Records and archives the stream(s) using JSON configuration",
            ],
            [
              '$0 archive \\\n-e "https://example.com/stream.mp3" \\\n-o "stream.mp3" \\\n-i "0 */6 * * *" \\\n-p "archived-streams"',
              "Records and archives the stream at minute 0 past every 6th hour",
            ],
          ])
          .epilog(
            "For more information, see https://github.com/eshaz/icecast-metadata-js"
          )
    )
    .config("config", (configPath) => {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    })
    .options({
      output: {
        alias: "o",
        describe: "Output file",
        type: "string",
        requiresArg: true,
      },
      endpoint: {
        alias: "e",
        describe: "Web address of the stream",
        type: "string",
        requiresArg: true,
      },
      name: {
        alias: "n",
        describe:
          "Name of the stream. Overrides the value in the `Icy-Name` header",
        type: "string",
        requiresArg: true,
      },
      "date-entries": {
        alias: "d",
        describe:
          "Add a date to the DATE field of the cue entry (i.e. YYYY-MM-DDTHH:MMZ)",
        type: "boolean",
        default: false,
      },
      "prepend-date": {
        describe:
          "Prepend an ISO date to the TITLE of each cue entry (i.e. YYYY-MM-DDTHH:MM:SS.SSSZ)",
        type: "boolean",
        default: false,
      },
      "cue-rollover": {
        alias: "r",
        describe: "Number of metadata entries before creating a new cue file",
        default: 0,
        type: "number",
        requiresArg: true,
      },
      streams: {
        type: "array",
        describe:
          "JSON Array containing a list of streams to archive. \nRequired: {endpoint, output} \nOptional: {Varies with command}",
      },
      "output-path": {
        describe:
          "Output path to prepend to file output (only useful for for JSON config)",
        type: "string",
        requiresArg: true,
      },
      "metadata-interval": {
        alias: "m",
        describe:
          "Manually specify the metadata interval. Only use when server does not not respond with `Icy-MetaInt`",
        type: "number",
        default: 0,
        requiresArg: true,
      },
      "content-type": {
        alias: "c",
        describe:
          "Manually specify the stream content type. Only use when server does not not respond with `Content-Type`",
        type: "string",
        default: "",
        requiresArg: true,
      },
      "--version": {
        hidden: true,
      },
    })
    .group(["endpoint", "output"], "Options:")
    .group(
      ["name", "cue-rollover", "date-entries", "prepend-date"],
      "Cue Options:"
    )
    .group(["config", "streams", "output-path"], "JSON Options:")
    .group(["metadata-interval", "content-type"], "Advanced Options:")
    .epilog(
      "For more information, see https://github.com/eshaz/icecast-metadata-js"
    )
    .wrap(yargs().terminalWidth()).argv;

export default getArgs;
