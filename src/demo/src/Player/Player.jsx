import React from "react";
import styles from "./Player.module.css";

const VISIT_STATION = "Visit this station at ";
const ICECAST_METADATA_JS_DEMO = "Icecast Metadata JS Demo";

const Player = ({ station, playing, toggle, metadata }) => {
  // update metadata in title
  const title = metadata.StreamTitle || metadata.TITLE;
  document.title = title
    ? `${title} | ${ICECAST_METADATA_JS_DEMO}`
    : ICECAST_METADATA_JS_DEMO;

  return (
    <div className={styles.player}>
      <button disabled={!station} className={styles.button} onClick={toggle}>
        {playing ? (
          <svg className={styles.playPause} viewBox="0 0 450 525">
            <path
              fill="#999"
              d="M144 479H48c-26.5 0-48-21.5-48-48V79c0-26.5 21.5-48 48-48h96c26.5 0 48 21.5 48 48v352c0 26.5-21.5 48-48 48zm304-48V79c0-26.5-21.5-48-48-48h-96c-26.5 0-48 21.5-48 48v352c0 26.5 21.5 48 48 48h96c26.5 0 48-21.5 48-48z"
            />
          </svg>
        ) : (
          <svg className={styles.playPause} viewBox="0 0 450 525">
            <path
              fill="#999"
              d="M424.4 214.7L72.4 6.6C43.8-10.3 0 6.1 0 47.9V464c0 37.5 40.7 60.1 72.4 41.3l352-208c31.4-18.5 31.5-64.1 0-82.6z"
            />
          </svg>
        )}
      </button>
      <div className={styles.playerText}>
        <div className={styles.metadata}>
          {typeof metadata === "object"
            ? metadata.StreamTitle ||
              (metadata.ARTIST
                ? `${metadata.ARTIST} - ${metadata.TITLE}`
                : metadata.TITLE) ||
              metadata.VENDOR_STRING
            : metadata}
        </div>
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
