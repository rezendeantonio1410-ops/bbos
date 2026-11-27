"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getApiBaseUrl } from "@/lib/api-url";
import { saleTime } from "@/lib/command-center-v6";

type MarketplaceOrder = {
  id: string; number: string; at: string; channel: string; platform: string | null;
  status: "TO_IMPORT" | "IMPORTED" | "CANCELLED"; gross: number; fee: number; destination: string | null;
  items: Array<{ title: string; sku: string | null; quantity: number; unitPrice: number }>; units: number;
};
type MarketplaceOrders = {
  period: "today" | "7d" | "month"; since: string; channels: string[];
  totals: { orders: number; cancelled: number; gross: number; fees: number; net: number; averageTicket: number; units: number };
  orders: MarketplaceOrder[];
};

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const PERIODS = [{ key: "today", label: "Hoje" }, { key: "7d", label: "7 dias" }, { key: "month", label: "Mês" }] as const;
const STATUS: Record<MarketplaceOrder["status"], { label: string; className: string }> = {
  TO_IMPORT: { label: "A importar", className: "bg-[#fff4d6] text-[#7a5200]" },
  IMPORTED: { label: "Importado", className: "bg-[var(--bbos-success-soft,#e6f1ec)] text-[var(--bbos-success,#1f6b4f)]" },
  CANCELLED: { label: "Cancelado", className: "bg-[#fdecea] text-[var(--bbos-danger)]" },
};
const card = "rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white";

function orderLink(order: MarketplaceOrder) {
  return order.platform === "MERCADO_LIVRE" ? `https://www.mercadolivre.com.br/vendas/${encodeURIComponent(order.number)}/detalhe` : null;
}

