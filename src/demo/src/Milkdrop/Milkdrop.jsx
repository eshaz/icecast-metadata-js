import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import styles from "./Milkdrop.module.css";

import butterchurn from "butterchurn";
import butterchurnPresets from "butterchurn-presets";

const Milkdrop = ({ audioElement }) => {
  const analyzer = useRef();
  const [visualizer, setVisualizer] = useState();
  const [audioContext] = useState(
    new (window.AudioContext || window.webkitAudioContext)()
  );

  useEffect(() => {
    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(audioContext.destination);

    const milkdrop = butterchurn.createVisualizer(
      source.context, //audioContext,
      analyzer.current,
      {
        width: window.innerWidth,
        height: window.innerHeight,
        pixelRatio: window.devicePixelRatio || 1,
        textureRatio: 1,
      }
    );

    milkdrop.connectAudio(source);

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

    return () => {
      source.disconnect();
    };
  }, [audioContext, audioElement]);

  const unlockContext = () => {
    if (audioContext.state === "suspended") audioContext.resume();
    window.removeEventListener("click", unlockContext);
  };
  window.addEventListener("click", unlockContext);

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

  return <canvas className={styles.spectrum} ref={analyzer}></canvas>;
};

export default Milkdrop;
