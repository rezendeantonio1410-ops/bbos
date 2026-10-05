"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDownLeft, ArrowLeft, ArrowUpRight, Landmark } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Transaction = { id: string; type: string; amount: number | string; category: string; description: string; occurredAt: string };
type PurchaseProjection = { id: string; purchaseNumber: string; supplier: string; amount: number; dueDate: string; status: string };
type Summary = { cash: number; receivables: number; payables: number; plannedPurchases: number; projectedBalance: number; transactions?: Transaction[]; greenCoffeePurchaseProjection?: PurchaseProjection[] };

const emptySummary: Summary = { cash: 0, receivables: 0, payables: 0, plannedPurchases: 0, projectedBalance: 0, transactions: [], greenCoffeePurchaseProjection: [] };
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");

export default function CashFlowPage() {
  const [data, setData] = React.useState<Summary>(emptySummary);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/finance/summary`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar o fluxo de caixa.");
        return response.json() as Promise<Summary>;
      })
      .then((result) => { setData({ ...emptySummary, ...result }); setStatus("ready"); })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(emptySummary);
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  return (
    <div className="mx-auto max-w-[1500px]">
      <Link href="/financeiro" className="inline-flex items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14} /> Financeiro</Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="text-3xl font-bold">Fluxo de caixa</h1><p className="mt-2 text-sm text-stone-500">Posição calculada exclusivamente com lançamentos persistidos.</p></div>
        <span className={`rounded-full px-3 py-2 text-[10px] font-bold ${status === "ready" ? "bg-emerald-50 text-emerald-800" : status === "error" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-600"}`}>{status === "ready" ? "Dados reais do PostgreSQL" : status === "error" ? "Falha ao carregar" : "Carregando…"}</span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Caixa atual" value={money.format(data.cash)} />
        <Metric label="Entradas previstas" value={money.format(data.receivables)} />
        <Metric label="Saídas previstas" value={money.format(data.payables)} />
        <Metric label="Compras previstas" value={money.format(data.plannedPurchases)} />
        <Metric label="Saldo projetado" value={money.format(data.projectedBalance)} />
      </div>

      {status === "error" ? (
        <Card className="mt-6 p-10 text-center text-sm text-red-700">Não foi possível confirmar o fluxo no banco. Nenhum número fictício foi usado como substituto.</Card>
      ) : (
        <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">Movimentações</p><h2 className="mt-1 text-lg font-bold">Histórico real</h2></div><Landmark size={18} className="text-stone-400" /></div>
            {status === "loading" ? <p className="mt-8 text-center text-sm text-stone-500">Carregando movimentações…</p> : (data.transactions?.length ?? 0) === 0 ? <Empty text="Ainda não há entradas ou saídas financeiras registradas." /> : <div className="mt-5 space-y-3">{data.transactions!.slice(0, 12).map((item) => {
              const incoming = ["RECEIPT", "TRANSFER_IN"].includes(item.type);
              return <div key={item.id} className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3 text-xs"><span className="flex min-w-0 items-center gap-2">{incoming ? <ArrowDownLeft size={14} className="text-emerald-600" /> : <ArrowUpRight size={14} className="text-amber-600" />}<span className="truncate"><strong className="block text-stone-800">{item.description}</strong><span className="text-stone-400">{date.format(new Date(item.occurredAt))} · {item.category}</span></span></span><strong>{incoming ? "+" : "−"}{money.format(Number(item.amount || 0))}</strong></div>;
            })}</div>}
          </Card>

          <Card className="p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">Compras de café verde</p><h2 className="mt-1 text-lg font-bold">Compromissos preservados</h2>
            {status === "loading" ? <p className="mt-8 text-center text-sm text-stone-500">Carregando compras…</p> : (data.greenCoffeePurchaseProjection?.length ?? 0) === 0 ? <Empty text="As compras permanecem registradas; ainda não há parcelas planejadas ou comprometidas." /> : <div className="mt-5 space-y-3">{data.greenCoffeePurchaseProjection!.map((item) => <div key={item.id} className="border-b border-stone-100 pb-3 text-xs"><div className="flex justify-between gap-3"><strong>{item.purchaseNumber}</strong><strong>{money.format(Number(item.amount || 0))}</strong></div><p className="mt-1 text-stone-500">{item.supplier} · {date.format(new Date(item.dueDate))}</p><p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">{item.status}</p></div>)}</div>}
          </Card>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) { return <Card className="p-4"><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-2 text-xl font-bold">{value}</p></Card>; }
function Empty({ text }: { text: string }) { return <div className="mt-5 rounded-xl border border-dashed border-stone-200 p-8 text-center text-sm text-stone-500">{text}</div>; }
