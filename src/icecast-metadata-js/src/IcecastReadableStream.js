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

//import IcecastMetadataReader from "./IcecastMetadataReader";
import OggMetadataParser from "./MetadataParser/OggMetadataParser";
import IcyMetadataParser from "./MetadataParser/IcyMetadataParser";

const noOp = () => {};

/**
 * @description Browser ReadableStream wrapper for IcecastMetadataReader
 * @extends ReadableStream
 */
export default class IcecastReadableStream extends ReadableStream {
  /**
   *
   * @param {ReadableStream} response ReadableStream for raw Icecast response data
   * @param {object} options Configuration options for IcecastMetadataReader
   * @see IcecastMetadataReader for information on the options parameter
   */
  constructor(
    response,
    { icyMetaInt, icyDetectionTimeout, onStream = noOp, onMetadata }
  ) {
    const readerIterator = IcecastReadableStream.asyncIterator(response.body);

    super({
      async start(controller) {
        const icecast = new OggMetadataParser({
          icyMetaInt:
            parseInt(response.headers.get("Icy-MetaInt")) || icyMetaInt,
          icyDetectionTimeout,
          onMetadata,
          onStream: (value) => {
            controller.enqueue(value.stream);
            return onStream(value);
          },
        });

        for await (const chunk of readerIterator) {
          await icecast.asyncReadAll(chunk);
        }

        controller.close();
      },
    });
  }

  /**
   * @description Creates an async iterator from this ReadableStream.
   * @returns {Symbol.asyncIterator} Async Iterator for this ReadableStream.
   */
  async startReading() {
    for await (const i of IcecastReadableStream.asyncIterator(this)) {
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
