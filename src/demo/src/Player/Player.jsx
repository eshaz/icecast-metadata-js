import React, { useEffect, useState } from "react";
import MetadataPlayer from "../icecast/MetadataPlayer";
import { ReactComponent as Play } from "./play.svg";
import { ReactComponent as Pause } from "./pause.svg";
import styles from "./Player.module.css";

const useMetadataPlayer = (station, onMetadataUpdate) => {
  const [metadataPlayer] = useState(
    new MetadataPlayer({
      onMetadataUpdate: (meta) => {
        console.log(meta);
        onMetadataUpdate(meta);
      },
    })
  );

  useEffect(() => {
    station && metadataPlayer.play(station.endpoint, station.metaInt);
  }, [station]);

  const toggle = () =>
    metadataPlayer.playing
      ? metadataPlayer.stop()
      : metadataPlayer.play(station.endpoint, station.metaInt);

  return [metadataPlayer.playing, toggle];
};

export default ({ station }) => {
  const SELECT_STATION = "Select a station";
  const SELECT_OR_PLAY = "Select a station or press play";
  const VISIT_SITE = "Visit this station at ";

  const [metadata, setMetadata] = useState({});
  const [isPlaying, toggle] = useMetadataPlayer(station, setMetadata);

  return (
    <div className={styles.player}>
      <button
        disabled={!Boolean(station)}
        className={styles.button}
        onClick={toggle}
      >
        {isPlaying ? <Pause /> : <Play />}
      </button>
      <div>
        <p className={styles.metadata}>
          {metadata.StreamTitle === undefined
            ? Boolean(station)
              ? SELECT_OR_PLAY
              : SELECT_STATION
            : metadata.StreamTitle}
        </p>
        {station?.link && (
          <div className={styles.visitStation}>
            {VISIT_SITE}
            <a className={styles.link} href={station.link} target="_blank">
              {station.link}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
