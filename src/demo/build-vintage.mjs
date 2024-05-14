
import fs from "fs";
import minifyHtml from "@minify-html/node";
import stations from "./src/stations.json" assert { "type": "json" };

const buildPlaylist = (endpoint) => 
    (Array.isArray(endpoint)
        ? endpoint.reduce((acc, endpoint) => acc + endpoint + "\n", "")
        : endpoint)
    .replaceAll("https", "http");

const getColor = (codec) => {
    if (codec.match(/mp3/i)) return "yellow";
    if (codec.match(/opus/i)) return "magenta";
    if (codec.match(/vorbis/i)) return "green";
    if (codec.match(/aac/i)) return "red";
    if (codec.match(/flac/i)) return "blue";
}

const getStationRow = (acc, station) => {
    return acc + `
        <tr>
          <td style="color: lime">${station.name}</td>
          <td>${station.description}</td>
          <td>${station.endpoints.map(
            (endpoint) => {
                const playlist = buildPlaylist(endpoint.endpointHttp || endpoint.endpoint);
                const playlistName = `${station.name.replace("/", "")} ${endpoint.codec ?? ""}.m3u`;
                fs.writeFileSync(`public/vintage/${playlistName}`, playlist, {encoding: 'binary'});

                return `<a download href="${playlistName}"><b style="color: ${getColor(endpoint.codec)}">${endpoint.codec}</b></a>`
            })
            .join("|")
          }
          </td>
        </tr>`
}

const html = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Stream Links</title>
    <meta
      name="description"
      content="Vintage Streaming"
    />
    <link href="RIBBONS.BMP" rel="stylesheet"/>
    <link href="title.gif" rel="stylesheet"/>
    <style>
      @font-face {
        font-family: mono outline;
        font-style: normal;
        font-weight: normal;
        src: url(Taurus-Mono-Outline-Regular.eot);
        src: url(Taurus-Mono-Outline-Regular.eot?#iefix),
             url(Taurus-Mono-Outline-Regular.ttf);
      }
      body {
        font: 11px monospace;
        color: white;
        background-color: black;
        background-image: url("RIBBONS.BMP");
      }
      table {
        border-collapse: collapse;
        background-color: black;
      }
    </style>
  </head>
  <body>
    <div style="text-align: center;" >
      <img src="title.gif" alt="Internet Radio for vintage computers!"/>
    </div>
    <table border="1">
      <colgroup>
          <col width="200px" />
          <col />
          <col width="50px"/>
      </colgroup>
      <tr>
        <td style="text-align: center;" colspan="3">
          Get Winamp <a href="http://ftp.zx.net.nz/pub/software/Win32/Media-Player/WinAmp/winamp524_full_emusic-7plus.exe">here (version 5.24)</a> and an Opus decoder <a href="https://github.com/RamonUnch/in_opus/releases">here</a>.
        </td>
      </tr>
      <tr>
        <th>Station</th>
        <th>About</th>
        <th>Listen</th>
      </tr>
      <tbody>
      ${stations.reduce(getStationRow, "")}
      </tbody>
    </table>
  </body>
</html>
`;

const minified = minifyHtml.minify(Buffer.from(html), {});

await fs.promises.writeFile("public/vintage/index.html", minified);