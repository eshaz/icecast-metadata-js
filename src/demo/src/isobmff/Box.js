export default class Box {
  constructor(name) {
    this._name = name;
    this._contents = Uint8Array.from(Box.getName(name));
    this._boxes = [];
  }

  static LENGTH_SIZE = 4;

  static getName(name) {
    const array = [];
    for (const char of name) {
      array.push(char.charCodeAt(0));
    }
    return Uint8Array.from(array);
  }

  static getUint32(number) {
    const bytes = new Uint8Array(4);
    new DataView(bytes.buffer).setUint32(0, number, false);
    return bytes;
  }

  get length() {
    return this._boxes.reduce(
      (acc, box) => acc + box.length,
      Box.LENGTH_SIZE + this._contents.length
    );
  }

  get contents() {
    const contents = [
      ...this._contents,
      ...this._boxes.flatMap((box) => [...box.contents]),
    ];

    return Uint8Array.from([
      ...Box.getUint32(Box.LENGTH_SIZE + contents.length),
      ...contents,
    ]);
  }

  addBox(box) {
    if (box.constructor !== Box) {
      console.error("Only an object of type Box can be appended");
      throw new Error("Not a box");
    }

    this._boxes.push(box);
  }

  insertBytes(data, idx) {
    const insertOffset = idx + 4;
    this._contents = Uint8Array.from([
      ...this._contents.subarray(0, insertOffset),
      ...data,
      ...this._contents.subarray(insertOffset),
    ]);
  }

  appendBytes(data) {
    this._contents = Uint8Array.from([...this._contents, ...data]);
  }
}
