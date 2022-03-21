import TerserPlugin from "terser-webpack-plugin";

export default {
  mode: "production",
  externals: {
    fs: "commonjs2 fs",
    path: "commonjs2 path",
  },
  entry: new URL("src/StreamRecorder.js", import.meta.url).pathname,
  output: {
    path: new URL("dist", import.meta.url).pathname,
    filename: "recorder.cjs",
  },
  optimization: {
    concatenateModules: false,
    minimize: false,
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
