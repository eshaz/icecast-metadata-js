const CueBuilder = require("../../src/Recorder/CueBuilder");

describe("Cue Builder", () => {
  describe("Start Cue File", () => {
    it("should start a new cue file when instantiated", () => {
      const cueBuilder = new CueBuilder(
        {
          title: "someTitle",
          performer: "somePerformer",
        },
        ["a comment", "another comment"]
      );

      const string = cueBuilder.read();

      // prettier-ignore
      const expectedString = 
`REM a comment
REM another comment
TITLE "someTitle"
PERFORMER "somePerformer"`;

      expect(string.toString()).toEqual(expectedString);
    });

    describe("File Logic", () => {
      it("should add a file to the start when passed in", () => {
        const cueBuilder = new CueBuilder(
          {
            title: "someTitle",
            performer: "somePerformer",
            file: "some-file.mp3",
          },
          ["a comment", "another comment"],
          "AIFF"
        );

        const string = cueBuilder.read();

        // prettier-ignore
        const expectedString = 
`REM a comment
REM another comment
TITLE "someTitle"
PERFORMER "somePerformer"
FILE "some-file.mp3" AIFF`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should default to WAVE if the filetype is not passed in", () => {
        const cueBuilder = new CueBuilder(
          {
            title: "someTitle",
            performer: "somePerformer",
            file: "some-file.mp3",
          },
          ["a comment", "another comment"]
        );

        const string = cueBuilder.read();

        // prettier-ignore
        const expectedString = 
`REM a comment
REM another comment
TITLE "someTitle"
PERFORMER "somePerformer"
FILE "some-file.mp3" WAVE`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should default to WAVE if the filetype is not validfor a cue file", () => {
        const cueBuilder = new CueBuilder(
          {
            title: "someTitle",
            performer: "somePerformer",
            file: "some-file.flac",
          },
          ["a comment", "another comment"],
          "FLAC"
        );

        const string = cueBuilder.read();

        // prettier-ignore
        const expectedString = 
`REM a comment
REM another comment
TITLE "someTitle"
PERFORMER "somePerformer"
FILE "some-file.flac" WAVE`;

        expect(string.toString()).toEqual(expectedString);
      });
    });

    describe("Comments vs Entries", () => {
      it("should pass in valid disc level entries and others as comments", () => {
        const cueBuilder = new CueBuilder(
          {
            title: "someTitle",
            performer: "somePerformer",
            songwriter: "A Songwriter",
            catalog: "asdbc1321654",
            album: "My Album",
            date: "1/1/2020",
          },
          ["a comment", "another comment"]
        );

        const string = cueBuilder.read();

        // prettier-ignore
        const expectedString = 
`REM a comment
REM another comment
REM ALBUM "My Album"
REM DATE "1/1/2020"
TITLE "someTitle"
PERFORMER "somePerformer"
SONGWRITER "A Songwriter"
CATALOG "asdbc1321654"`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should pass anything in the comments array as a comment", () => {
        const cueBuilder = new CueBuilder(
          {
            title: "someTitle",
            performer: "somePerformer",
            songwriter: "A Songwriter",
            catalog: "asdbc1321654",
          },
          ["a comment", "TITLE another title", "My very own cue file"]
        );

        const string = cueBuilder.read();

        // prettier-ignore
        const expectedString = 
`REM a comment
REM TITLE another title
REM My very own cue file
TITLE "someTitle"
PERFORMER "somePerformer"
SONGWRITER "A Songwriter"
CATALOG "asdbc1321654"`;

        expect(string.toString()).toEqual(expectedString);
      });
    });
  });

  describe("Tracks", () => {
    let cueBuilder, expectedString;

    beforeEach(() => {
      cueBuilder = new CueBuilder(
        {
          title: "someTitle",
          performer: "somePerformer",
        },
        ["a comment", "another comment"]
      );

      // prettier-ignore
      expectedString = 
`REM a comment
REM another comment
TITLE "someTitle"
PERFORMER "somePerformer"`;
    });

    describe("Add Track", () => {
      it("should add a track", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          0
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should add another track and increment the track number", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          0
        );

        cueBuilder.addTrack(
          {
            title: "Another Track",
            performer: "My Performer 2",
          },
          10
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00
  TRACK 2 AUDIO
    TITLE "Another Track"
    PERFORMER "My Performer 2"
    INDEX 01 00:10:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should return the total number of tracks give the get trackCount is called", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          0
        );

        cueBuilder.addTrack(
          {
            title: "Another Track",
            performer: "My Performer 2",
          },
          10
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00
  TRACK 2 AUDIO
    TITLE "Another Track"
    PERFORMER "My Performer 2"
    INDEX 01 00:10:00`;

        expect(cueBuilder.trackCount).toEqual(2);
      });
    });

    describe("File Logic", () => {
      it("should add a file to the track", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
            file: "Track 1.mp3",
          },
          0,
          [],
          "MP3"
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" MP3
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should default to WAVE for the filetime is not passed in", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
            file: "Track 1.mp3",
          },
          0,
          []
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" WAVE
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should default to WAVE given the filetype passed in is not valid", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
            file: "Track 1.mp3",
          },
          0,
          [],
          "MIDI"
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" WAVE
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should add a file for each track that is entered with the file parameter set", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
            file: "Track 1.mp3",
          },
          0
        );
        cueBuilder.addTrack(
          {
            title: "An AIFF Track",
            performer: "My Performer 2",
          },
          75,
          [],
          "AIFF"
        );
        cueBuilder.addTrack(
          {
            title: "Another AIFF Track",
            performer: "My Performer 2",
            file: "sound2.aiff",
          },
          465,
          [],
          "AIFF"
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" WAVE
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:00:00
  TRACK 2 AUDIO
    TITLE "An AIFF Track"
    PERFORMER "My Performer 2"
    INDEX 01 01:15:00
FILE "sound2.aiff" AIFF
  TRACK 3 AUDIO
    TITLE "Another AIFF Track"
    PERFORMER "My Performer 2"
    INDEX 01 07:45:00`;

        expect(string.toString()).toEqual(expectedString);
      });
    });

    describe("Comments vs Entries", () => {
      it("should pass in valid track level entries and others as comments", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
            file: "Track 1.mp3",
            irsc: "1321654",
            songwriter: "I write Music",
            replaygain: "12db",
            date: "1/1/2019",
          },
          0,
          [],
          "MP3"
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" MP3
  TRACK 1 AUDIO
    REM IRSC "1321654"
    REM REPLAYGAIN "12db"
    REM DATE "1/1/2019"
    TITLE "My Track"
    PERFORMER "My Performer"
    SONGWRITER "I write Music"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should pass in anything in the comments array as a comment", () => {
        cueBuilder.addTrack(
          {
            Title: "My Track",
            Performer: "My Performer",
            File: "Track 1.mp3",
            Irsc: "1321654",
            Songwriter: "I write Music",
            Replaygain: "12db",
            Date: "1/1/2019",
          },
          0,
          ['title "Some Title"', "Am I a Comment?"],
          "MP3"
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
FILE "Track 1.mp3" MP3
  TRACK 1 AUDIO
    REM title "Some Title"
    REM Am I a Comment?
    REM IRSC "1321654"
    REM REPLAYGAIN "12db"
    REM DATE "1/1/2019"
    TITLE "My Track"
    PERFORMER "My Performer"
    SONGWRITER "I write Music"
    INDEX 01 00:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });
    });

    describe("Time Formatting", () => {
      it("should put CD frames (75 per second) into the frames", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          1.4567
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:01:34`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should round up to the next second if greater than or equal to 74.5 frames", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          1.994
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:02:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should round down if less than or equal to 74.4 frames", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          1.993
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 00:01:74`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should roll over to 1:00 when 60 seconds", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          60
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 01:00:00`;

        expect(string.toString()).toEqual(expectedString);
      });

      it("should not roll over for any number of minutes", () => {
        cueBuilder.addTrack(
          {
            title: "My Track",
            performer: "My Performer",
          },
          10001234
        );
        const string = cueBuilder.read();

        // prettier-ignore
        expectedString += `
  TRACK 1 AUDIO
    TITLE "My Track"
    PERFORMER "My Performer"
    INDEX 01 166687:14:00`;

        expect(string.toString()).toEqual(expectedString);
      });
    });
  });
});
