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
        gradient: "rainbow",
        showBgColor: false,
        barSpace: 0,
        //lumiBars: true,
        smoothing: 0,
        weightingFilter: "D",
        //frequencyScale: "bark"
      });

      /*visualizer.registerGradient("prism", {
        colorStops: [
          "hsl( 0, 100%, 50% )",
          "hsl( 60, 100%, 50% )",
          "hsl( 120, 100%, 50% )",
          "hsl( 180, 100%, 50% )",
          "hsl( 240, 100%, 50% )",
        ],
      });*/

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
            window.innerHeight + 100,
          );
      });
    });

    resizeObserver.observe(document.body);
    return () => resizeObserver.disconnect();
  }, [audioMotion]);

  return <div className={styles.spectrum} ref={analyzer}></div>;
};

export default AudioMotion;
