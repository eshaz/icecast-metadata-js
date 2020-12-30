import React from "react";
import styles from "./StationSelector.module.css";

const Station = ({ id, station, changeStation }) => (
  <div className={styles.station}>
    <input
      type="radio"
      className={styles.stationRadio}
      id={id}
      name="stations"
      onChange={() => changeStation(station)}
    ></input>
    <label className={styles.stationLabel} htmlFor={id}>
      <div className={styles.stationName}>{station.name}</div>
      <div className={styles.codecInfo}>
        {station.codec} | {station.metadataTypes.join(", ")}
      </div>
      <div className={styles.stationDescription}>{station.description}</div>
    </label>
  </div>
);

const StationSelector = (props) =>
  props.stations.map((station, idx) => (
    <Station
      key={idx}
      station={station}
      id={idx}
      changeStation={props.changeStation}
    />
  ));

export default StationSelector;
