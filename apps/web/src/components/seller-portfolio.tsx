"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, MessageCircle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Status = "COBRANCA" | "NOVO" | "ESFRIANDO" | "RECOMPRA" | "EM_DIA";
type PortfolioCustomer = {
  id: string; name: string; phone: string | null; status: Status; orders: number; daysSince: number | null;
  rhythm: number; thermometer: number; lastOrderAt: string | null; revenue90: number; overdueAmount: number;
  lastVisitAt: string | null; nextStep: string;
};
type Portfolio = {
  generatedAt: string;
  summary: { customers: number; revenue90: number; buyers90: number; overdue: number; overdueCustomers: string[]; withoutVisit: number; newWithoutOrder: string[]; attention: number };
  tasks: Array<{ customerId: string; status: Status; phone: string | null; title: string; detail: string; why: string }>;
  customers: PortfolioCustomer[];
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const STATUS: Record<Status, { label: string; pill: string; bar: string; stripe: string }> = {
  COBRANCA: { label: "Cobrança", pill: "bg-red-50 text-red-700", bar: "bg-amber-500", stripe: "bg-red-600" },
  NOVO: { label: "Novo", pill: "bg-sky-50 text-sky-800", bar: "bg-sky-500", stripe: "bg-sky-600" },
  ESFRIANDO: { label: "Esfriando", pill: "bg-amber-50 text-amber-800", bar: "bg-red-500", stripe: "bg-amber-500" },
  RECOMPRA: { label: "Recompra chegando", pill: "bg-amber-50 text-amber-800", bar: "bg-amber-500", stripe: "bg-amber-500" },
  EM_DIA: { label: "Em dia", pill: "bg-emerald-50 text-emerald-800", bar: "bg-emerald-600", stripe: "bg-emerald-600" },
};

function whatsapp(phone: string | null, text: string) {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const number = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits.startsWith("55") && digits.length >= 12 ? digits : null;
  return number ? `https://wa.me/${number}?text=${encodeURIComponent(text)}` : null;
}

function message(task: Portfolio["tasks"][number], name: string) {
  const first = name.split(" ")[0];
  if (task.status === "COBRANCA") return `Olá! Aqui é da Bispo Coffees. Tudo bem? Consta um pagamento em aberto (${task.detail.toLowerCase()}). Posso te enviar o Pix ou o boleto?`;
  if (task.status === "NOVO") return `Olá! Aqui é da Bispo Coffees. Seu cadastro está pronto. Vamos fazer o primeiro pedido de café?`;
  if (task.status === "RECOMPRA") return `Olá! Aqui é da Bispo Coffees. Como está o estoque de café aí no ${first}? Posso já separar a reposição?`;
  return `Olá! Aqui é da Bispo Coffees. Tudo bem por aí? Faz um tempo que não falamos. Posso te ajudar com café esta semana?`;
}

/** "Minha carteira": o que fazer hoje, a carteira com termômetro e os valores do vendedor. */
export function SellerPortfolio() {
  const [data, setData] = React.useState<Portfolio | null>(null);
  const [error, setError] = React.useState("");
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/seller-portfolio`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body?.message ?? "Não foi possível carregar a carteira.");
        setData(body as Portfolio);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Não foi possível carregar a carteira."); });
    return () => controller.abort();
  }, []);

  const snooze = async (key: string, action: "TOMORROW" | "WEEK" | "DONE") => {
    setHidden((current) => new Set(current).add(key));
    await fetch(`${getApiBaseUrl()}/command-center/tasks/snooze`, {
      method: "POST", credentials: "include", headers: { "content-type": "application/json" },
      body: JSON.stringify({ taskKey: key, action }),
    }).catch(() => null);
  };

  if (error) return <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>;
  if (!data) return <div aria-hidden className="h-40 animate-pulse rounded-[20px] bg-stone-100" />;

  const s = data.summary;
  const tasks = data.tasks.filter((task) => !hidden.has(`seller:${task.customerId}:${task.status}`));
  const kpi = "rounded-[18px] border border-stone-200 bg-white p-4";
  return (
    <div id="carteira" className="space-y-4">
      <section aria-label="Resumo da carteira" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className={kpi}><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-stone-500">Vendido · 90 dias</p><p className="mt-1 text-2xl font-bold tabular-nums">{brl.format(s.revenue90)}</p><p className="text-xs text-stone-500">{s.buyers90} de {s.customers} clientes compraram</p></div>
        <div className={kpi}><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-stone-500">Vencido na carteira</p><p className={`mt-1 text-2xl font-bold tabular-nums ${s.overdue > 0 ? "text-red-700" : ""}`}>{brl.format(s.overdue)}</p><p className="truncate text-xs text-stone-500">{s.overdueCustomers.length ? s.overdueCustomers.join(", ") : "nada vencido"}</p></div>
        <div className={kpi}><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-stone-500">Sem visita registrada</p><p className={`mt-1 text-2xl font-bold tabular-nums ${s.withoutVisit ? "text-amber-700" : ""}`}>{s.withoutVisit} de {s.customers}</p><p className="text-xs text-stone-500"><Link href="/atendimento" className="font-semibold text-emerald-800 underline underline-offset-2">registrar visita</Link></p></div>
        <div className={kpi}><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-stone-500">Pedem atenção</p><p className={`mt-1 text-2xl font-bold tabular-nums ${s.attention ? "text-amber-700" : "text-emerald-700"}`}>{s.attention}</p><p className="text-xs text-stone-500">{s.attention ? "veja a lista abaixo" : "carteira em dia"}</p></div>
      </section>

      <section aria-labelledby="hoje-title" className="rounded-[20px] border border-stone-200 bg-white p-5">
        <h2 id="hoje-title" className="flex items-center gap-2 text-lg font-bold">
          Fale hoje com {tasks.length > 0 && <span className="rounded-full bg-stone-900 px-2 text-xs font-bold text-white">{tasks.length}</span>}
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-normal text-stone-500"><Bell size={13} /> avisos também no sino</span>
        </h2>
        <p className="text-xs text-stone-500">por ordem: dinheiro parado, cliente novo, cliente esfriando, recompra chegando</p>
        {tasks.length === 0 ? <p className="py-4 text-sm text-stone-500">Ninguém da carteira pede atenção agora. Bom trabalho.</p> : (
          <ul className="mt-2 divide-y divide-stone-100">
            {tasks.map((task) => {
              const key = `seller:${task.customerId}:${task.status}`;
              const customer = data.customers.find((c) => c.id === task.customerId);
              const wa = whatsapp(task.phone, message(task, customer?.name ?? ""));
              const primary = task.status === "NOVO" || task.status === "RECOMPRA"
                ? { href: `/pedidos?novo=1&cliente=${encodeURIComponent(task.customerId)}`, label: task.status === "NOVO" ? "Fazer o 1º pedido" : "Novo pedido" }
                : task.status === "COBRANCA"
                  ? { href: `/clientes?cliente=${encodeURIComponent(task.customerId)}`, label: "Ver cliente" }
                  : { href: `/atendimento?cliente=${encodeURIComponent(task.customerId)}`, label: "Registrar visita ou ligação" };
              return (
                <li key={key} className="grid grid-cols-[4px_1fr] gap-3 py-3">
                  <span aria-hidden className={`rounded ${STATUS[task.status].stripe}`} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold">{task.title}</p>
                    <p className="text-[13px] text-stone-500">{task.detail}</p>
                    <p className="text-[12.5px] font-semibold text-emerald-800">{task.why}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Link href={primary.href} className="inline-flex min-h-10 items-center rounded-xl bg-stone-900 px-3.5 text-[13px] font-bold text-white">{primary.label}</Link>
                      {wa && <a href={wa} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-stone-200 px-3 text-[13px] font-semibold"><MessageCircle size={14} /> WhatsApp</a>}
                      <button type="button" onClick={() => void snooze(key, "TOMORROW")} className="min-h-10 rounded-xl border border-stone-200 px-3 text-[13px] font-semibold text-stone-600">Amanhã</button>
                      <button type="button" onClick={() => void snooze(key, "DONE")} className="min-h-10 rounded-xl border border-stone-200 px-3 text-[13px] font-semibold text-stone-600">Feito</button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="carteira-title" className="rounded-[20px] border border-stone-200 bg-white p-5">
        <h2 id="carteira-title" className="text-lg font-bold">Minha carteira</h2>
        <p className="text-xs text-stone-500">o termômetro enche conforme o cliente se aproxima do prazo em que costuma comprar</p>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-[13.5px]">
            <thead className="border-b border-stone-200 text-[11px] uppercase tracking-[.08em] text-stone-500">
              <tr><th className="py-2 pr-2 font-semibold">Cliente</th><th className="px-2 py-2 font-semibold">Situação</th><th className="px-2 py-2 font-semibold">Última compra</th><th className="px-2 py-2 font-semibold">Termômetro</th><th className="px-2 py-2 text-right font-semibold">90 dias</th><th className="py-2 pl-2 font-semibold">Próximo passo</th></tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {data.customers.map((c) => (
                <tr key={c.id}>
                  <td className="py-2.5 pr-2"><Link href={`/clientes?cliente=${encodeURIComponent(c.id)}`} className="font-semibold hover:underline">{c.name}</Link></td>
                  <td className="px-2 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-bold ${STATUS[c.status].pill}`}>{STATUS[c.status].label}</span></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-stone-600">{c.lastOrderAt ? `${new Date(c.lastOrderAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "UTC" })} · ${c.daysSince} ${c.daysSince === 1 ? "dia" : "dias"}` : "sem pedido"}</td>
                  <td className="px-2 py-2.5"><div className="h-2 w-28 overflow-hidden rounded-full bg-stone-100" title={`${Math.round(c.thermometer * 100)}% do prazo`}><div className={`h-full ${c.thermometer >= 1 ? "bg-red-500" : STATUS[c.status].bar}`} style={{ width: `${Math.round(c.thermometer * 100)}%` }} /></div></td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right tabular-nums">{c.revenue90 ? brl.format(c.revenue90) : "—"}</td>
                  <td className="py-2.5 pl-2 text-stone-600">{c.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
