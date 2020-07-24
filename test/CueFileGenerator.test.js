const CueFileGenerator = require("../src/CueFileGenerator");

const cueGen = new CueFileGenerator({
  title: "testStream",
  fileName: "isics-all.mp3",
});

const addEntries = (totalTime, numEntries, cueGen) => {
  const titles = ["Scanning...", "Police", "Fire", "EMS"];

  const getTime = () => Math.floor(Math.random() * totalTime);
  const getTitle = () => titles[Math.floor(Math.random() * titles.length)];

  new Array(numEntries)
    .fill()
    .map(() => ({ time: getTime(), title: getTitle() }))
    .sort((a, b) => a.time - b.time)
    .forEach(({ time, title }) => cueGen.addEntry(time, title));
};

addEntries(5940000, 1000, cueGen);
