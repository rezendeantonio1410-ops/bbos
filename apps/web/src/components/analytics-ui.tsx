"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Download } from "lucide-react";

/** Shared pieces for the analytics panels (SAP Fiori KPI header / Fluent pivot). */
export type KpiItem = { label: string; value: string; note?: string; tone?: "neutral" | "ok" | "attention" | "critical"; href?: string; spark?: number[] };

const toneText = { neutral: "text-[var(--bbos-text-secondary)]", ok: "text-[var(--bbos-success)]", attention: "text-[var(--bbos-warning)]", critical: "text-[var(--bbos-danger)]" } as const;

export function KpiStrip({ items, label = "Indicadores" }: { items: KpiItem[]; label?: string }) {
  return (
    <dl aria-label={label} className="grid grid-cols-2 overflow-hidden rounded-2xl border bg-white sm:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const body = (
          <>
            <dt className="text-xs text-[var(--bbos-text-secondary)]">{item.label}</dt>
            <dd className="mt-1 truncate text-xl font-semibold tabular-nums tracking-tight" title={item.value}>{item.value}</dd>
            {item.spark && item.spark.length > 1 ? <Sparkline values={item.spark} /> : null}
            {item.note && <dd className={`mt-0.5 text-[11.5px] font-medium ${toneText[item.tone ?? "neutral"]}`}>{item.note}</dd>}
          </>
        );
        return (
          <div key={item.label} className="min-w-0 border-b border-r border-[#eef1ed] px-4 py-3 last:border-r-0">
            {item.href ? (
              <Link href={item.href} className="block rounded-md hover:bg-[var(--bbos-surface-subtle)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--bbos-focus-ring)]">
                {body}
              </Link>
            ) : (
              body
            )}
          </div>
        );
      })}
    </dl>
  );
}

export function Sparkline({ values, width = 110, height = 22 }: { values: number[]; width?: number; height?: number }) {
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const points = values
    .map((value, index) => `${(index / (values.length - 1)) * width},${height - ((value - min) / (max - min || 1)) * (height - 2) - 1}`)
    .join(" ");
  return (
    <svg aria-hidden width={width} height={height} className="mt-1">
      <polyline points={points} fill="none" stroke="#2F6B57" strokeWidth={2} strokeLinejoin="round" />
    </svg>
  );
}

export function Segmented<T extends string>({ options, value, onChange, label }: { options: Array<{ value: T; label: string }>; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-9 rounded-full border px-3.5 text-xs font-semibold transition ${value === option.value ? "border-[var(--bbos-action-primary)] bg-[var(--bbos-action-primary)] text-white" : "border-[var(--bbos-border)] bg-white text-[var(--bbos-text-primary)] hover:bg-[var(--bbos-surface-subtle)]"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Panel({ title, action, children, className = "" }: { title: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border bg-white p-4 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export function PendingDataNote({ children, href, cta }: { children: ReactNode; href?: string; cta?: string }) {
  return (
    <p className="rounded-xl border border-dashed bg-[var(--bbos-surface-subtle)] px-3 py-2 text-xs text-[var(--bbos-text-secondary)]">
      {children}{" "}
      {href && cta && (
        <Link href={href} className="font-semibold text-[var(--bbos-coffee-green)]">
          {cta} →
        </Link>
      )}
    </p>
  );
}

/** Spreadsheet export (CSV with ; and BOM, opens correctly in Excel pt-BR). */
export function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const csv =
    "﻿" +
    rows
      .map((row) =>
        row
          .map((value) => (typeof value === "number" ? value.toLocaleString("pt-BR", { maximumFractionDigits: 2, useGrouping: false }) : `"${String(value).replace(/"/g, '""')}"`))
          .join(";"),
      )
      .join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[var(--bbos-border)] bg-white px-3.5 text-xs font-semibold hover:bg-[var(--bbos-surface-subtle)]">
      <Download size={14} /> Exportar
    </button>
  );
}

export const PERIOD_OPTIONS = [
  { value: "day" as const, label: "Dia" },
  { value: "week" as const, label: "Semana" },
  { value: "month" as const, label: "Mês" },
  { value: "year" as const, label: "Ano" },
];
export type PanelPeriod = (typeof PERIOD_OPTIONS)[number]["value"];
export const periodNoun: Record<PanelPeriod, string> = { day: "hoje", week: "nos últimos 7 dias", month: "no mês", year: "no ano" };
