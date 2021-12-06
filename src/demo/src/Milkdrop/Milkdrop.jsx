import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styles from "./Milkdrop.module.css";

import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";

const Milkdrop = ({ audioElement }) => {
  const analyzer = useRef();
  const [visualizer, setVisualizer] = useState();

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

  useEffect(() => {
    if (window.AudioContext) {
      const audioContext = new AudioContext();

      const source = audioContext.createMediaElementSource(audioElement);

      const milkdrop = butterchurn.createVisualizer(
        audioContext,
        analyzer.current,
        {
          width: window.innerWidth,
          height: window.innerHeight,
          pixelRatio: window.devicePixelRatio || 1,
          textureRatio: 1,
        }
      );

      milkdrop.connectAudio(source);
      if (window.MediaSource) source.connect(audioContext.destination);

      const presets = butterchurnPresets.getPresets();

      setVisualizer(milkdrop);

      const presetsList = [
        //"Cope - The Neverending Explosion of Red Liquid Fire", // good but too active
        //"cope + martin - mother-of-pearl",
        //"fiShbRaiN + Flexi - witchcraft 2.0",
        //"Flexi + Martin - cascading decay swing",
        //"Flexi + stahlregen - jelly showoff parade",
        //"flexi - bouncing balls [double mindblob neon mix]",
        //"Flexi - mindblob [shiny mix]",
        //"Flexi - predator-prey-spirals",
        "Flexi - truly soft piece of software - this is generic texturing (Jelly) ", // good
        //"Flexi, fishbrain, Geiss + Martin - tokamak witchery", // too bright for text
        //"Flexi, martin + geiss - dedicated to the sherwin maxawow", // good but too active
        "Geiss - Cauldron - painterly 2 (saturation remix)", // good
        //"martin - castle in the air", // low key
        //"martin - mandelbox explorer - high speed demo version", // low key
      ];

      milkdrop.loadPreset(presets[presetsList[1]]);

      const step = () => {
        milkdrop.render();
        requestAnimationFrame(step);
      };

      step();
    }
  }, [audioElement]);

  return <canvas className={styles.spectrum} ref={analyzer}></canvas>;
};

export default Milkdrop;
