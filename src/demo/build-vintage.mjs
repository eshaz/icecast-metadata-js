
import fs from "fs";
import minifyHtml from "@minify-html/node";
import stations from "./src/stations.json" assert { "type": "json" };

const buildPlaylist = (endpoint) => 
    (Array.isArray(endpoint)
        ? endpoint.reduce((acc, endpoint) => acc + endpoint + "\n", "")
        : endpoint)
    .replaceAll("https", "http");

const getColor = (codec) => {
    if (codec.match(/opus/i)) return "magenta";
    if (codec.match(/vorbis/i)) return "green";
    if (codec.match(/aac/i)) return "red";
    if (codec.match(/flac/i)) return "blue";
    if (codec.match(/mp3/i)) return "yellow";
    return "yellow";
}

const getStationRow = (acc, station) => {
    const maxCharacters = 25;
    let totalCharacters = 0;
    return acc + `
        <tr>
          <td style="color: lime">${station.name}</td>
          <td>${station.description}</td>
          <td>${station.endpoints.reduce(
            (acc, endpoint, idx) => {
                const playlist = buildPlaylist(endpoint.endpointHttp || endpoint.endpoint);
                const playlistName = `${station.name.replace("/", "").replace("'", "")} ${endpoint.codec ?? ""}.m3u`;
                fs.writeFileSync(`public/vintage/${playlistName}`, playlist, {encoding: 'binary'});

                totalCharacters += endpoint.codec.length;

                let separator = "";
                if (idx !== station.endpoints.length - 1) {
                  separator = "|";
                  totalCharacters++;
                }

                let br = "";
                if (totalCharacters > maxCharacters) {
                  br = "<br>";
                  totalCharacters = endpoint.codec.length;
                }

                return acc + `${br}<a style="color: ${getColor(endpoint.codec)};" download href="${encodeURI(playlistName)}">${endpoint.codec}</a>${separator}`
            }, "")
          }
          </td>
        </tr>`
}

const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=800" />
    <meta property="og:title" content="Internet Radio for Vintage Computers!" />
    <meta property="og:image" content="IE6.PNG" />
    <title>Internet Radio for Vintage Computers!</title>
    <meta
      name="description"
      content="Streaming radio links for old computers. Now IE6 compatible!"
    />
    <link rel="icon" type="image/ico" href="favicon.ico"/>
    <link rel="shortcut icon" type="image/ico" href="favicon.ico"/>
    <link href="title.gif" rel="stylesheet"/>
    <link href="RIBBONS.BMP" rel="stylesheet"/>
    <link href="MARBLE.BMP" rel="stylesheet"/>
    <style>
      html {
        image-rendering: -moz-crisp-edges;
        image-rendering: -o-crisp-edges;
        image-rendering: -webkit-optimize-contrast;
        image-rendering: pixelated;
        -ms-interpolation-mode: nearest-neighbor;
        text-size-adjust: none;
        -webkit-text-size-adjust: none;
        -ms-text-size-adjust: none;
        -moz-text-size-adjust: none;
      }
      body {
        font: 10px monospace;
        color: white;
        background-color: black;
        background-image: url("RIBBONS.BMP");
        background-size: 40%;
      }
      table {
        border-collapse: collapse;
        background-color: black;
      }
    </style>
    <script>
      // prevent ie from showing an error since this modern js is not supported
      try {
        window.onload = () => {
          const resizeObserver = new ResizeObserver((entries) => document.body.style.zoom = Math.min(window.innerWidth / 800 * 100, 300) + "%");
          resizeObserver.observe(document.body);
        }
      } catch {}
    </script>
  </head>
  <body>
    <div style="text-align: center;">
      <img src="title.gif" alt="Internet Radio for vintage computers!"/>
    </div>
    <div style="border: black 1px solid; max-width: 775px; margin-left: auto; margin-right: auto; background-image: url('MARBLE.BMP'); padding: 5px;">
    <table style="margin: 0; margin-left: auto; margin-right: auto;" border="1">
      <colgroup>
        <col width="200px" />
        <col width="420px" />
        <col width="150px" />
      </colgroup>
      <tr>
        <th>Station</th>
        <th>About</th>
        <th><a style="color: white; text-decoration: none;" href="#listen">Listen<span style="color: yellow;">*</span></a></th>
      </tr>
      <tbody>
        ${stations
          .filter((station) => !station.name.match(/multichannel/i))
          .reduce(getStationRow, "")}
        <tr id="listen">
          <td style="border: 0; font-size: 14px; text-align: center; padding: 7px 0 5px; color: yellow;" colspan="3">
            <b>*</b>Windows 95/98: download <a style="color: yellow;" href="http://ftp.zx.net.nz/pub/software/Win32/Media-Player/WinAmp/winamp524_full_emusic-7plus.exe">Winamp (version 5.24)</a> and install this <a style="color: yellow;" href="https://github.com/RamonUnch/in_opus/releases">Opus decoder</a>
          </td>
        </tr>
        <tr>
          <td style="border: 0;">
          <td style="border: 0; text-align: center;">
            <a style="color: white; font-size: 9px;" href="https://github.com/eshaz/icecast-metadata-js/blob/master/src/demo/build-vintage.mjs">Source code for this webpage</a>
          </td>
          <td style="border: 0; text-align: right;">
            (c) 2024 <a style="color: white;" href="https://github.com/eshaz">Ethan Halsall</a>
          </td>
        </tr>
      </tbody>
    </table>
    </div>
  </body>
</html>
`;

const minified = minifyHtml.minify(Buffer.from(html), {});

await fs.promises.writeFile("public/vintage/index.html", minified);