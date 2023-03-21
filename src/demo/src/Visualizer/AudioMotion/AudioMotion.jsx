import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./AudioMotion.module.css";

import AudioMotionAnalyzer from "audiomotion-analyzer";

const AudioMotion = ({ sourceNode }) => {
  const analyzer = useRef();
  const [audioMotion, setAudioMotion] = useState();

  useEffect(() => {
    if (sourceNode) {
      const visualizer = new AudioMotionAnalyzer(analyzer.current, {
        source: sourceNode,
        connectSpeakers: false,
        showScaleX: false,
        fftSize: 32768,
        mode: 1,
        gradient: "prism",
        showBgColor: false,
        barSpace: 0,
        lumiBars: true,
      });

      setAudioMotion(visualizer);

      return () => {
        visualizer.disconnectInput();
      };
    }
  }, [sourceNode]);

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(() => {
        audioMotion &&
          audioMotion.setCanvasSize(
            window.innerWidth,
            window.innerHeight + 100
          );
      });
    });

    resizeObserver.observe(document.body);
    return () => resizeObserver.disconnect();
  }, [audioMotion]);

  return <div className={styles.spectrum} ref={analyzer}></div>;
};

export default AudioMotion;
