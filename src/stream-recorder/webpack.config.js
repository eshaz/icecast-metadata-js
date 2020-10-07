const TerserPlugin = require("terser-webpack-plugin");

module.exports = {
  externals: {
    fs: "commonjs fs",
    path: "commonjs path",
  },
  entry: __dirname + "/src/StreamRecorder/StreamRecorder.js",
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
  node: {
    global: false,
    __filename: false,
    __dirname: false,
  },
};
