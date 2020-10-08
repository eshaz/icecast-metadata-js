import React, { useState } from "react";

export default (props) => {
  return (
    <select onChange={(value) => props.changeStation(value.target.value)}>
      {props.stations.map((station, idx) => (
        <option value={idx}>{station.name}</option>
      ))}
    </select>
  );
};
