import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styles from "./AudioMotion.module.css";

import AudioMotionAnalyzer from "audiomotion-analyzer";

const AudioMotion = ({ audioElement }) => {
  const analyzer = useRef();
  const [audioMotion, setAudioMotion] = useState();

  useEffect(() => {
    setAudioMotion(
      new AudioMotionAnalyzer(analyzer.current, {
        source: audioElement,
        showScaleX: false,
        fftSize: 32768,
        mode: 1,
        gradient: "prism",
        showBgColor: false,
        barSpace: 0,
        lumiBars: true,
      })
    );
  }, [audioElement]);

  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      audioMotion &&
        audioMotion.setCanvasSize(window.innerWidth, window.innerHeight + 100);
    });
    resizeObserver.observe(analyzer.current);
    return () => resizeObserver.disconnect();
  }, [audioMotion]);

  return <div className={styles.spectrum} ref={analyzer}></div>;
};

export default AudioMotion;
