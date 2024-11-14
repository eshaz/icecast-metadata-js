import webpack from "webpack";
import TerserPlugin from "terser-webpack-plugin";
import fs from "fs";

const packageJson = JSON.parse(fs.readFileSync("./package.json"));

const license = `
/*! 
 * Copyright 2021-2024 Ethan Halsall
 * https://github.com/eshaz/icecast-metadata-js
 *
 * This file is part of icecast-metadata-player.
 *
 * icecast-metadata-player free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * icecast-metadata-player distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>
 */`;

export default {
  mode: "production",
  devtool: "source-map",
  entry: "/src/IcecastMetadataPlayer.js",
  output: {
    path: new URL("build", import.meta.url).pathname,
    filename: `${packageJson.name}-${packageJson.version}.[name].min.js`,
    library: "IcecastMetadataPlayer",
    libraryExport: "default",
    libraryTarget: "var",
  },
  plugins: [new webpack.ProgressPlugin()],
  resolve: {
    fallback: { util: false },
  },
  module: {
    rules: [],
  },
  optimization: {
    splitChunks: {
      cacheGroups: {
        common: {
          filename: `${packageJson.name}-${packageJson.version}.common.min.js`,
          test: /@wasm-audio-decoders\/common/,
          minSize: 1024,
        },
      },
    },
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          output: {
            preamble: license,
          },
          mangle: {
            properties: {
              regex: /^_/,
            },
          },
        },
      }),
    ],
  },
};
