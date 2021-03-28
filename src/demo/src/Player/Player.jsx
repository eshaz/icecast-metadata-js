import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";
import styles from "./Player.module.css";

const VISIT_STATION = "Visit this station at ";
const ICECAST_METADATA_JS_DEMO = "Icecast Metadata JS Demo";

const Player = ({ station, playing, toggle, audioElement, metadata }) => {
  const [audioMotion, setAudioMotion] = useState();
  const analyzer = useRef();
  const player = useRef();

  // update metadata in title
  const title = metadata.StreamTitle || metadata.TITLE;
  document.title = title
    ? `${title} | ${ICECAST_METADATA_JS_DEMO}`
    : ICECAST_METADATA_JS_DEMO;

  useEffect(() => {
    setAudioMotion(
      new AudioMotionAnalyzer(analyzer.current, {
        source: audioElement,
        showScaleX: false,
        fftSize: 32768,
        mode: 1,
        gradient: "rainbow",
        lumiBars: true,
      })
    );
  }, [audioElement]);

  // adjust canvas size for audio spectrum
  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      audioMotion &&
        audioMotion.setCanvasSize(
          player.current.clientWidth,
          player.current.clientHeight
        );
    });
    resizeObserver.observe(player.current);
    return () => resizeObserver.disconnect();
  }, [audioMotion]);

  return (
    <div ref={player} className={styles.player}>
      <div ref={analyzer} className={styles.spectrum}></div>
      <button disabled={!station} className={styles.button} onClick={toggle}>
        {playing ? (
          <svg className={styles.playPause} viewBox="0 0 450 525">
            <path
              fill="#808080"
              d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"
            />
          </svg>
        ) : (
          <svg className={styles.playPause} viewBox="0 0 450 525">
            <path
              fill="#808080"
              d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"
            />
          </svg>
        )}
      </button>
      <div className={styles.playerText}>
        <p className={styles.metadata}>
          {typeof metadata === "object"
            ? metadata.StreamTitle ||
              (metadata.ARTIST
                ? `${metadata.ARTIST} - ${metadata.TITLE}`
                : metadata.TITLE) ||
              metadata.VENDOR_STRING
            : metadata}
        </p>
        {station?.link && (
          <div className={styles.visitStation}>
            {VISIT_STATION}
            <a
              className={styles.link}
              href={station.link}
              target="_blank"
              rel="noopener noreferrer"
            >
              {station.name}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default Player;
