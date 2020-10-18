import React, { useState } from "react";
import Player from "./Player/Player";
import StationSelector from "./StationSelector/StationSelector";
import stations from "./stations.json";

function App() {
  const [station, setStation] = useState();

  return (
    <div>
      <Player station={station}></Player>
      <StationSelector stations={stations} changeStation={setStation} />
    </div>
  );
}

export default App;
