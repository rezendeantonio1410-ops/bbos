"use client";

import { useState } from "react";
import { getApiBaseUrl } from "@/lib/api-url";

export const ROASTED_LINES = [
  { code: "GOURMET", label: "Gourmet" },
  { code: "CLASSICOS", label: "Clássicos" },
  { code: "EPICOS", label: "Épicos" },
  { code: "RAROS", label: "Raros" },
] as const;

/** Escolha de até 3 linhas em que o café verde será usado (torra, blend). */
export function LotLinesPicker({ value, onChange, disabled }: { value: string[]; onChange: (lines: string[]) => void; disabled?: boolean }) {
  const toggle = (code: string) => {
    if (value.includes(code)) onChange(value.filter((item) => item !== code));
    else if (value.length < 3) onChange([...value, code]);
  };
  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Linhas em que o café será usado">
        {ROASTED_LINES.map((line) => {
          const on = value.includes(line.code);
          const blocked = !on && value.length >= 3;
          return (
            <button key={line.code} type="button" aria-pressed={on} disabled={disabled || blocked} onClick={() => toggle(line.code)}
              className={`rounded-full border px-3.5 py-2 text-xs font-bold transition ${on ? "border-teal-700 bg-teal-700 text-white" : "border-stone-200 bg-white text-stone-700"} disabled:opacity-40`}>
              {line.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-stone-500">Até 3 linhas. Usado para calcular o custo dos cafés de cada linha na Inteligência.</p>
    </div>
  );
}

/** Versão que salva direto no lote (Estoque). */
export function LotLinesEditor({ lotId, initial, onSaved }: { lotId: string; initial: string[]; onSaved?: (lines: string[]) => void }) {
  const [lines, setLines] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const save = async (next: string[]) => {
    const previous = lines;
    setLines(next);
    setBusy(true);
    setMessage("");
    const response = await fetch(`${getApiBaseUrl()}/inventory/lots/${lotId}/lines`, {
      method: "PATCH", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ lines: next }),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = response ? ((await response.json().catch(() => ({}))) as { message?: string }) : {};
      setLines(previous);
      setMessage(body.message ?? "Não foi possível salvar as linhas.");
      return;
    }
    setMessage("Linhas salvas.");
    onSaved?.(next);
  };
  return (
    <div>
      <p className="mb-2 text-xs font-bold text-stone-700">Linhas de uso deste café</p>
      <LotLinesPicker value={lines} onChange={(next) => void save(next)} disabled={busy} />
      {message && <p role="status" className="mt-1 text-[11px] font-semibold text-stone-600">{message}</p>}
    </div>
  );
}
