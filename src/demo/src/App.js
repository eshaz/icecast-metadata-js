import React, { useState } from "react";
import Player from "./Player/Player";
import StationSelector from "./StationSelector/StationSelector";
import stations from "./stations.json";
import styles from "./App.module.css";
import About from "./About/About";

function App() {
  const [station, setStation] = useState();

  return (
    <>
      <header className={styles.header}>
        <About />
      </header>
      <StationSelector stations={stations} changeStation={setStation} />
      <footer className={styles.footer}>
        <Player station={station}></Player>
      </footer>
    </>
  );
}

export default App;
