"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { journeyIndex } from "@/lib/exports";

export const inputClass =
  "min-h-11 w-full rounded-xl border border-[var(--bbos-border)] bg-white px-3 text-[15px] outline-none focus:border-[var(--bbos-coffee-green)]";
export const buttonClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--bbos-border)] bg-white px-3.5 text-sm font-semibold hover:bg-[var(--bbos-surface-subtle)] disabled:opacity-50";
export const primaryClass =
  "inline-flex min-h-10 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-[var(--bbos-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--bbos-action-primary-hover)] disabled:opacity-50";
export const cardClass = "rounded-2xl border border-[var(--bbos-border)] bg-white";

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <label className={`grid gap-1 text-[13px] font-semibold ${wide ? "sm:col-span-2" : ""}`}>
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-[var(--bbos-text-secondary)]">{hint}</span>}
    </label>
  );
}

/** Side panel on desktop, full screen on phones. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  React.useEffect(() => {
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [onClose]);
  // Portal to <body>: the page content sits in a stacking context below the app header.
  if (typeof document === "undefined") return null;
  return createPortal(
    <div className="fixed inset-0 z-[90] flex justify-end bg-black/30" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Fechar" className="flex-1 cursor-default" onClick={onClose} />
      <section className="flex h-full w-full max-w-[560px] flex-col bg-[var(--bbos-surface,#fff)] shadow-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-[var(--bbos-border)] px-5 py-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="grid size-10 place-items-center rounded-full hover:bg-[var(--bbos-surface-subtle)]">
            <X size={18} />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </section>
    </div>,
    document.body,
  );
}

const JOURNEY_LABELS = ["Preparada", "Enviada", "Em trânsito", "Entregue", "Avaliada"];

/** Five dots from prepared to evaluated; the current one is a ring (amber when it needs attention). */
export function Journey({ status, warn }: { status: string; warn?: boolean }) {
  const current = journeyIndex(status);
  const labels = [...JOURNEY_LABELS];
  if (status === "CUSTOMS") labels[2] = "Alfândega";
  return (
    <div aria-label={`Etapa: ${labels[current]}`}>
      <div className="flex items-center">
        {labels.map((label, index) => (
          <React.Fragment key={label}>
            {index > 0 && <span className={`h-[3px] flex-1 ${index <= current ? "bg-[var(--bbos-success)]" : "bg-[#d6dcd6]"}`} />}
            <span
              className={`shrink-0 rounded-full ${
                index < current || (index === current && status === "EVALUATED")
                  ? "size-3 bg-[var(--bbos-success)]"
                  : index === current
                    ? `size-4 border-[3px] bg-white ${warn ? "border-[var(--bbos-warning)]" : "border-[var(--bbos-success)]"}`
                    : "size-3 bg-[#d6dcd6]"
              }`}
            />
          </React.Fragment>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[10.5px] text-[var(--bbos-text-secondary)]">
        {labels.map((label) => <span key={label}>{label}</span>)}
      </div>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return message ? <p role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[var(--bbos-danger)]">{message}</p> : null;
}
