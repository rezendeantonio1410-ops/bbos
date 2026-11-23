"use client";

import { useEffect, useRef, useState } from "react";
import { cnpjRegistryStatusText, isValidCnpjDigits, lookupCnpjRegistry, type CnpjRegistryRecord } from "./cnpj-registry";

type Options = {
  cnpj: string;
  enabled?: boolean;
  delayMs?: number;
  onResolved: (record: CnpjRegistryRecord) => void;
};

/** Looks up a complete, valid CNPJ once per value and reports a status line. */
export function useCnpjRegistryAutofill({ cnpj, enabled = true, delayMs = 350, onResolved }: Options) {
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState(false);
  const callbackRef = useRef(onResolved);
  const lastLookup = useRef("");
  const requestRef = useRef(0);
  useEffect(() => { callbackRef.current = onResolved; }, [onResolved]);
  useEffect(() => {
    const digits = cnpj.replace(/\D/g, "");
    if (!enabled || digits.length !== 14) {
      requestRef.current += 1;
      setBusy(false);
      if (digits.length !== 14) { setStatusText(""); setWarning(false); lastLookup.current = ""; }
      return;
    }
    if (!isValidCnpjDigits(digits)) { setStatusText("CNPJ inválido. Confira os dígitos."); setWarning(true); return; }
    if (digits === lastLookup.current) return;
    const timer = window.setTimeout(async () => {
      const id = ++requestRef.current;
      lastLookup.current = digits;
      setBusy(true); setWarning(false); setStatusText("Consultando CNPJ na Receita Federal...");
      const outcome = await lookupCnpjRegistry(digits);
      if (id !== requestRef.current) return;
      setBusy(false);
      if (outcome.kind === "found") {
        callbackRef.current(outcome.record);
        setStatusText(cnpjRegistryStatusText(outcome.record));
        setWarning(!outcome.record.active);
      } else {
        setStatusText(outcome.message);
        setWarning(outcome.kind !== "error");
      }
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [cnpj, delayMs, enabled]);
  return { statusText, busy, warning };
}
