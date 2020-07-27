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
    .config("config", (configPath) => {
      return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    })
    .check((argv) => {
      // assert exclusive or condition for streams ^ (endpoint, output, name)
      const exclusiveValid = ["endpoint", "output", "name"].reduce(
        (acc, field) => exclusive(argv, "streams", field),
        false
      );

      if (argv.streams) {
        assertArray(argv, "streams");
        // assert each item inside the stream object
        argv.streams.forEach((stream) => {
          // required fields
          assertNotNull(stream, "output");
          assertNotNull(stream, "name");
          assertNotNull(stream, "endpoint");
          // optional type checks
          assertType(stream, "output", "string");
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
        assertNotNull(argv, "name");
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
    .command("record", "Records an Icecast stream with metadata", (yargs) =>
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
              "JSON Array containing a list of streams to record. \nRequired: {endpoint, output, name} \nOptional: {cue-rollover}",
          },
        })
    )
    .command(
      "archive",
      "Records an Icecast stream with metadata and archives over a given interval.",
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
                "JSON Array containing a list of streams to archive. \nRequired: {endpoint, output, name} \nOptional: {archive-interval, archive-path, cue-rollover}",
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
        describe: "Name of the stream",
        requiresArg: true,
      },
      "cue-rollover": {
        alias: "r",
        describe: "Number of metadata entries before creating a new cue file",
        default: 0,
        type: "number",
        requiresArg: true,
      },
      "--version": {
        hidden: true,
      },
    })
    .wrap(argv.terminalWidth()).argv;

module.exports = getArgs;
