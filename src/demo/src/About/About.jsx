import React from "react";
import styles from "./About.module.css";

export default () => (
  <div className={styles.about}>
    <a
      className={styles.link}
      href="https://github.com/eshaz/icecast-metadata-js"
    >
      <div>icecast-metadata-js</div>
      <div className={styles.subLink}>
        https://github.com/eshaz/icecast-metadata-js
      </div>
    </a>
    <div className={styles.description}>
      Javascript library that reads, parses, and queues realtime metadata from
      an Icecast stream.
    </div>
    <div className={styles.disclaimer}>
      Stations are presented here for demonstration purposes only.
    </div>
  </div>
);
