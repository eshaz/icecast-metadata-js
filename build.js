const minify = require("@node-minify/core");
const terser = require("@node-minify/terser");

minify({
  compressor: terser,
  options: {
    compress: {
      passes: 2,
    },
    /*
    mangle: {
      properties: {
        regex: /_./
      }
    }
    */
  },
  input: "test/IcecastMetadataRecorder.test.js",
  output: "IcecastMetadataRecorderTest.js",
  callback: function (err, min) {},
});
