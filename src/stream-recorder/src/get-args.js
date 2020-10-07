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

const fs = require("fs");
const argv = require("yargs");
const cron = require("cron-parser");

const exclusive = (obj, a, b) => {
  if (!(obj[a] || obj[b])) {
    throw new Error(`Arguments ${a} or ${b} are required`);
  } else if (obj[a] && obj[b]) {
    throw new Error(`Arguments ${a} and ${b} are mutually exclusive`);
  }
  return true;
};

const assertType = (obj, a, type) => {
  if (obj[a] && typeof obj[a] !== type) {
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
  argv
    .check((argv) => {
      // assert exclusive or condition for streams
      const exclusiveValid = ["output", "endpoint"].reduce(
        (acc, field) => exclusive(argv, "streams", field),
        false
      );

      if (argv.streams) {
        assertArray(argv, "streams");
        // assert each item inside the stream object
        argv.streams.forEach((stream) => {
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
          assertCronString(stream, "archive-interval");
        });
      } else {
        // required fields
        assertNotNull(argv, "output");
        assertNotNull(argv, "endpoint");
        // optional type checks
        assertType(argv, "output", "string");
        assertType(argv, "name", "string");
        assertType(argv, "endpoint", "string");
      }

      assertType(argv, "cue-rollover", "number");
      assertType(argv, "archive-interval", "string");
      assertType(argv, "archive-path", "string");
      assertCronString(argv, "archive-interval");

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
    )
    .command(
      "archive",
      "Records Icecast stream(s) with metadata and archives over a given interval.",
      (yargs) =>
        yargs
          .options({
            "archive-interval": {
              alias: "i",
              describe: "cron expression that set the archive interval",
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
          "Name of the stream. Overrides the value in the `icy-name` header",
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
      "output-path": {
        describe:
          "Output path to prepend to file output (only useful for for JSON config)",
        type: "string",
        requiresArg: true,
      },
      "--version": {
        hidden: true,
      },
    })
    .wrap(argv.terminalWidth()).argv;

module.exports = getArgs;
