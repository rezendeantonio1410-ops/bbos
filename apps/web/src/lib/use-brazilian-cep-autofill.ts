"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  brazilianCepDigits,
  isCompleteBrazilianCep,
  lookupBrazilianCep,
  type CepLookupResult,
} from "./brazil-address";

export type CepLookupStatus =
  "idle" | "loading" | "found" | "not-found" | "error";

type Options = {
  postalCode: string;
  enabled?: boolean;
  delayMs?: number;
  onResolved: (result: CepLookupResult) => void;
};

export const cepLookupStatusText = (status: CepLookupStatus) => {
  if (status === "loading") return "Consultando CEP...";
  if (status === "found") return "Endereço preenchido automaticamente.";
  if (status === "not-found")
    return "CEP não encontrado. Confira os números ou preencha manualmente.";
  if (status === "error")
    return "Consulta indisponível agora. Você pode preencher manualmente.";
  return "";
};

export function useBrazilianCepAutofill({
  postalCode,
  enabled = true,
  delayMs = 300,
  onResolved,
}: Options) {
  const [status, setStatus] = useState<CepLookupStatus>("idle");
  const callbackRef = useRef(onResolved);
  const requestRef = useRef(0);

  useEffect(() => {
    callbackRef.current = onResolved;
  }, [onResolved]);

  const lookup = useCallback(
    async (value = postalCode) => {
      const digits = brazilianCepDigits(value);
      if (!enabled || digits.length !== 8) {
        setStatus("idle");
        return null;
      }
      const requestId = ++requestRef.current;
      setStatus("loading");
      try {
        const result = await lookupBrazilianCep(digits);
        if (requestId !== requestRef.current) return null;
        if (!result) {
          setStatus("not-found");
          return null;
        }
        callbackRef.current(result);
        setStatus("found");
        return result;
      } catch {
        if (requestId === requestRef.current) setStatus("error");
        return null;
      }
    },
    [enabled, postalCode],
  );

  useEffect(() => {
    if (!enabled || !isCompleteBrazilianCep(postalCode)) {
      requestRef.current += 1;
      setStatus("idle");
      return;
    }
    const timer = window.setTimeout(() => void lookup(), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs, enabled, lookup, postalCode]);

  return {
    status,
    busy: status === "loading",
    lookup,
    statusText: cepLookupStatusText(status),
  };
}
