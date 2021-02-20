import React, { useLayoutEffect, useState } from "react";
import AudioSpectrum from "react-audio-spectrum";
import { ReactComponent as Play } from "./play.svg";
import { ReactComponent as Pause } from "./pause.svg";
import styles from "./Player.module.css";

const VISIT_STATION = "Visit this station at ";
const ICECAST_METADATA_JS_DEMO = "Icecast Metadata JS Demo";

const Player = ({ station, playing, toggle, audioElement, metadata }) => {
  const [[audioHeight, audioWidth], setSpectrumSize] = useState([0, 0]);
  const [meters, setMeters] = useState(0);

  // update metadata in title
  const title = metadata.StreamTitle || metadata.TITLE;
  document.title = title
    ? `${title} | ${ICECAST_METADATA_JS_DEMO}`
    : ICECAST_METADATA_JS_DEMO;

  // adjust canvas size for audio spectrum
  useLayoutEffect(() => {
    const updateSize = () => {
      const player = document.getElementById("player");
      setMeters(Math.floor(player.clientWidth / 32));
      setSpectrumSize([player.clientHeight + 6, player.clientWidth]);
    };
    window.addEventListener("resize", updateSize);
    updateSize();
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  return (
    <div id={"player"} className={styles.player}>
      <div className={styles.spectrum}>
        <AudioSpectrum
          height={audioHeight}
          width={audioWidth}
          audioEle={audioElement}
          capColor={"red"}
          capHeight={1}
          meterWidth={2}
          meterCount={(meters + 1) * 32}
          meterColor={[
            { stop: 0, color: "#f00" },
            { stop: 0.3, color: "#0CD7FD" },
            { stop: 1, color: "red" },
          ]}
          gap={1}
        />
      </div>
      <button disabled={!station} className={styles.button} onClick={toggle}>
        {playing ? <Pause /> : <Play />}
      </button>
      <div>
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
