const Box = require("./Box");

class ElementaryStreamDescriptor extends Box {
  constructor() {
    super("esds", {
      contents: [0x00, 0x00, 0x00, 0x00],
    });
  }
}
