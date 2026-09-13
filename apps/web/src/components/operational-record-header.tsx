"use client";

import { AlertTriangle, Check, ChevronRight, Circle, Clock3, LockKeyhole } from "lucide-react";
import type { ReactNode } from "react";

export type OperationalStage = {
  label: string;
  state: "done" | "current" | "future" | "blocked";
  detail?: string;
};

export function OperationalRecordHeader({
  eyebrow,
  title,
  subtitle,
  status,
  statusTone = "neutral",
  stages = [],
  blocker,
  nextAction,
  nextActionDetail,
  action,
  meta,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  status: string;
  statusTone?: "success" | "attention" | "critical" | "information" | "neutral";
  stages?: OperationalStage[];
  blocker?: string | null;
  nextAction?: string | null;
  nextActionDetail?: string | null;
  action?: ReactNode;
  meta?: ReactNode;
}) {
  const tone = {
    success: "bg-emerald-50 text-emerald-700 border-emerald-100",
    attention: "bg-amber-50 text-amber-700 border-amber-100",
    critical: "bg-red-50 text-red-700 border-red-100",
    information: "bg-blue-50 text-blue-700 border-blue-100",
    neutral: "bg-stone-100 text-stone-600 border-stone-200",
  }[statusTone];

  return (
    <section className="overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-[0_14px_38px_rgba(18,34,29,.055)]">
      <div className="flex flex-col gap-5 px-5 py-5 sm:px-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#087568]">{eyebrow}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">{title}</h1>
            <span className={`rounded-full border px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide ${tone}`}>{status}</span>
          </div>
          {subtitle && <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">{subtitle}</p>}
          {meta && <div className="mt-3 text-xs text-stone-500">{meta}</div>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>

      {stages.length > 0 && (
        <div className="border-y border-stone-100 bg-[#FAFAF8] px-5 py-4 sm:px-6">
          <div className="flex min-w-max items-center gap-2 overflow-x-auto pb-1">
            {stages.map((stage, index) => {
              const Icon = stage.state === "done" ? Check : stage.state === "blocked" ? LockKeyhole : stage.state === "current" ? Clock3 : Circle;
              const classes = stage.state === "done"
                ? "border-emerald-100 bg-emerald-50 text-emerald-700"
                : stage.state === "current"
                  ? "border-[#087568]/20 bg-[#EAF6F2] text-[#087568]"
                  : stage.state === "blocked"
                    ? "border-red-100 bg-red-50 text-red-700"
                    : "border-stone-200 bg-white text-stone-400";
              return (
                <div key={`${stage.label}-${index}`} className="flex items-center gap-2">
                  <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${classes}`}>
                    <Icon size={14} />
                    <div>
                      <p className="text-[11px] font-bold">{stage.label}</p>
                      {stage.detail && <p className="mt-0.5 text-[9px] opacity-75">{stage.detail}</p>}
                    </div>
                  </div>
                  {index < stages.length - 1 && <ChevronRight size={14} className="text-stone-300" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(blocker || nextAction) && (
        <div className="grid gap-3 px-5 py-4 sm:px-6 md:grid-cols-2">
          <div className={`rounded-2xl border p-4 ${blocker ? "border-amber-100 bg-amber-50/70" : "border-stone-100 bg-stone-50"}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 grid size-8 place-items-center rounded-xl ${blocker ? "bg-white text-amber-700" : "bg-white text-stone-400"}`}><AlertTriangle size={15} /></span>
              <div><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-stone-400">Bloqueio / atenção</p><p className="mt-1 text-sm font-semibold text-stone-800">{blocker || "Nenhum bloqueio operacional identificado."}</p></div>
            </div>
          </div>
          <div className="rounded-2xl border border-[#087568]/10 bg-[#F3FAF7] p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-[#087568]">Próxima ação</p>
            <p className="mt-1 text-sm font-bold text-stone-900">{nextAction || "Fluxo concluído"}</p>
            {nextActionDetail && <p className="mt-1 text-xs leading-5 text-stone-500">{nextActionDetail}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
