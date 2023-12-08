import React, { useState, useCallback, useEffect } from "react";

import Player from "./Player/Player";
import StationSelector from "./StationSelector/StationSelector";
import stations from "./stations.json";
import styles from "./App.module.css";
import About from "./About/About";

import IcecastMetadataPlayer from "icecast-metadata-player";
import Visualizer, {
  visualizers,
  VisualizerSelector,
} from "./Visualizer/Visualizer";

const SELECT_STATION = "Select a station";
const SELECT_OR_PLAY = "Select a station or press play";
const LOADING = "Loading...";
const RECONNECTING = "Lost Connection. Reconnecting...";
const CONNECTED = "Waiting for metadata...";
const SWITCHING = "Switching...";

const App = () => {
  const [audioElement] = useState(new Audio());
  const [station, setStation] = useState();
  const [playing, setPlaying] = useState(false);

  const [metadata, setMetadata] = useState(SELECT_STATION);
  const [codecInfo, setCodecInfo] = useState();
  const [icecast, setIcecast] = useState();

  const [visualizer, setVisualizer] = useState(visualizers[0]);

  const [castSession, setCastSession] = useState();

  const namespace = "urn:x-cast:icecast-metadata-js-demo";
  const castAPIId = "E3C20492";

  const sendCastMessage = useCallback(
    (msg) => {
      castSession?.sendMessage(namespace, msg);
    },
    [castSession],
  );

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "//www.gstatic.com/cv/js/sender/v1/cast_sender.js";
    document.body.appendChild(script);

    window.__onGCastApiAvailable = (loaded) => {
      if (loaded) {
        const sessionRequest = new window.chrome.cast.SessionRequest(castAPIId);

        const apiConfig = new window.chrome.cast.ApiConfig(
          sessionRequest,
          (session) => {
            setCastSession(session);
          },
          () => {},
        );

        window.chrome.cast.initialize(apiConfig);
      }
    };
  }, []);

  const changeStation = useCallback(
    async (newStation) => {
      if (
        icecast &&
        station &&
        icecast.state !== "stopped" &&
        newStation.name === station.name &&
        newStation.switchable !== false &&
        station.switchable !== false
      ) {
        icecast.switchEndpoint(newStation.endpoint, newStation);
      } else {
        if (icecast) {
          await icecast.stop();
          sendCastMessage({ command: "stop" });
          icecast.detachAudioElement();
        }

        sendCastMessage({
          command: "change station",
          enableCodecUpdate: true,
          ...newStation,
        });

        let currentMetadata = "";

        const player = new IcecastMetadataPlayer(newStation.endpoint, {
          onMetadata: (meta) => {
            console.log(meta);
            currentMetadata = meta;
            setMetadata(meta);
          },
          onCodecUpdate: setCodecInfo,
          onPlay: () => {
            setPlaying(true);
          },
          onStop: () => {
            setPlaying(false);
            currentMetadata = "";
            setMetadata(SELECT_OR_PLAY);
            setCodecInfo();
          },
          onLoad: () => {
            setPlaying(true);
            setMetadata(LOADING);
            setCodecInfo();
          },
          onError: (error) => {
            currentMetadata = "";
            setMetadata(error?.message || error);
            setCodecInfo();
          },
          onRetry: () => {
            currentMetadata = "";
            setMetadata(RECONNECTING);
          },
          onStreamStart: () => {
            setMetadata(
              newStation.metadataTypes.length
                ? currentMetadata || CONNECTED
                : "",
            );
          },
          onSwitch: () => {
            setMetadata(SWITCHING);
          },
          icyDetectionTimeout: 5000,
          icyCharacterEncoding: newStation.icyCharacterEncoding,
          enableLogging: true,
          metadataTypes: newStation.metadataTypes,
          bufferLength: newStation.bufferLength,
          audioElement,
          retryTimeout: 120,
          endpointOrder: "random",
        });

        player.play();
        sendCastMessage({ command: "play" });

        setIcecast(player);
      }

      setStation(newStation);
    },
    [icecast, station, audioElement, sendCastMessage],
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

  return (
    <>
      <Visualizer audioElement={audioElement} selectedVisualizer={visualizer} />
      <header className={styles.header}>
        <VisualizerSelector
          className={styles.visualizerSelector}
          visualizer={visualizer}
          setVisualizer={setVisualizer}
        />
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
        />
      </footer>
    </>
  );
};

export default App;
