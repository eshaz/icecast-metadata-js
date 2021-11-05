import React, {
  useState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
} from "react";
import AudioMotionAnalyzer from "audiomotion-analyzer";
import Player from "./Player/Player";
import StationSelector from "./StationSelector/StationSelector";
import stations from "./stations.json";
import styles from "./App.module.css";
import About from "./About/About";

import IcecastMetadataPlayer from "icecast-metadata-player";

const SELECT_STATION = "Select a station";
const SELECT_OR_PLAY = "Select a station or press play";
const LOADING = "Loading...";
const RECONNECTING = "Lost Connection. Reconnecting...";
const CONNECTED = "Waiting for metadata...";

const App = () => {
  const [station, setStation] = useState();
  const [playing, setPlaying] = useState(false);
  const [audioElement] = useState(new Audio());

  const [metadata, setMetadata] = useState(SELECT_STATION);
  const [codecInfo, setCodecInfo] = useState();
  const [icecast, setIcecast] = useState();

  const analyzer = useRef();
  const [audioMotion, setAudioMotion] = useState();

  const changeStation = useCallback(
    async (station) => {
      if (icecast) {
        await icecast.stop();
        icecast.detachAudioElement();
      }

      const player = new IcecastMetadataPlayer(station.endpoint, {
        onMetadata: (meta) => {
          console.log(meta);
          setMetadata(meta);
        },
        onCodecUpdate: setCodecInfo,
        onPlay: () => {
          setPlaying(true);
        },
        onStop: () => {
          setPlaying(false);
          setMetadata(SELECT_OR_PLAY);
          setCodecInfo();
        },
        onLoad: () => {
          setPlaying(true);
          setMetadata(LOADING);
          setCodecInfo();
        },
        onError: (error) => {
          setMetadata(error?.message || error);
          setCodecInfo();
        },
        onRetry: () => {
          setMetadata(RECONNECTING);
        },
        onStreamStart: () => {
          setMetadata(station.metadataTypes.length ? CONNECTED : "");
        },
        icyDetectionTimeout: 5000,
        decoderEncoding: "utf-8",
        enableLogging: true,
        metadataTypes: station.metadataTypes,
        audioElement,
      });

      player.play();

      setIcecast(player);
      setStation(station);
    },
    [icecast, audioElement]
  );

  const toggle = useCallback(() => {
    playing ? icecast.stop() : icecast.play();
  }, [icecast, playing]);

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

  // adjust canvas size for audio spectrum
  useLayoutEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      audioMotion &&
        audioMotion.setCanvasSize(window.innerWidth, window.innerHeight + 100);
    });
    resizeObserver.observe(analyzer.current);
    return () => resizeObserver.disconnect();
  }, [audioMotion]);

  return (
    <>
      <div className={styles.spectrum} ref={analyzer}></div>
      <header className={styles.header}>
        <About />
      </header>
      <main>
        <StationSelector
          stations={stations}
          changeStation={changeStation}
          selectedStation={station}
        />
      </main>
      <footer className={styles.footer}>
        <Player
          station={station}
          toggle={toggle}
          playing={playing}
          metadata={metadata}
          codecInfo={codecInfo}
        ></Player>
      </footer>
    </>
  );
};

export default App;
