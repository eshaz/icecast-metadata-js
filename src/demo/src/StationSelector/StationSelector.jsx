import React from "react";
import styles from "./StationSelector.module.css";

const CodecButton = ({
  station,
  selectedStation,
  changeStation,
  codecButtonNotSelectedStyle,
  endpoint,
}) => (
  <div>
    <input
      type="radio"
      name="stations"
      id={station.name + endpoint.codec}
      className={styles.stationRadio}
      onChange={() => changeStation({ ...station, ...endpoint })}
    />
    <label
      className={`${styles.codecLabel} ${
        selectedStation?.endpoint === endpoint.endpoint
          ? styles.codecSelected
          : codecButtonNotSelectedStyle
      }`}
      htmlFor={station.name + endpoint.codec}
    >
      {endpoint.codec}{" "}
      {endpoint.metadataTypes.length > 0 &&
        `| ${endpoint.metadataTypes.join(", ")}`}
    </label>
  </div>
);

const CodecButtonGroup = ({
  station,
  selectedStation,
  changeStation,
  codecButtonNotSelectedStyle,
  codecButtonsPerGroup,
}) => {
  const codecButtonGroups = [];

  for (let i = 0; i < station.endpoints.length; i += codecButtonsPerGroup) {
    codecButtonGroups.push(
      <div key={i / codecButtonsPerGroup} className={styles.codecs}>
        {station.endpoints
          .slice(i, i + codecButtonsPerGroup)
          .map((endpoint, idx) => (
            <CodecButton
              key={idx}
              station={station}
              endpoint={endpoint}
              codecButtonNotSelectedStyle={codecButtonNotSelectedStyle}
              selectedStation={selectedStation}
              changeStation={changeStation}
            />
          ))}
      </div>
    );
  }

  return codecButtonGroups;
};

const Station = ({ station, selectedStation, changeStation }) => {
  let stationLabelStyle, codecButtonNotSelectedStyle;

  if (selectedStation?.name === station.name) {
    stationLabelStyle = styles.selected;
    codecButtonNotSelectedStyle = styles.codecNotSelected;
  } else {
    stationLabelStyle = styles.notSelected;
    codecButtonNotSelectedStyle = styles.codecNotSelectedNotPlaying;
  }

  return (
    <label
      className={`${styles.stationLabel} ${stationLabelStyle}`}
      htmlFor={station.name + station.endpoints[0].codec}
    >
      <div className={styles.stationName}>{station.name}</div>
      <div className={styles.stationDescription}>{station.description}</div>
      <CodecButtonGroup
        station={station}
        selectedStation={selectedStation}
        changeStation={changeStation}
        codecButtonNotSelectedStyle={codecButtonNotSelectedStyle}
        codecButtonsPerGroup={4}
      />
    </label>
  );
};

const StationSelector = (props) => {
  return props.stations.map((station, idx) => (
    <Station
      key={idx}
      station={station}
      selectedStation={props.selectedStation}
      changeStation={props.changeStation}
    />
  ));
};

export default React.memo(StationSelector);
