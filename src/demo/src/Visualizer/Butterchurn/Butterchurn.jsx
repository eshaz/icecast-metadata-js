import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styles from "./Butterchurn.module.css";

const Butterchurn = ({ sourceNode }) => {
  const canvas = useRef();

  const [butterchurnWorker, setButterchurnWorker] = useState();
  const [presetsList] = useState([
    "Cope - The Neverending Explosion of Red Liquid Fire", // good but too active
    "cope + martin - mother-of-pearl",
    "fiShbRaiN + Flexi - witchcraft 2.0",
    "Flexi + Martin - cascading decay swing",
    "Flexi + stahlregen - jelly showoff parade",
    "flexi - bouncing balls [double mindblob neon mix]",
    "Flexi - mindblob [shiny mix]",
    "Flexi - predator-prey-spirals",
    "Flexi - truly soft piece of software - this is generic texturing (Jelly) ", // good
    "Flexi, fishbrain, Geiss + Martin - tokamak witchery", // too bright for text
    "Flexi, martin + geiss - dedicated to the sherwin maxawow", // good but too active
    "Geiss - Cauldron - painterly 2 (saturation remix)", // good
    "martin - castle in the air", // low key
    "martin - mandelbox explorer - high speed demo version", // low key
  ]);
  //const [preset, setPreset] = useState(0);

  useEffect(() => {
    if (sourceNode) {
      const butterchurnWorker = new Worker(
        new URL("./butterchurn-worker/butterchurn-worker.js", import.meta.url),
      );
      setButterchurnWorker(butterchurnWorker);

      const currentCanvas =
        "OffscreenCanvas" in window
          ? canvas.current.transferControlToOffscreen()
          : canvas.current;

      const audioContext = sourceNode.context;
      const references = new Map();
      references.set(0, audioContext);

      butterchurnWorker.onmessage = ({ data }) => {
        let thisRef = references.get(data.thisRef);
        let thatRef;

        if (data.operation === "addSource") {
          thisRef = sourceNode;
          references.set(data.thisRef, sourceNode);
        }

        if (data.operation === "getByteTimeDomainData") {
          const uint8Array = new Uint8Array(data.args);

          thisRef.getByteTimeDomainData(uint8Array);
          butterchurnWorker.postMessage(
            {
              operation: "setByteTimeDomainData",
              fftData: uint8Array,
              thisRef: data.thisRef,
            },
            [uint8Array.buffer],
          );
        } else {
          if (data.args !== undefined)
            thatRef = thisRef[data.operation](...data.args);
          if (data.argSet !== undefined) thisRef[data.operation] = data.argSet;
          if (data.argRef !== undefined)
            thatRef = thisRef[data.operation](references.get(data.argRef));
          if (data.thatRef !== undefined) references.set(data.thatRef, thatRef);
        }
      };

      butterchurnWorker.postMessage(
        {
          operation: "createVisualizer",
          canvas: currentCanvas,
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        },
        [currentCanvas],
      );

      butterchurnWorker.postMessage({
        operation: "loadPreset",
        preset: presetsList[11],
      });

      butterchurnWorker.postMessage({
        operation: "connectAudio",
      });

      let running = true;

      const step = () => {
        butterchurnWorker.postMessage({ operation: "render" });
        if (running) requestAnimationFrame(step);
      };

      setTimeout(() => step(), 1000);

      return () => {
        running = false;
        butterchurnWorker.terminate();
      };
    }
  }, [sourceNode, presetsList]);

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver((entries) => {
      butterchurnWorker &&
        butterchurnWorker.postMessage({
          operation: "setRendererSize",
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
        });
    });

    resizeObserver.observe(document.body);
    return () => resizeObserver.disconnect();
  }, [butterchurnWorker]);

  /*useEffect(() => {
    window.addEventListener('keydown', () => {});
  
    return () => {
      window.removeEventListener('keydown', handleUserKeyPress);
    };
  }, []);*/

  return <canvas className={styles.spectrum} ref={canvas}></canvas>;
};

export default Butterchurn;
