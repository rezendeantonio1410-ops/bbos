import Link from "next/link";
import type { ReactNode } from "react";

const links=[
 ["/financeiro","Visão"],
 ["/financeiro/receber","Receber"],
 ["/financeiro/pagar","Pagar"],
 ["/financeiro/agenda-vendas","Agenda de vendas"],
 ["/financeiro/fluxo-caixa","Fluxo de caixa"],
 ["/financeiro/conciliacao","Conciliação"],
] as const;
export default function FinanceLayout({children}:{children:ReactNode}){
 return <><div className="mb-5 flex flex-wrap gap-2 rounded-2xl border bg-white p-2">{links.map(([href,label])=><Link key={href} href={href} className="rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-violet-50 hover:text-violet-700">{label}</Link>)}</div>{children}</>;
}
