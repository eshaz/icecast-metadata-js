import React, { useEffect, createRef } from "react";
import MetadataPlayer from "./MetadataPlayer";

export default (props) => {
  const audio = createRef(null);

  const metadataPlayer = new MetadataPlayer({
    endpoint: props.station.endpoint,
    metaInt: props.station.metaInt,
    onMetadataUpdate: (value) => {
      props.setMetadata(value);
    },
  });

  useEffect(() => {
    metadataPlayer.audioElement = audio.current;
  }, [props.station]);

  return (
    <audio
      ref={audio}
      controls
      onPlay={() => metadataPlayer.play()}
      onPause={() => metadataPlayer.stop()}
    >
      This browser does not support HTML5 Audio
    </audio>
  );
};
