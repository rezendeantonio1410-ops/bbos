import Link from "next/link";
import type { ReactNode } from "react";

const links = [
  ["/financeiro", "Visão"],
  ["/financeiro/receber", "Receber"],
  ["/financeiro/pagar", "Pagar"],
  ["/financeiro/agenda-vendas", "Agenda de vendas"],
  ["/financeiro/fluxo-caixa", "Fluxo de caixa"],
  ["/financeiro/bancos-contas", "Bancos e contas"],
  ["/financeiro/conciliacao", "Conciliação"],
] as const;
export default function FinanceLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <nav
        aria-label="Navegação financeira"
        className="mb-4 flex max-w-full gap-1 overflow-x-auto rounded-2xl border bg-white p-1.5 shadow-sm"
      >
        {links.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            className="min-h-9 shrink-0 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 transition hover:bg-emerald-50 hover:text-forest-800"
          >
            {label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
