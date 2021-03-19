const path = require("path");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const package = require("./package.json");

const license = `
 * Copyright 2021 Ethan Halsall
 * https://github.com/eshaz/icecast-metadata-js
 *
 * This file is part of icecast-metadata-stats.
 *
 * icecast-metadata-stats free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * icecast-metadata-stats distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>
`;

module.exports = {
  mode: "production",
  devtool: "source-map",
  entry: "/src/IcecastMetadataStats.js",
  output: {
    path: __dirname + "/build",
    filename: `${package.name}-${package.version}.min.js`,
    library: "IcecastMetadataStats",
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
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: {
          condition: true,
          banner: () => license,
        },
        terserOptions: {
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
