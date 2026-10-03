"use client";

import { useEffect, useRef, useState } from "react";

type RealFilmProps = {
  className?: string;
  videoClassName?: string;
  controlClassName?: string;
  desktopSrc: string;
  mobileSrc?: string;
  poster: string;
  label: string;
  loop?: boolean;
  showControl?: boolean;
  clipStart?: number;
  clipEnd?: number;
};

export default function RealFilm({
  className,
  videoClassName,
  controlClassName,
  desktopSrc,
  mobileSrc,
  poster,
  label,
  loop = true,
  showControl = true,
  clipStart,
  clipEnd,
}: RealFilmProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [source, setSource] = useState(desktopSrc);
  const [reducedMotion, setReducedMotion] = useState(true);
  const [visible, setVisible] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 760px)");
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    const syncPreferences = () => {
      setSource(mobileSrc && mobileQuery.matches ? mobileSrc : desktopSrc);
      setReducedMotion(motionQuery.matches);
    };

    syncPreferences();
    mobileQuery.addEventListener("change", syncPreferences);
    motionQuery.addEventListener("change", syncPreferences);

    return () => {
      mobileQuery.removeEventListener("change", syncPreferences);
      motionQuery.removeEventListener("change", syncPreferences);
    };
  }, [desktopSrc, mobileSrc]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || !("IntersectionObserver" in window)) {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry) setVisible(entry.isIntersecting);
      },
      { threshold: 0.16 },
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (reducedMotion || !visible) {
      video.pause();
      setPlaying(false);
      return;
    }

    if (!loop && video.ended) video.currentTime = 0;
    void video.play().catch(() => setPlaying(false));
  }, [loop, reducedMotion, source, visible]);

  const togglePlayback = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      if (
        clipStart !== undefined &&
        (video.currentTime < clipStart ||
          (clipEnd !== undefined && video.currentTime >= clipEnd))
      ) {
        video.currentTime = clipStart;
      }
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  };

  const positionAtClipStart = () => {
    const video = videoRef.current;
    if (!video || clipStart === undefined) return;
    video.currentTime = clipStart;
  };

  const keepInsideClip = () => {
    const video = videoRef.current;
    if (!video || clipEnd === undefined || video.currentTime < clipEnd) return;

    video.currentTime = clipStart ?? 0;
    if (loop && visible && !reducedMotion) {
      void video.play().catch(() => setPlaying(false));
    } else {
      video.pause();
    }
  };

  return (
    <div ref={frameRef} className={className}>
      <video
        key={source}
        ref={videoRef}
        className={videoClassName}
        src={source}
        poster={poster}
        muted
        loop={loop && clipEnd === undefined}
        playsInline
        preload="metadata"
        aria-label={label}
        onLoadedMetadata={positionAtClipStart}
        onTimeUpdate={keepInsideClip}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      {showControl ? (
        <button
          type="button"
          className={controlClassName}
          onClick={togglePlayback}
          aria-label={playing ? "Pausar vídeo" : "Reproduzir vídeo"}
        >
          <span aria-hidden="true">{playing ? "Ⅱ" : "▶"}</span>
          {playing ? "Pausar" : "Reproduzir"}
        </button>
      ) : null}
    </div>
  );
}
