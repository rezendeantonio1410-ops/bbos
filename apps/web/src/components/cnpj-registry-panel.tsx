"use client";

import { Building2, Loader2, Search } from "lucide-react";
import { cnpjRegistrySummary, type CnpjRegistryRecord } from "@/lib/cnpj-registry";

/** One-click "Buscar na Receita" button placed next to the CNPJ input. */
export function CnpjSearchButton({ onClick, busy, className = "" }: { onClick: () => void; busy: boolean; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 text-xs font-semibold text-stone-800 hover:bg-stone-50 disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Search size={14} aria-hidden />}
      {busy ? "Buscando..." : "Buscar na Receita"}
    </button>
  );
}

/**
 * Everything the free public registry returned, read-only. The form fields
 * above it were already filled and stay editable.
 */
export function CnpjRegistryPanel({ record }: { record: CnpjRegistryRecord | null }) {
  if (!record) return null;
  const rows = cnpjRegistrySummary(record);
  const secondary = record.details?.secondaryActivities ?? [];
  const partners = record.details?.partners ?? [];
  return (
    <section aria-label="Dados da Receita Federal" className="rounded-xl border border-stone-200 bg-stone-50/70 p-3 text-xs">
      <p className="mb-2 flex items-center gap-1.5 font-semibold text-stone-800">
        <Building2 size={14} aria-hidden /> Dados da Receita Federal
        <span className={`ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold ${record.active ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>
          {record.active ? "Ativa" : record.registrationStatus}
        </span>
      </p>
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className={row.label === "Atividade principal" || row.label === "Inscrição estadual" ? "sm:col-span-2" : ""}>
            <dt className="text-[10px] uppercase tracking-wide text-stone-500">{row.label}</dt>
            <dd className="text-stone-800">{row.value}</dd>
          </div>
        ))}
      </dl>
      {secondary.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-stone-700">Atividades secundárias ({secondary.length})</summary>
          <ul className="mt-1 space-y-0.5 text-stone-700">
            {secondary.map((item) => <li key={item.code}>{item.code} · {item.description}</li>)}
          </ul>
        </details>
      )}
      {partners.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer font-semibold text-stone-700">Sócios ({partners.length})</summary>
          <ul className="mt-1 space-y-0.5 text-stone-700">
            {partners.map((item) => <li key={`${item.name}-${item.since ?? ""}`}>{item.name}{item.role ? ` · ${item.role}` : ""}</li>)}
          </ul>
        </details>
      )}
      <p className="mt-2 text-[10px] text-stone-500">Fonte: cadastro público da Receita Federal (BrasilAPI e cnpj.ws, gratuitos). Os campos acima já foram preenchidos e podem ser editados.</p>
    </section>
  );
}