function MarketplaceOrdersView() {
  const params = useSearchParams();
  const router = useRouter();
  const period = (["today", "7d", "month"].includes(params.get("periodo") ?? "") ? params.get("periodo") : "today") as MarketplaceOrders["period"];
  const channel = params.get("canal") ?? "";
  const [data, setData] = React.useState<MarketplaceOrders | null>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({ period, ...(channel ? { channel } : {}) });
    const load = () => fetch(`${getApiBaseUrl()}/command-center/marketplace-orders?${query}`, { credentials: "include", cache: "no-store", signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error(); setData((await response.json()) as MarketplaceOrders); setError(""); })
      .catch(() => { if (!controller.signal.aborted) setError("Não foi possível carregar os pedidos agora."); });
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [period, channel]);

  const go = (next: { periodo?: string; canal?: string }) => {
    const query = new URLSearchParams({ periodo: next.periodo ?? period, ...((next.canal ?? channel) ? { canal: next.canal ?? channel } : {}) });
    router.replace(`/vendas/marketplace?${query}`);
  };
  const title = channel || "Marketplaces";
  const showDate = period !== "today";

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-4 pb-24">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/home" className="text-[13px] font-semibold text-[var(--bbos-coffee-green)]">← Central de comando</Link>
          <h1 className="mt-1 text-[22px] font-semibold">Pedidos · {title}</h1>
          <p className="text-sm text-[var(--bbos-text-secondary)]">Atualiza a cada minuto. Só pedidos do marketplace; vendas do BBOS e da loja ficam em Pedidos.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data && data.channels.length > 1 && (
            <select aria-label="Canal" value={channel} onChange={(event) => go({ canal: event.target.value })} className="min-h-10 rounded-xl border border-[var(--bbos-border)] bg-white px-3 text-sm">
              <option value="">Todos os marketplaces</option>
              {data.channels.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
          )}
          <div role="group" aria-label="Período" className="inline-flex rounded-xl border border-[var(--bbos-border)] bg-white p-0.5">
            {PERIODS.map((item) => (
              <button key={item.key} type="button" aria-pressed={period === item.key} onClick={() => go({ periodo: item.key })} className={`min-h-9 rounded-lg px-3.5 text-sm font-semibold ${period === item.key ? "bg-[var(--bbos-text-primary)] text-white" : "text-[var(--bbos-text-secondary)] hover:bg-[var(--bbos-surface-subtle)]"}`}>{item.label}</button>
            ))}
          </div>
        </div>
      </div>

      <section aria-label="Resumo" className={`${card} grid grid-cols-2 divide-[var(--bbos-border)] sm:grid-cols-4 sm:divide-x`}>
        {[
          { label: "Vendido", value: data ? brl.format(data.totals.gross) : "—" },
          { label: "Pedidos", value: data ? `${data.totals.orders}${data.totals.cancelled ? ` (+${data.totals.cancelled} cancel.)` : ""}` : "—" },
          { label: "Tarifas do canal", value: data ? brl.format(data.totals.fees) : "—", note: data ? `líquido ${brl.format(data.totals.net)}` : "" },
          { label: "Ticket médio", value: data ? brl.format(data.totals.averageTicket) : "—", note: data ? `${data.totals.units} ${data.totals.units === 1 ? "unidade" : "unidades"}` : "" },
        ].map((item) => (
          <div key={item.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">{item.label}</p>
            <p className="mt-1 text-[22px] font-bold tabular-nums">{item.value}</p>
            {item.note && <p className="text-[12px] text-[var(--bbos-text-secondary)]">{item.note}</p>}
          </div>
        ))}
      </section>

      <section aria-label="Pedidos" className={`${card} overflow-hidden`}>
        {error && <p role="alert" className="p-4 text-sm text-[var(--bbos-danger)]">{error}</p>}
        {!data && !error && <div className="space-y-2 p-4" aria-hidden>{[0, 1, 2].map((n) => <div key={n} className="h-10 animate-pulse rounded-lg bg-[var(--bbos-surface-subtle)]" />)}</div>}
        {data && data.orders.length === 0 && <p className="p-6 text-sm text-[var(--bbos-text-secondary)]">Nenhum pedido neste período.</p>}
        {data && data.orders.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-[13.5px]">
              <thead className="border-b border-[var(--bbos-border)] text-[11px] uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">
                <tr><th className="px-4 py-2.5 font-semibold">{showDate ? "Data" : "Hora"}</th><th className="px-3 py-2.5 font-semibold">O que foi vendido</th><th className="px-3 py-2.5 font-semibold">Entrega</th><th className="px-3 py-2.5 font-semibold">Situação</th><th className="px-3 py-2.5 text-right font-semibold">Tarifa</th><th className="px-4 py-2.5 text-right font-semibold">Valor</th></tr>
              </thead>
              <tbody className="divide-y divide-[#eef1ed]">
                {data.orders.map((order) => {
                  const link = orderLink(order);
                  return (
                    <tr key={order.id} className={order.status === "CANCELLED" ? "opacity-60" : "hover:bg-[var(--bbos-surface-subtle)]"}>
                      <td className="whitespace-nowrap px-4 py-2.5 align-top">
                        <b className="tabular-nums">{showDate ? new Date(order.at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }) + " " : ""}{saleTime(order.at)}</b>
                        <span className="block text-[11.5px] text-[var(--bbos-text-secondary)]">{link ? <a href={link} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--bbos-coffee-green)]">#{order.number}</a> : `#${order.number}`}</span>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {order.items.length ? order.items.map((item, index) => (
                          <span key={index} className="block"><b className="tabular-nums">{item.quantity}×</b> {item.title}</span>
                        )) : <span className="text-[var(--bbos-text-secondary)]">—</span>}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 align-top text-[var(--bbos-text-secondary)]">{order.destination ?? "buscando…"}</td>
                      <td className="px-3 py-2.5 align-top"><span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${STATUS[order.status].className}`}>{STATUS[order.status].label}</span></td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right align-top tabular-nums text-[var(--bbos-text-secondary)]">{order.fee ? `−${brl.format(order.fee)}` : "—"}</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right align-top font-bold tabular-nums">{brl.format(order.gross)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">Para emitir nota e baixar estoque, importe os pedidos em <Link href="/commerce/marketplaces" className="font-semibold text-[var(--bbos-coffee-green)] underline underline-offset-2">Canais de venda</Link>.</p>
    </div>
  );
}

export default function MarketplaceOrdersPage() {
  return (
    <React.Suspense fallback={null}>
      <MarketplaceOrdersView />
    </React.Suspense>
  );
}
