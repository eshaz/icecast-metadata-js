# Icecast Metadata JS

Icecast Metadata JS is a collection of Javascript modules for streaming audio playback with metadata.

## Checkout the demos [here](https://eshaz.github.io/icecast-metadata-js/)!

## Modules:
 * [**Icecast Metadata Player**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player#readme) *(click to read more)*
   * Cross-platform browser library that plays Icecast compatible streams with full codec support and real-time metadata updates.
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-player) - Install using `npm i icecast-metadata-player`
   * **LICENSE** LGPL 3.0 or Greater
 * [**Icecast Metadata JS**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-js#readme) *(click to read more)*
   * Browser and NodeJS module for reading audio and metadata from an Icecast response body.
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-js) - Install using `npm i icecast-metadata-js`
   * This module actively used here to display real-time metadata updates: https://dsmrad.io
   * **LICENSE** LGPL 3.0 or Greater
 * [**Icecast Metadata Stats**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-stats#readme) *(click to read more)*
   * Browser Javascript class that queries an Icecast compatible server for metadata and statistics.
   * [NPM Package](https://www.npmjs.com/package/icecast-metadata-stats) - Install using `npm i icecast-metadata-stats`
   * **LICENSE** LGPL 3.0 or Greater
 * [**Stream Recorder**](https://github.com/eshaz/icecast-metadata-js/tree/master/src/stream-recorder#readme) *(click to read more)*
   * NodeJS based application for recording / archiving Icecast audio and metadata.
   * NPM Package coming soon!
   * **LICENSE** GPL 3.0 or Greater

## Troubleshooting
  * [**HTTP and HTTPS Mixed Content**](#http-and-https-mixed-content)
  * [**Cross-Origin Resource Sharing (CORS)**](#cors)

---

# Demo

The Demo is a React application that demonstrates how to use [`icecast-metadata-player`](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player#readme) in a React application in a plain HTML webpage. You can view the demo source code [here](https://github.com/eshaz/icecast-metadata-js/tree/master/src/demo).

## [**React Demo**](https://eshaz.github.io/icecast-metadata-js/)
## [**HTML Demo**](https://eshaz.github.io/icecast-metadata-js/demo.html)
## [**Bare Minimum Demo**](https://eshaz.github.io/icecast-metadata-js/bare-minimum-demo.html)

# Developing Locally

## Requirements
* Latest LTS version of NodeJS
* Unix like shell
  * Linux / MacOS: any shell should work to run npm commands
  * Windows: [Git BASH](https://gitforwindows.org/) is recommended

## Developing with the React Demo

The [`icecast-metadata-player`](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player#readme) module is installed using a relative path and will automatically update with any changes made to the package.

* `git clone https://github.com/eshaz/icecast-metadata-js.git`
* `cd src/demo`
* `npm i`
* `npm start` -> Runs a local server on http://localhost:3000

## Developing with the HTML demos

The HTML demos use the `<script>` tag method to import [`icecast-metadata-player`](https://github.com/eshaz/icecast-metadata-js/tree/master/src/icecast-metadata-player#readme) which is built independently.

* Follow the steps above to run and start the React server.
* Navigate to either of the demo pages
  * [**HTML Demo**](https://eshaz.github.io/icecast-metadata-js/demo.html)
  * [**Bare Minimum Demo**](https://eshaz.github.io/icecast-metadata-js/bare-minimum-demo.html)
* In a new terminal window, run the below commands to install and build `icecast-metadata-player`.
* `cd src/icecast-metadata-player`
* `npm i`
* `npm run build`
* Refresh your browser to pull in the latest changes.
* Each time you make a change, run the `npm run build` and refresh your browser to view the change.
  


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

Ogg Metadata is not dependent on requesting or reading any headers, but still relies on CORS for reading the response cross-origin.

ICY metadata is dependent on being able to request and read headers (specifically the `Icy-*` headers). If you intend on serving your Icecast stream on a website that is not on the same origin as your Icecast server, you will need to add the below CORS headers.


### CORS configuration for Ogg metadata:
* **Ogg Metadata will not work in a browser without this configuration.**
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
Access-Control-Expose-Headers: 'Icy-MetaInt, Icy-Br, Icy-Description, Icy-Genre, Icy-Name, Ice-Audio-Info, Icy-Url, Icy-Sr, Icy-Vbr, Icy-Pub'
```

## Examples of common and invalid CORS configuration
---
### Problem
> Invalid duplication of headers containing `*`. This is caused by a proxy such as Nginx adding additional headers to an otherwise valid CORS configuration. This will prevent any cross origin playback for your stream.
### Fix
> Either the CORS headers added in Icecast, or remove CORS the headers in Nginx.
```
access-control-allow-credentials: *
access-control-allow-credentials: true
access-control-allow-headers: *
access-control-allow-headers: *
access-control-allow-origin: *
access-control-allow-origin: *
```
---

## Example Nginx reverse proxy configuration
```nginx
# Match your stream location(s)
location ~ "^/stream/(stream.mp3|stream.ogg|stream.aac|stream.opus|stream.flac.ogg)$" {
    # Remove all headers from Icecast response
    proxy_hide_header Access-Control-Allow-Origin;
    proxy_hide_header Access-Control-Allow-Methods;
    proxy_hide_header Access-Control-Allow-Headers;
    proxy_hide_header Access-Control-Allow-Credentials;

    # Response to CORS OPTIONS request made by browser
    if ($request_method = 'OPTIONS') {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET,OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'Icy-Metadata';
        return 204;
    }

    # Add CORS headers for stream GET response
    add_header 'Access-Control-Allow-Origin' '*';
    add_header 'Access-Control-Allow-Methods' 'GET';
    add_header 'Access-Control-Allow-Headers' 'Icy-Metadata';
    add_header 'Access-Control-Expose-Headers' 'Icy-MetaInt,Icy-Br,Icy-Description,Icy-Genre,Icy-Name,Ice-Audio-Info,Icy-Url';

    resolver 1.1.1.1;
    proxy_pass https://icecast-server.example.com:8443/$1
}
```