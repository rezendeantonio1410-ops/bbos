"use client";

import {
  Children,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import styles from "./layers.module.css";

export type CoffeeLineOption = {
  name: string;
  slug: string;
  eyebrow: string;
  copy: string;
  format: string;
  tone: string;
};

export default function CoffeeLineExplorer({
  lines,
  children,
}: {
  lines: CoffeeLineOption[];
  children: ReactNode;
}) {
  const [activeSlug, setActiveSlug] = useState(lines[0]?.slug ?? "");
  const panels = Children.toArray(children);

  useEffect(() => {
    const selectFromHash = () => {
      const hash = window.location.hash.replace(/^#camada-/, "");
      if (lines.some((line) => line.slug === hash)) setActiveSlug(hash);
    };

    selectFromHash();
    window.addEventListener("hashchange", selectFromHash);
    return () => window.removeEventListener("hashchange", selectFromHash);
  }, [lines]);

  const selectLine = (slug: string, scroll = true) => {
    setActiveSlug(slug);
    window.history.replaceState(null, "", `#camada-${slug}`);

    if (!scroll) return;
    window.requestAnimationFrame(() => {
      const panel = document.getElementById(`painel-${slug}`);
      panel?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    });
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
    )
      return;

    event.preventDefault();
    const direction =
      event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextIndex = (index + direction + lines.length) % lines.length;
    const next = lines[nextIndex];
    if (!next) return;

    selectLine(next.slug, false);
    document.getElementById(`linha-${next.slug}`)?.focus();
  };

  return (
    <div className={styles.explorer}>
      <div className={styles.mobileLineIntro}>
        <small>QUATRO LINHAS</small>
        <h3>Encontre o seu Bispo.</h3>
        <p>
          Da xícara equilibrada às experiências mais raras, cada linha traduz
          uma maneira de viver o café.
        </p>
      </div>

      <div
        className={styles.mobileLineGrid}
        role="tablist"
        aria-label="Escolha uma linha de cafés"
      >
        {lines.map((line, index) => {
          const active = line.slug === activeSlug;
          return (
            <button
              key={line.slug}
              id={`linha-${line.slug}`}
              className={`${styles.mobileLineCard} ${active ? styles.mobileLineCardActive : ""}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`painel-${line.slug}`}
              tabIndex={active ? 0 : -1}
              onClick={() => selectLine(line.slug)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              style={{ "--layer-tone": line.tone } as CSSProperties}
            >
              <i aria-hidden="true" />
              <small>{line.eyebrow}</small>
              <strong>{line.name}</strong>
              <p>{line.copy}</p>
              <span>{line.format}</span>
            </button>
          );
        })}
      </div>

      <nav className={styles.filter} aria-label="Linhas de cafés">
        {lines.map((line) => (
          <a key={line.slug} href={`#camada-${line.slug}`}>
            {line.name}
          </a>
        ))}
      </nav>

      <div className={styles.catalogPanels}>
        {panels.map((panel, index) => {
          const line = lines[index];
          if (!line) return panel;
          const active = line.slug === activeSlug;

          return (
            <div
              key={line.slug}
              id={`painel-${line.slug}`}
              className={`${styles.catalogPanel} ${active ? styles.catalogPanelActive : ""}`}
              role="tabpanel"
              aria-labelledby={`linha-${line.slug}`}
            >
              {panel}
            </div>
          );
        })}
      </div>
    </div>
  );
}
