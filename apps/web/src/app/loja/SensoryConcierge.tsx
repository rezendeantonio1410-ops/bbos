"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./conversion-review.module.css";

export default function SensoryConcierge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Link
      className={`${styles.floatingGuide} ${visible ? styles.floatingGuideVisible : ""}`}
      href="/loja/descobrir"
      aria-label="O Bispo ajuda você a escolher o seu café"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <span aria-hidden="true"><i>B</i></span>
      <b>
        <strong>Posso ajudar a escolher seu café →</strong>
        <small>3 escolhas · menos de um minuto</small>
      </b>
    </Link>
  );
}
