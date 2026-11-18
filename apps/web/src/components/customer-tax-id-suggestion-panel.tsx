"use client";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  FileSearch,
  Loader2,
  PencilLine,
  RotateCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  canonicalCnpj,
  isConfirmedTaxIdSuggestionStatus,
} from "@/components/customer-tax-id-suggestion-contract";

export type CustomerTaxIdSuggestion = {
  id?: string | null;
  status?: "DRAFT" | "SELECTED" | "CONFIRMED" | string | null;
  taxId: string;
  legalName: string;
  tradeName?: string | null;
  address: string;
  sourceLabel: string;
  confidence: number;
  matchReasons?: string[];
};

export type CustomerTaxIdSuggestionPanelProps = {
  suggestions: CustomerTaxIdSuggestion[];
  status?: "idle" | "loading" | "ready" | "error";
  selectedTaxId?: string | null;
  confirmedTaxId?: string | null;
  error?: string | null;
  confirming?: boolean;
  disabled?: boolean;
  onSelect: (suggestion: CustomerTaxIdSuggestion) => void;
  onConfirm: (suggestion: CustomerTaxIdSuggestion) => void;
  onSearchAgain?: () => void;
  onNoneMatch: () => void;
  onManualEntry: () => void;
};

export function normalizeTaxId(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCnpj(value: string) {
  const digits = normalizeTaxId(value).slice(0, 14);
  if (digits.length !== 14) return value;
  return digits.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5",
  );
}

export function confidenceLabel(confidence: number) {
  if (confidence >= 0.85) return "Compatibilidade alta";
  if (confidence >= 0.65) return "Compatibilidade média";
  return "Revisar com atenção";
}

function sameTaxId(left?: string | null, right?: string | null) {
  const leftCnpj = canonicalCnpj(left);
  const rightCnpj = canonicalCnpj(right);
  return Boolean(leftCnpj && rightCnpj && leftCnpj === rightCnpj);
}

