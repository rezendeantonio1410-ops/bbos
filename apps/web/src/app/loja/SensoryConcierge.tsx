"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import styles from "./conversion-review.module.css";

export default function SensoryConcierge() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const updateVisibility = () => {
      const threshold = Math.max(320, window.innerHeight * 0.55);
      setVisible(window.scrollY > threshold);
    };

    updateVisibility();
    window.addEventListener("scroll", updateVisibility, { passive: true });
    window.addEventListener("resize", updateVisibility);

    return () => {
      window.removeEventListener("scroll", updateVisibility);
      window.removeEventListener("resize", updateVisibility);
    };
  }, []);

  return (
    <Link
      className={`${styles.floatingGuide} ${visible ? styles.floatingGuideVisible : ""}`}
      href="/loja/descobrir"
      aria-label="O Bispo ajuda você a escolher o seu café"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
    >
      <span aria-hidden="true" />
      <b>O Bispo ajuda você a escolher →</b>
    </Link>
  );
}
