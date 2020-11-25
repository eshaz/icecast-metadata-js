import React, { useLayoutEffect, useEffect, useState } from "react";
import AudioSpectrum from "react-audio-spectrum";
import MetadataPlayer from "../icecast/MetadataPlayer";
import { ReactComponent as Play } from "./play.svg";
import { ReactComponent as Pause } from "./pause.svg";
import styles from "./Player.module.css";
import { useCallback } from "react";

const SELECT_STATION = "Select a station";
const SELECT_OR_PLAY = "Select a station or press play";
const LOADING = "Loading...";
const VISIT_STATION = "Visit this station at ";

const useMetadataPlayer = (station, onMetadataUpdate, audioElement) => {
  const [metadataPlayer] = useState(
    new MetadataPlayer({
      onMetadataUpdate: (meta) => {
        console.log(meta);
        onMetadataUpdate(meta);
      },
      audioElement,
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
  const audioElement = new Audio();
  const [[audioHeight, audioWidth], setSpectrumSize] = useState([0, 0]);
  const [meters, setMeters] = useState(0);
  const [metadata, setMetadata] = useState(SELECT_STATION);
  const [isPlaying, toggle] = useMetadataPlayer(
    station,
    setMetadata,
    audioElement
  );

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