export function CustomerTaxIdSuggestionPanel({
  suggestions,
  status = "ready",
  selectedTaxId,
  confirmedTaxId,
  error,
  confirming = false,
  disabled = false,
  onSelect,
  onConfirm,
  onSearchAgain,
  onNoneMatch,
  onManualEntry,
}: CustomerTaxIdSuggestionPanelProps) {
  const visibleSuggestions = suggestions
    .filter((suggestion) => Boolean(canonicalCnpj(suggestion.taxId)))
    .slice(0, 3);
  const selected = visibleSuggestions.find((suggestion) =>
    sameTaxId(suggestion.taxId, selectedTaxId),
  );
  const confirmed = visibleSuggestions.find(
    (suggestion) =>
      isConfirmedTaxIdSuggestionStatus(suggestion.status) &&
      sameTaxId(suggestion.taxId, confirmedTaxId),
  );

  if (confirmed) {
    return (
      <section
        className="rounded-[22px] border border-emerald-200 bg-emerald-50/70 p-4 sm:p-5"
        aria-label="CNPJ confirmado"
      >
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm">
            <ShieldCheck size={19} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-emerald-700">
              CNPJ confirmado
            </p>
            <p className="mt-1 text-base font-bold text-stone-950">
              {confirmed.legalName}
            </p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-stone-700">
              {formatCnpj(confirmed.taxId)}
            </p>
            <p className="mt-1 text-xs leading-5 text-stone-500">
              {confirmed.address}
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="overflow-hidden rounded-[22px] border border-stone-200 bg-white shadow-[0_12px_32px_rgba(18,34,29,.045)]"
      aria-labelledby="tax-id-suggestion-title"
    >
      <div className="flex flex-col gap-3 border-b border-stone-100 bg-[#FAFAF8] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#EAF6F2] text-[#087568]">
            <FileSearch size={19} aria-hidden="true" />
          </span>
          <div>
            <p
              id="tax-id-suggestion-title"
              className="text-sm font-bold text-stone-950"
            >
              CNPJ sugerido pelo BBOS
            </p>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-500">
              Confira nome e endereço. A sugestão permanece como rascunho e não
              entra em pedido ou NF-e sem sua confirmação.
            </p>
          </div>
        </div>
        {onSearchAgain && status !== "loading" && (
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700 transition hover:border-[#087568]/30 hover:text-[#087568] disabled:cursor-not-allowed disabled:opacity-50 sm:min-h-9"
            onClick={onSearchAgain}
            disabled={disabled || confirming}
          >
            <RotateCcw size={14} aria-hidden="true" /> Buscar novamente
          </button>
        )}
      </div>

      <div className="p-4 sm:p-5">
        {status === "loading" && (
          <div
            className="flex min-h-32 items-center justify-center gap-3 rounded-2xl border border-dashed border-stone-200 bg-stone-50 text-sm font-semibold text-stone-600"
            role="status"
          >
            <Loader2
              size={18}
              className="animate-spin text-[#087568]"
              aria-hidden="true"
            />{" "}
            Buscando correspondências seguras…
          </div>
        )}

        {status === "error" && (
          <div
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-800"
            role="alert"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-bold">
                  Não foi possível buscar o CNPJ agora.
                </p>
                <p className="mt-1 text-xs leading-5">
                  {error ||
                    "Tente novamente ou informe o documento manualmente."}
                </p>
              </div>
            </div>
          </div>
        )}

        {status !== "loading" &&
          status !== "error" &&
          visibleSuggestions.length === 0 && (
            <div className="rounded-2xl border border-dashed border-stone-200 bg-stone-50 p-5 text-center">
              <p className="text-sm font-bold text-stone-800">
                Nenhuma correspondência segura encontrada.
              </p>
              <p className="mt-1 text-xs leading-5 text-stone-500">
                A visita pode ser salva com o CNPJ pendente ou o documento pode
                ser informado manualmente.
              </p>
            </div>
          )}

        {status !== "loading" &&
          status !== "error" &&
          visibleSuggestions.length > 0 && (
            <div
              className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"
              role="list"
              aria-label="Possíveis CNPJs"
            >
              {visibleSuggestions.map((suggestion) => {
                const isSelected = sameTaxId(suggestion.taxId, selectedTaxId);
                return (
                  <article
                    key={normalizeTaxId(suggestion.taxId)}
                    className={`relative flex min-h-full flex-col rounded-2xl border p-4 transition ${isSelected ? "border-[#087568] bg-[#F3FAF7] ring-2 ring-[#087568]/10" : "border-stone-200 bg-white hover:border-[#087568]/30"}`}
                    role="listitem"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-stone-950">
                          {suggestion.tradeName || suggestion.legalName}
                        </p>
                        {suggestion.tradeName && (
                          <p className="mt-1 line-clamp-2 text-xs text-stone-500">
                            {suggestion.legalName}
                          </p>
                        )}
                      </div>
                      {isSelected && (
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#087568] text-white">
                          <Check size={15} aria-hidden="true" />
                        </span>
                      )}
                    </div>

                    <p className="mt-3 font-mono text-sm font-semibold text-stone-800">
                      {formatCnpj(suggestion.taxId)}
                    </p>
                    <p className="mt-2 min-h-10 text-xs leading-5 text-stone-500">
                      {suggestion.address}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#EAF6F2] px-2.5 py-1 text-[10px] font-extrabold text-[#087568]">
                        {confidenceLabel(suggestion.confidence)}
                      </span>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[10px] font-bold text-stone-500">
                        {suggestion.sourceLabel}
                      </span>
                    </div>

                    {suggestion.matchReasons &&
                      suggestion.matchReasons.length > 0 && (
                        <ul className="mt-3 space-y-1 text-[11px] leading-4 text-stone-500">
                          {suggestion.matchReasons.slice(0, 3).map((reason) => (
                            <li key={reason} className="flex gap-2">
                              <CheckCircle2
                                size={12}
                                className="mt-0.5 shrink-0 text-[#087568]"
                                aria-hidden="true"
                              />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      )}

                    <button
                      type="button"
                      className={`mt-4 min-h-11 w-full rounded-xl border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${isSelected ? "border-[#087568] bg-white text-[#087568]" : "border-stone-200 bg-stone-50 text-stone-700 hover:border-[#087568]/40 hover:bg-[#F3FAF7] hover:text-[#087568]"}`}
                      onClick={() => onSelect(suggestion)}
                      disabled={disabled || confirming}
                      aria-pressed={isSelected}
                    >
                      {isSelected ? "CNPJ selecionado" : "Selecionar este CNPJ"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}

        {error && status !== "error" && (
          <div
            className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700"
            role="alert"
          >
            <AlertTriangle
              size={15}
              className="mt-0.5 shrink-0"
              aria-hidden="true"
            />{" "}
            {error}
          </div>
        )}

        {selected && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={18}
                className="mt-0.5 shrink-0 text-amber-700"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-stone-900">
                  Confirme somente depois de conferir os dados.
                </p>
                <p className="mt-1 text-xs leading-5 text-stone-600">
                  Selecionado: <strong>{formatCnpj(selected.taxId)}</strong> ·{" "}
                  {selected.legalName}. Até a confirmação, o CNPJ continua sendo
                  apenas um rascunho.
                </p>
                <button
                  type="button"
                  className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0B2924] px-4 text-sm font-bold text-white shadow-sm transition hover:bg-[#087568] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  onClick={() => onConfirm(selected)}
                  disabled={disabled || confirming}
                >
                  {confirming ? (
                    <Loader2
                      size={16}
                      className="animate-spin"
                      aria-hidden="true"
                    />
                  ) : (
                    <ShieldCheck size={16} aria-hidden="true" />
                  )}
                  {confirming ? "Confirmando…" : "Confirmar este CNPJ"}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-stone-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-bold text-stone-600 transition hover:bg-stone-50 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onNoneMatch}
            disabled={disabled || confirming}
          >
            <X size={16} aria-hidden="true" /> Nenhum corresponde
          </button>
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 transition hover:border-[#087568]/30 hover:text-[#087568] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={onManualEntry}
            disabled={disabled || confirming}
          >
            <PencilLine size={16} aria-hidden="true" /> Informar CNPJ
            manualmente
          </button>
        </div>
      </div>
    </section>
  );
}
