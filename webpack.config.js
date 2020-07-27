const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  externals: {
    fs: "commonjs fs",
  },
  entry: __dirname + "/test/IcecastMetadataRecorder.test.js",
  output: {
    path: __dirname + "/dist",
    filename: "recorder.js",
  },
  optimization: {
    concatenateModules: false,
    minimize: true,
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: {
            passes: 5,
          },
          keep_classnames: true,
        },
      }),
    ],
  },
  target: "node",
};
