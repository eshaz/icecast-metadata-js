import React, { useEffect, createRef, useState } from "react";
import MetadataPlayer from "./MetadataPlayer";

export default ({ station }) => {
  const audio = createRef(null);
  const [metadata, setMetadata] = useState({});

  useEffect(() => {
    const metadataPlayer = new MetadataPlayer({
      endpoint: station.endpoint,
      metaInt: station.metaInt,
      audioElement: audio.current,
      onMetadataUpdate: setMetadata,
    });

    return () => metadataPlayer.stop();
  }, [station, setMetadata]);

  return (
    <div className="player">
      <audio ref={audio} controls>
        This browser does not support HTML5 Audio
      </audio>
      <p>
        {metadata.StreamTitle === undefined
          ? "Select a station and press Play"
          : metadata.StreamTitle}
      </p>
    </div>
  );
};
