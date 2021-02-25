/* Copyright 2020 Ethan Halsall
    This file is part of icecast-metadata-js.

    icecast-metadata-js free software: you can redistribute it and/or modify
    it under the terms of the GNU Lesser General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    icecast-metadata-js distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Lesser General Public License for more details.

    You should have received a copy of the GNU Lesser General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>
*/

const IcecastMetadataReader = require("./IcecastMetadataReader");

const noOp = () => {};

/**
 * @description Browser ReadableStream wrapper for IcecastMetadataReader
 */
class IcecastReadableStream {
  /**
   * @param {ReadableStream} response ReadableStream for raw Icecast response data
   * @param {object} options Configuration options for IcecastMetadataReader
   * @see IcecastMetadataReader for information on the options parameter
   */
  constructor(response, { icyMetaInt, onStream = noOp, ...rest }) {
    let icecast;

    this._readableStream = new ReadableStream({
      async start(controller) {
        icecast = new IcecastMetadataReader({
          ...rest,
          icyMetaInt:
            parseInt(response.headers.get("Icy-MetaInt")) || icyMetaInt,
          onStream: async (value) => {
            controller.enqueue(value.stream);
            return onStream(value);
          },
        });

        for await (const chunk of IcecastReadableStream.asyncIterator(response.body)) {
          await icecast.asyncReadAll(chunk);
        }

        controller.close();
      },
    });

    this._icecast = icecast;
  }

  get icyMetaInt() {
    return this._icecast.icyMetaInt;
  }

  /**
   * @description Creates an async iterator from this ReadableStream.
   * @returns {Symbol.asyncIterator} Async Iterator for this ReadableStream.
   */
  async startReading() {
    for await (const i of IcecastReadableStream.asyncIterator(
      this._readableStream
    )) {
    }
  }

  /**
   * @description Wraps a ReadableStream as an Async Iterator.
   * @param {ReadableStream} readableStream ReadableStream to convert to AsyncIterator
   * @returns {Symbol.asyncIterator} Async Iterator that wraps the ReadableStream
   */
  static asyncIterator(readableStream) {
    const reader = readableStream.getReader();
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => reader.read(),
      }),
    };
  }
}

module.exports = IcecastReadableStream;
