import IcecastMetadataReader from "./icecast/metadata-js/IcecastMetadataReader";

class IcecastReadableStream extends ReadableStream {
  constructor(response, icyMetaInt) {
    const reader = response.body.getReader();
    const readerIterator = {
      [Symbol.asyncIterator]: () => ({
        next: () => reader.read(),
      }),
    };

    super({
      async start(controller) {
        const icecast = new IcecastMetadataReader({
          icyMetaInt: 16000,
          onMetadata: ({ metadata }) => {
            console.log(metadata);
          },
          onStream: ({ stream }) => {
            controller.enqueue(stream);
            console.log("streaming");
          },
        });

        for await (const chunk of readerIterator) {
          icecast.readAll(chunk);
        }

        controller.close();
      },
    });
  }
}

self.addEventListener("fetch", (event) => {
  if (event.request.method === "GET") {
    const request = new Request(event.request.url, {
      headers: {
        "Icy-Metadata": "1",
      },
    });

    const res = fetch(request).then((res) => {
      console.log(res.headers.get("content-type"));
      if (res.headers.get("content-type") === "audio/mpeg") {
        return new Response(new IcecastReadableStream(res), {
          headers: res.headers,
        });
      }

      return res;
    });

    event.respondWith(res);
  }
});
