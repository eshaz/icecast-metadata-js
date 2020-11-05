import Header from "./Header";
import Frame from "./Frame";

export default class MPEGParser {
  constructor() {
    this._headers = new Map();
  }

  _getHeader(buffer) {
    if (buffer.length >= 4) {
      const key = String.fromCharCode.apply(null, buffer.subarray(0, 4));

      if (this._headers.has(key)) {
        //console.log("getting header from cache");
        return this._headers.get(key);
      } else {
        const header = Header.getHeader(buffer);
        if (header) {
          console.log(header);

          this._headers.set(key, header);
          return header;
        }
      }
    }
  }

  /**
   * @description Finds and returns an MPEG frame. Frame will be null if no frame was found in the data.
   * @param {Uint8Array} data MPEG data
   * @param {number} offset Offset where frame should be
   * @returns {object} Object containing the actual offset and frame.
   */
  readFrame(data, offset = 0) {
    let header = this._getHeader(data.subarray(offset));

    while (!header && offset + 4 < data.length) {
      offset++;
      header = this._getHeader(data.subarray(offset));
    }

    if (header && offset + header.frameByteLength + 4 <= data.length) {
      const nextHeader = this._getHeader(
        data.subarray(offset + header.frameByteLength)
      );
      if (nextHeader) {
        return {
          offset,
          frame: new Frame(
            header,
            data.subarray(offset, offset + header.frameByteLength)
          ),
        };
      } else {
        console.log("no next header");
        return {
          offset: offset + header.frameByteLength + 4,
        };
      }
    }

    return {
      offset,
    };
  }
}
