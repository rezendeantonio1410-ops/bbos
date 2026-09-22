"use client";

import { FileText } from "lucide-react";

export function OrderPdfLink({ orderNumber, compact = false, provisional = false }: { orderNumber: string; compact?: boolean; provisional?: boolean }) {
  const href = `/pedido/documento/${encodeURIComponent(orderNumber)}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={compact
        ? "inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-2 text-[11px] font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
        : "inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-3 text-xs font-bold text-stone-800 transition hover:border-stone-300 hover:bg-stone-50"}
    >
      <FileText size={compact ? 13 : 14} />
      {compact ? (provisional ? "PDF provisório" : "PDF") : (provisional ? "Gerar PDF provisório" : "PDF / Conferência")}
    </a>
  );
}
