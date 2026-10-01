"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./conversion-review.module.css";

export default function SensoryConcierge() {
  const [visible, setVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;

    const observer = new IntersectionObserver(
      ([entry]) => setFooterVisible(Boolean(entry?.isIntersecting)),
      { rootMargin: "72px 0px 0px" },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const available = visible && !footerVisible;

  return (
    <Link
      className={`${styles.floatingGuide} ${visible ? styles.floatingGuideVisible : ""} ${footerVisible ? styles.floatingGuideFooterSafe : ""}`}
      href="/loja/descobrir"
      aria-label="O Bispo ajuda você a escolher o seu café"
      aria-hidden={!available}
      tabIndex={available ? 0 : -1}
    >
      <span aria-hidden="true">
        <i>B</i>
      </span>
      <b>
        <strong>Posso ajudar a escolher seu café →</strong>
        <small>3 escolhas · menos de um minuto</small>
      </b>
    </Link>
  );
}
