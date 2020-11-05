import React, { useEffect, useState } from "react";
import MetadataPlayer from "../icecast/MetadataPlayer";
import { ReactComponent as Play } from "./play.svg";
import { ReactComponent as Pause } from "./pause.svg";
import styles from "./Player.module.css";
import { useCallback } from "react";

const SELECT_STATION = "Select a station";
const SELECT_OR_PLAY = "Select a station or press play";
const LOADING = "Loading...";
const VISIT_STATION = "Visit this station at ";

const useMetadataPlayer = (station, onMetadataUpdate) => {
  const [metadataPlayer] = useState(
    new MetadataPlayer({
      onMetadataUpdate: (meta) => {
        //console.log(meta);
        onMetadataUpdate(meta);
      },
    })
  );

  const play = useCallback(() => {
    onMetadataUpdate(LOADING);
    metadataPlayer.play(station.endpoint, station.metaInt);
  }, [onMetadataUpdate, metadataPlayer, station]);

  const stop = useCallback(() => {
    onMetadataUpdate(SELECT_OR_PLAY);
    metadataPlayer.stop();
  }, [onMetadataUpdate, metadataPlayer]);

  useEffect(() => {
    station && play();
  }, [station, play]);

  const toggle = () => (metadataPlayer.playing ? stop() : play());

  return [metadataPlayer.playing, toggle];
};

export default ({ station }) => {
  const [metadata, setMetadata] = useState(SELECT_STATION);
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
          {typeof metadata === "object" ? metadata.StreamTitle : metadata}
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
