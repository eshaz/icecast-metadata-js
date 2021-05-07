# Icecast Metadata JS

Icecast Metadata JS is an evolving Javascript based tool set for parsing, recording, and archiving Icecast streams with metadata.

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

## Modules:
 * [**Icecast Metadata JS**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-js#readme) *(click to read more)*
   * Browser and NodeJS module for reading audio and metadata from an Icecast response body
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-js) - Install using `npm i icecast-metadata-js`
   * This module actively used here to display real-time metadata updates: https://dsmrad.io
   * **LICENSE** LGPL 3.0 or Greater
 * [**Icecast Metadata Player**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player#readme) *(click to read more)*
   * Browser Javascript class that plays an Icecast compatible stream with real-time metadata updates.
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-player) - Install using `npm i icecast-metadata-player`
   * **LICENSE** LGPL 3.0 or Greater
 * [**Icecast Metadata Stats**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-stats#readme) *(click to read more)*
   * Browser Javascript class that queries an Icecast compatible server for metadata and statistics.
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-stats) - Install using `npm i icecast-metadata-stats`
   * **LICENSE** LGPL 3.0 or Greater
 * [**Stream Recorder**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/stream-recorder#readme) *(click to read more)*
   * NodeJS based application for recording / archiving Icecast audio and metadata
   * NPM Package coming soon!
   * **LICENSE** GPL 3.0 or Greater
 * [**Demo**](#demo)
   * React application and HTML examples that demonstrate how to use `icecast-metadata-player`

## Troubleshooting
  * [**HTTP and HTTPS Mixed Content**](#http-and-https-mixed-content)
  * [**Cross-Origin Resource Sharing (CORS)**](#cors)

---


# Demo

The Icecast Metadata Reader Demo is a React application that demonstrates how to use `icecast-metadata-js` with the [MediaSource API](https://developer.mozilla.org/en-US/docs/Web/API/MediaSource).

https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo

## View the live demo here: https://eshaz.github.io/icecast-metadata-js/


### Running Locally
* `git clone https://github.com/eshaz/icecast-metadata-js.git`
* `cd src/demo`
* `npm i`
* `npm start` -> Runs a local server on http://localhost:3000


---


# Troubleshooting

## HTTP and HTTPS Mixed Content

Browsers are configured by default to disallow mixed security content when the origin is being served from HTTPS. This means that any requests using HTTP that are being accessed from a HTTPS origin will be blocked and an error will be shown in the browser console. This affects many Icecast streams since the default is to serve a stream via HTTP and not HTTPS.

The simplest and most secure way to fix this is to configure Icecast to serve only over HTTPS. HTTP, unlike HTTPS, is sent in clear text and can be easily intercepted, viewed, and / or modified by any party in between you and the server potentially injecting unwanted data in your request and corrupting your stream. See the [Icecast documentation](https://icecast.org/docs/) for more information on how to configure HTTPS.

### See Also:
* [Why Use HTTPS?](https://www.cloudflare.com/learning/ssl/why-use-https/)
* [MDN Web Docs on Mixed Content](https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content/How_to_fix_website_with_mixed_content)
* [Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
* [How to stop an automatic redirect from “http://” to “https://”](https://superuser.com/questions/565409/how-to-stop-an-automatic-redirect-from-http-to-https-in-chrome)



## CORS

Cross-Origin Response Sharing is a client side security mechanism to prevent scripts from accessing other websites outside of the website the script originated from. Websites can opt-in to CORS by responding with various `Access-Control` headers. Browsers will send an pre-flight `OPTIONS` request to the cross-origin resource when a script attempts to access a cross-origin resource. The actual request will be allowed only if the `OPTIONS` response contains the appropriate `Access-Control` headers.

Read more about CORS here: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

OGG Metadata is not dependent on requesting or reading any headers, but still relies on CORS for reading the response cross-origin.

ICY metadata is dependent on being able to request and read headers (specifically the `Icy-*` headers). If you intend on serving your Icecast stream on a website that is not on the same origin as your Icecast server, you will need to add the below CORS headers.


### CORS configuration for OGG metadata:
* **OGG Metadata will not work in a browser without this configuration.**
```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type'
```

### Bare minimum CORS configuration for ICY metadata:

* **ICY Metadata will not work in a browser without this configuration.**
```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type, Icy-Metadata'
```

### Preferred CORS configuration for ICY metadata:

```
Access-Control-Allow-Origin: '*'
Access-Control-Allow-Methods: 'GET, OPTIONS'
Access-Control-Allow-Headers: 'Content-Type, Icy-Metadata'
Access-Control-Expose-Headers: 'Icy-MetaInt, Icy-Br, Icy-Description, Icy-Genre, Icy-Name, Ice-Audio-Info, Icy-Url, Icy-Sr, Icy-Vbr, Icy-Pub';
```

