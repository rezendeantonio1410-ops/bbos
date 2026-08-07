"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/custos", "Visão Geral"], ["/custos/lancamentos", "Lançamentos"], ["/custos/centros", "Centros de Custo"],
  ["/custos/maquinas", "Máquinas e Equipamentos"], ["/custos/tarifas", "Tarifas"], ["/custos/rateios", "Rateios"], ["/custos/fechamentos", "Fechamentos"],
] as const;

export function CostNavigation() {
  const pathname = usePathname();
  return <nav aria-label="Navegação de custos" className="mt-5 flex gap-1 overflow-x-auto rounded-2xl border border-[#E8ECEB] bg-white p-1.5 shadow-[0_8px_24px_rgba(20,35,33,.04)]">
    {items.map(([href,label]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-semibold transition ${pathname === href ? "bg-forest-900 text-white" : "text-stone-600 hover:bg-forest-50 hover:text-forest-900"}`}>{label}</Link>)}
  </nav>;
}
