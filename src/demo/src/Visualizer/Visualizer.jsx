import React, { useEffect, useState } from "react";

import AudioMotion from "./AudioMotion/AudioMotion";
import Butterchurn from "./Butterchurn/Butterchurn";
// eslint-disable-next-line
import style from "./Visualizer.module.css";

export const visualizers = (() =>
  window.WebGL2RenderingContext &&
  document.createElement("canvas").getContext("webgl2")
    ? ["butterchurn", "audiomotion", "none"]
    : ["audiomotion", "none"])();

export const VisualizerSelector = ({
  className,
  visualizer,
  setVisualizer,
}) => (
  <div className={className} title="Select a visualizer">
    <select
      defaultValue={visualizer}
      onChange={(e) => {
        setVisualizer(e.target.value);
      }}
    >
      {visualizers.map((name, idx) => (
        <option value={name} key={idx}>
          {name}
        </option>
      ))}
    </select>
  </div>
);

const Visualizer = ({ audioElement, selectedVisualizer }) => {
  const [audioContext] = useState(
    new (window.AudioContext || window.webkitAudioContext)(),
  );
  const [sourceNode, setSourceNode] = useState();

  useEffect(() => {
    audioContext.destination.channelCount =
      audioContext.destination.maxChannelCount;

    const source = audioContext.createMediaElementSource(audioElement);
    source.connect(audioContext.destination);
    setSourceNode(source);
  }, [audioElement, audioContext]);

  const unlockContext = () => {
    if (audioContext.state !== "running") audioContext.resume();
    window.removeEventListener("click", unlockContext);
  };
  window.addEventListener("click", unlockContext);

  switch (selectedVisualizer) {
    case "audiomotion":
      return <AudioMotion sourceNode={sourceNode} />;
    case "butterchurn":
      return <Butterchurn sourceNode={sourceNode} />;
    case "none":
    default:
      return null;
  }
};

export default React.memo(Visualizer);
