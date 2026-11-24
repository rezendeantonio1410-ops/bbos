"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function recognitionConstructor(): (new () => Recognition) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "Permita o uso do microfone para ditar o relato.",
  "service-not-allowed": "Permita o uso do microfone para ditar o relato.",
  "no-speech": "Não ouvi nada. Toque no microfone e fale novamente.",
  network: "Sem internet para converter a voz em texto.",
  "audio-capture": "Microfone não encontrado.",
};

/**
 * Voice dictation in Portuguese using the browser's speech recognition
 * (Chrome/Android, Safari/iPad). Each final phrase is appended through
 * `onText`; the live, unfinished phrase is exposed as `interim`.
 */
export function useSpeechDictation(onText: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recognition = useRef<Recognition | null>(null);
  const wanted = useRef(false);
  const callback = useRef(onText);
  useEffect(() => { callback.current = onText; }, [onText]);
  useEffect(() => { setSupported(Boolean(recognitionConstructor())); }, []);

  const stop = useCallback(() => {
    wanted.current = false;
    recognition.current?.stop();
    setListening(false);
    setInterim("");
  }, []);

  const start = useCallback(() => {
    const Constructor = recognitionConstructor();
    if (!Constructor) return;
    setError("");
    const instance = new Constructor();
    instance.lang = "pt-BR";
    instance.continuous = true;
    instance.interimResults = true;
    instance.onresult = (event) => {
      let live = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]?.transcript ?? "";
        if (result.isFinal) callback.current(text.trim());
        else live += text;
      }
      setInterim(live);
    };
    instance.onerror = (event) => {
      if (event.error === "aborted") return;
      setError(ERROR_TEXT[event.error] ?? "Não foi possível usar o microfone agora.");
      if (event.error !== "no-speech") wanted.current = false;
    };
    // Browsers stop after a pause; keep listening until the user taps stop.
    instance.onend = () => {
      if (wanted.current) {
        try { instance.start(); return; } catch { /* falls through */ }
      }
      setListening(false);
      setInterim("");
    };
    recognition.current = instance;
    wanted.current = true;
    try {
      instance.start();
      setListening(true);
    } catch {
      setError("Não foi possível usar o microfone agora.");
    }
  }, []);

  useEffect(() => () => { wanted.current = false; recognition.current?.abort(); }, []);
  return { supported, listening, interim, error, start, stop };
}
