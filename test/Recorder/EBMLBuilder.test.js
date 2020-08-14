const fs = require("fs");
const EBMLBuilder = require("../../src/Recorder/EBMLBuilder");

const ebml = new EBMLBuilder({ title: "My Stream", bitrate: 128 });

const testMP3 = fs.readFileSync("deep-space.mp3");

ebml.addTrack();
ebml.addChapter("my Chapter", 1.2);
ebml.addChapter("my Chapter 2", 5.4);
ebml.addData(testMP3);

fs.writeFileSync("test.ebml", ebml.build());
