import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styles from "./Butterchurn.module.css";

import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";

const Butterchurn = ({ sourceNode }) => {
  const analyzer = useRef();
  const [visualizer, setVisualizer] = useState();
  const [preset, setPreset] = useState(0);

  const presetsList = [
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
  ];

  useEffect(() => {
    if (sourceNode) {
      const visualizer = butterchurn.createVisualizer(
        sourceNode.context, //audioContext,
        analyzer.current,
        {
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
          textureRatio: 1,
        }
      );

      visualizer.connectAudio(sourceNode);
      const presets = butterchurnPresets.getPresets();
      setVisualizer(visualizer);

      visualizer.loadPreset(presets[presetsList[11]]);

      let running = true;

      const step = () => {
        visualizer.render();
        if (running) requestAnimationFrame(step);
      };

      step();

      return () => {
        running = false;
        visualizer.disconnectAudio(sourceNode);
      };
    }
  }, [sourceNode]);

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      analyzer.current.width = window.innerWidth;
      analyzer.current.height = window.innerHeight;
      visualizer &&
        visualizer.setRendererSize(window.innerWidth, window.innerHeight);
    });
    resizeObserver.observe(analyzer.current);
    return () => resizeObserver.disconnect();
  }, [visualizer]);

  /*useEffect(() => {
    window.addEventListener('keydown', () => {});
  
    return () => {
      window.removeEventListener('keydown', handleUserKeyPress);
    };
  }, []);*/

  return <canvas className={styles.spectrum} ref={analyzer}></canvas>;
};

export default Butterchurn;
