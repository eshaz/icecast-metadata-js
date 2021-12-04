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
  const [castSession, setCastSession] = useState();

  const namespace = "urn:x-cast:icecast-metadata-js-demo";

  const sendCastMessage = useCallback(
    (msg) => {
      console.log("sending", msg);
      castSession?.sendMessage(
        namespace,
        msg,
        () => console.log("Message sent: ", msg),
        (...args) => console.log("error", ...args)
      );
    },
    [castSession]
  );

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//www.gstatic.com/cv/js/sender/v1/cast_sender.js";
    document.body.appendChild(script);

    window.__onGCastApiAvailable = (loaded, error) => {
      console.log("cast", loaded, error);
      if (loaded) {
        const sessionRequest = new window.chrome.cast.SessionRequest(
          "E3C20492"
        );

        const apiConfig = new window.chrome.cast.ApiConfig(
          sessionRequest,
          (session) => {
            console.log("New session ID:" + session.sessionId);
            setCastSession(session);
          },
          (...e) => console.log("error", ...e)
        );

        window.chrome.cast.initialize(
          apiConfig,
          (...args) => console.log("success", ...args),
          (...args) => console.log("error", ...args)
        );
      }
    };
  }, []);

  const changeStation = useCallback(
    async (station) => {
      if (icecast) {
        await icecast.stop();
        sendCastMessage({ command: "stop" });
        icecast.detachAudioElement();
      }

      sendCastMessage({
        command: "change station",
        enableCodecUpdate: true,
        ...station,
      });

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
        icyCharacterEncoding: station.icyCharacterEncoding,
        enableLogging: true,
        metadataTypes: station.metadataTypes,
        audioElement,
      });

      player.play();
      sendCastMessage({ command: "play" });

      setIcecast(player);
      setStation(station);
    },
    [icecast, audioElement, sendCastMessage]
  );

  const play = useCallback(() => {
    icecast.play();
    sendCastMessage({ command: "play" });
  }, [icecast, sendCastMessage]);

  const stop = useCallback(() => {
    icecast.stop();
    sendCastMessage({ command: "stop" });
  }, [icecast, sendCastMessage]);

  const toggle = useCallback(() => {
    playing ? stop() : play();
  }, [playing, stop, play]);

  useEffect(() => {
    if (window.AudioContext) {
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
    }
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
