import React, { useState } from "react";
import Player from "./icecast/Player";
import StationSelector from "./icecast/StationSelector";
import stations from "./stations.json";
import "./App.css";

function App() {
  const [station, setStation] = useState(stations[0]);

  return (
    <div className="App">
      <Player station={station}></Player>
      <StationSelector stations={stations} changeStation={setStation} />
    </div>
  );
}

export default App;
