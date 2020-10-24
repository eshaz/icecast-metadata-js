import IcecastMetadataReader from "./IcecastMetadataReader";

const noOp = () => {};

export default class IcecastReadableStream extends ReadableStream {
  constructor(response, { icyMetaInt, onStream = noOp, onMetadata }) {
    const readerIterator = IcecastReadableStream.asyncIterator(response.body);

    super({
      async start(controller) {
        const icecast = new IcecastMetadataReader({
          icyMetaInt:
            parseInt(response.headers.get("Icy-MetaInt")) || icyMetaInt,
          onMetadata,
          onStream: (value) => {
            controller.enqueue(value.stream);
            return onStream(value);
          },
        });

        for await (const chunk of readerIterator) {
          for await (let i of icecast.asyncIterator(chunk)) {
          }
        }

        controller.close();
      },
    });
  }

  asyncIterator() {
    return IcecastReadableStream.asyncIterator(this);
  }

  static asyncIterator(readableStream) {
    const reader = readableStream.getReader();
    return {
      [Symbol.asyncIterator]: () => ({
        next: () => reader.read(),
      }),
    };
  }
}
