import React from "react";
import styles from "./About.module.css";

const About = () => (
  <div className={styles.about}>
    <a
      className={styles.mainLink}
      href="https://github.com/eshaz/icecast-metadata-js"
    >
      <div>icecast-metadata-js</div>
    </a>
    <div className={styles.description}>
      Javascript library that reads, parses, and queues real-time metadata from
      an Icecast stream.
    </div>
    <div className={styles.headerLink}>
      <a className={styles.headerLink} style={{ fontWeight: "bold" }} href="/">
        React Demo
      </a>
      &nbsp;&nbsp; | &nbsp;&nbsp;
      <a className={styles.headerLink} href="demo.html">
        HTML Demo
      </a>
      &nbsp;&nbsp; | &nbsp;&nbsp;
      <a className={styles.headerLink} href="bare-minimum-demo.html">
        <i>"Bare Minimum"</i> &nbsp;HTML Demo
      </a>
    </div>
    <div className={styles.disclaimer}>
      Stations are presented here for demonstration purposes only.
    </div>
  </div>
);

export default About;
