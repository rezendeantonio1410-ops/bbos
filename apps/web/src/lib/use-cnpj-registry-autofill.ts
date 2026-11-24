"use client";

import { normalizeCnpj } from "@bbos/shared";
import { useEffect, useRef, useState } from "react";
import { cnpjRegistryStatusText, isValidCnpjDigits, lookupCnpjRegistry, type CnpjRegistryRecord } from "./cnpj-registry";

type Options = {
  cnpj: string;
  enabled?: boolean;
  delayMs?: number;
  /** `previous` is the company found before (to replace what it filled); `overwrite` is true on an explicit click. */
  onResolved: (record: CnpjRegistryRecord, context: { previous: CnpjRegistryRecord | null; overwrite: boolean }) => void;
};

/**
 * Looks up a complete, valid CNPJ once per value (automatic) and again on
 * `search()` (the "Buscar na Receita" button, which overwrites the fields).
 */
export function useCnpjRegistryAutofill({ cnpj, enabled = true, delayMs = 350, onResolved }: Options) {
  const [statusText, setStatusText] = useState("");
  const [busy, setBusy] = useState(false);
  const [warning, setWarning] = useState(false);
  const [record, setRecord] = useState<CnpjRegistryRecord | null>(null);
  const callbackRef = useRef(onResolved);
  const lastLookup = useRef("");
  const lastRecord = useRef<CnpjRegistryRecord | null>(null);
  const requestRef = useRef(0);
  useEffect(() => { callbackRef.current = onResolved; }, [onResolved]);

  const run = async (digits: string, overwrite: boolean) => {
    const id = ++requestRef.current;
    lastLookup.current = digits;
    setBusy(true); setWarning(false); setStatusText("Consultando CNPJ na Receita Federal...");
    const outcome = await lookupCnpjRegistry(digits);
    if (id !== requestRef.current) return;
    setBusy(false);
    if (outcome.kind === "found") {
      callbackRef.current(outcome.record, { previous: lastRecord.current, overwrite });
      lastRecord.current = outcome.record;
      setRecord(outcome.record);
      setStatusText(cnpjRegistryStatusText(outcome.record));
      setWarning(!outcome.record.active);
    } else {
      setRecord(null);
      setStatusText(outcome.message);
      setWarning(outcome.kind !== "error");
    }
  };

  /** Explicit one-click lookup: fetches again and fills every field. */
  const search = () => {
    const digits = normalizeCnpj(cnpj);
    if (digits.length !== 14 || !isValidCnpjDigits(digits)) {
      setStatusText("Informe os 14 caracteres do CNPJ para buscar.");
      setWarning(true);
      return;
    }
    void run(digits, true);
  };
  useEffect(() => {
    const digits = normalizeCnpj(cnpj);
    if (!enabled || digits.length !== 14) {
      requestRef.current += 1;
      setBusy(false);
      if (digits.length !== 14) { setStatusText(""); setWarning(false); setRecord(null); lastLookup.current = ""; }
      return;
    }
    if (!isValidCnpjDigits(digits)) { setStatusText("CNPJ inválido. Confira os 14 caracteres."); setWarning(true); return; }
    if (digits === lastLookup.current) return;
    const timer = window.setTimeout(() => void run(digits, false), delayMs);
    return () => window.clearTimeout(timer);
  }, [cnpj, delayMs, enabled]);
  return { statusText, busy, warning, record, search };
}
