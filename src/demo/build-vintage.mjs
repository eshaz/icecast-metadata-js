
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
    <title>Internet Radio for Vintage Computers!</title>
    <meta
      name="description"
      content="Streaming radio links for old computers. Now IE6 compatible!"
    />
    <link href="title.gif" rel="stylesheet"/>
    <link href="RIBBONS.BMP" rel="stylesheet"/>
    <link href="MARBLE.BMP" rel="stylesheet"/>
    <style>
      html,body {
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
    <div style="border: black 1px solid; max-width: 730px; margin-left: auto; margin-right: auto; background-image: url('MARBLE.BMP'); padding: 5px;">
    <table style="margin: 0;" border="1">
      <colgroup>
          <col width="180px" />
          <col width="410px" />
          <col width="150px" />
      </colgroup>
      <tr>
        <th>Station</th>
        <th>About</th>
        <th>Listen</th>
      </tr>
      <tbody>
      ${stations
        .filter((station) => !station.name.match(/multichannel/i))
        .reduce(getStationRow, "")}
      <tr>
        <td colspan="3">
          <div>
            &nbsp;
          </div>
          <div style="font-size: 14px; text-align: center;"> 
            Get Winamp <a href="http://ftp.zx.net.nz/pub/software/Win32/Media-Player/WinAmp/winamp524_full_emusic-7plus.exe">here (version 5.24)</a> and an Opus decoder <a href="https://github.com/RamonUnch/in_opus/releases">here</a>.
          </div>
          <div style="text-align: right;">
            (c) 2024 <a style="color: white;" href="https://github.com/eshaz">Ethan Halsall</a>
          </div>
        </td>
      </tr>
      </tbody>
    </table>
    </div
  </body>
</html>
`;

const minified = minifyHtml.minify(Buffer.from(html), {});

await fs.promises.writeFile("public/vintage/index.html", minified);