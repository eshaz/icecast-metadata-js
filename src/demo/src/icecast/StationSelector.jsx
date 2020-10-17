import React, { useState } from "react";

const Station = ({ id, station, changeStation }) => (
  <div>
    <input
      type="radio"
      id={id}
      name="stations"
      onChange={() => changeStation(station)}
    ></input>
    <label htmlFor={id}>
      <span>
        <div>{station.name}</div>
        <div>{station.description}</div>
      </span>
    </label>
  </div>
);

export default (props) =>
  props.stations.map((station, idx) => (
    <Station
      key={idx}
      station={station}
      id={idx}
      changeStation={props.changeStation}
    />
  ));
