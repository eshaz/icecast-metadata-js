/* eslint-disable */
import {
  WorkerAudioContext,
  WorkerSourceNode,
  fftData,
} from "./WorkerAudioContext";

globalThis.window = globalThis;
globalThis.Image = function () {};
globalThis.document = {
  createElement: (type) => {
    switch (type) {
      case "canvas":
        return {
          getContext: () => {},
        };
    }
  },
};
globalThis.equal = function equal(x, y) {
  return Math.abs(x - y) < 0.00001 ? 1 : 0;
};
globalThis.mod = function mod(x, y) {
  if (y === 0) {
    return 0;
  }

  var z = Math.floor(x) % Math.floor(y);
  return z;
};

const worker = async () => {
  const butterchurn = (await import("butterchurn")).default;
  const butterchurnPresets = (await import("butterchurn-presets")).default;

  let visualizer, canvas;
  const audioContext = new WorkerAudioContext();

  self.onmessage = ({ data }) => {
    switch (data.operation) {
      case "render": {
        visualizer.render();
        break;
      }
      case "createVisualizer": {
        canvas = data.canvas;
        canvas.width = data.innerWidth;
        canvas.height = data.innerHeight;

        visualizer = butterchurn.createVisualizer(audioContext, data.canvas, {
          width: data.innerWidth,
          height: data.innerHeight,
          pixelRatio: data.devicePixelRatio || 1,
          textureRatio: 1,
        });
        break;
      }
      case "setByteTimeDomainData": {
        fftData.set(data.thisRef, data.fftData);
        break;
      }
      case "loadPreset": {
        const presets = butterchurnPresets.getPresets();
        visualizer.loadPreset(presets[data.preset]);
        break;
      }
      case "connectAudio": {
        const sourceNode = new WorkerSourceNode();
        self.postMessage({
          operation: "addSource",
          thisRef: sourceNode.ref,
        });

        visualizer.connectAudio(sourceNode);
        break;
      }
      case "setRendererSize": {
        canvas.width = data.innerWidth;
        canvas.height = data.innerHeight;

        visualizer.setRendererSize(data.innerWidth, data.innerHeight);
        break;
      }
      default: {
        console.log("Unknown message...", data);
      }
    }
  };
};

worker();
