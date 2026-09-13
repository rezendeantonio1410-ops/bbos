"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, BadgeDollarSign, Boxes, Globe2, Grid3X3, ShoppingBag, TriangleAlert, UsersRound } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 2 });
const API = () => getApiBaseUrl();

type Dashboard = {
  vendasOnline: number;
  pedidosOnline: number;
  ticketMedio: number;
  clientes: number;
  pedidosPendentes: number;
  vendasUltimos30Dias: number;
  atencao: Array<{ key: string; label: string; count: number; href: string }>;
  isDemo: boolean;
};
type Channel = { id: string; code: string; name: string; type: string; active: boolean; currency?: string | null };
type Price = { id: string; productVariantId: string; salesChannelId: string; channelCode: string; price: string | number; active: boolean };
type OptionVariant = { productVariantId: string; product: string; line: string; sku: string; presentationGrams: number };

const emptyDashboard: Dashboard = { vendasOnline: 0, pedidosOnline: 0, ticketMedio: 0, clientes: 0, pedidosPendentes: 0, vendasUltimos30Dias: 0, atencao: [], isDemo: true };

export function CommerceVNext() {
  const [dashboard, setDashboard] = React.useState<Dashboard>(emptyDashboard);
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [prices, setPrices] = React.useState<Price[]>([]);
  const [variants, setVariants] = React.useState<OptionVariant[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    const base = API();
    void Promise.all([
      fetch(`${base}/commerce/dashboard`, { credentials: "include", cache: "no-store" }),
      fetch(`${base}/commerce/channels`, { credentials: "include", cache: "no-store" }),
      fetch(`${base}/commerce/prices`, { credentials: "include", cache: "no-store" }),
      fetch(`${base}/sales-orders/options`, { credentials: "include", cache: "no-store" }),
    ]).then(async ([dashboardResponse, channelsResponse, pricesResponse, optionsResponse]) => {
      if (!dashboardResponse.ok || !channelsResponse.ok || !pricesResponse.ok || !optionsResponse.ok) throw new Error("commerce unavailable");
      setDashboard({ ...emptyDashboard, ...(await dashboardResponse.json()) });
      setChannels(await channelsResponse.json());
      setPrices(await pricesResponse.json());
      const options = await optionsResponse.json();
      setVariants(options.variants ?? []);
      setState("ready");
    }).catch(() => setState("error"));
  }, []);

  const activeChannels = channels.filter((channel) => channel.active);
  const profileChannels = activeChannels.filter((channel) => ["DISTRIBUIDOR","CAFETERIA","ESCRITORIO","VAREJO","RESTAURANTE_HOTEL","WHITE_LABEL","EXPORTACAO","CONSUMIDOR_FINAL","OUTRO"].includes(channel.code));
  const activePrices = prices.filter((price) => price.active);
  const possibleCells = Math.max(variants.length * Math.max(profileChannels.length, 1), 1);
  const coverage = Math.round((activePrices.filter((price) => profileChannels.some((channel) => channel.id === price.salesChannelId)).length / possibleCells) * 100);

  return <div className="mx-auto max-w-[1600px]">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-[#3E73A8]"><Globe2 size={14}/> Comercial conectado</p>
        <h1 className="mt-2 text-3xl font-bold">Commerce</h1>
        <p className="mt-2 max-w-3xl text-sm text-stone-500">Preços, canais, pedidos e desempenho usando a mesma fonte comercial do BBOS.</p>
      </div>
      <div className="flex gap-2">
        <Badge tone={state === "ready" ? "success" : state === "error" ? "warning" : "neutral"}>{state === "ready" ? "Dados conectados" : state === "error" ? "Requer atenção" : "Carregando"}</Badge>
        <Link href="/commerce/precos" className="inline-flex items-center gap-2 rounded-xl bg-[#14201D] px-4 py-2.5 text-xs font-bold text-white"><Grid3X3 size={14}/> Matriz de preços</Link>
      </div>
    </header>

    <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      <Metric icon={BadgeDollarSign} label="Vendas online" value={money.format(dashboard.vendasOnline)} tone="blue"/>
      <Metric icon={ShoppingBag} label="Pedidos" value={String(dashboard.pedidosOnline)} tone="blue"/>
      <Metric icon={BadgeDollarSign} label="Ticket médio" value={money.format(dashboard.ticketMedio)} tone="green"/>
      <Metric icon={UsersRound} label="Clientes" value={String(dashboard.clientes)} tone="green"/>
      <Metric icon={Boxes} label="Perfis comerciais" value={String(profileChannels.length)} tone="violet"/>
      <Metric icon={Grid3X3} label="Cobertura de preços" value={`${Math.max(0, Math.min(coverage, 100))}%`} tone={coverage < 50 ? "amber" : "green"}/>
    </section>

    <section className="mt-6 grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#3E73A8]">Política comercial</p><h2 className="mt-1 text-lg font-bold">Cobertura por perfil</h2><p className="mt-1 text-xs text-stone-500">Células vazias bloqueiam o preço daquele perfil no Novo Pedido.</p></div>
          <Link href="/commerce/precos" className="text-xs font-bold text-[#3E73A8]">Abrir matriz <ArrowRight size={13} className="inline"/></Link>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {profileChannels.map((channel) => {
            const count = activePrices.filter((price) => price.salesChannelId === channel.id).length;
            const pct = variants.length ? Math.round((count / variants.length) * 100) : 0;
            return <div key={channel.id} className="rounded-2xl border border-stone-200 bg-white p-4">
              <div className="flex items-center justify-between gap-2"><strong className="text-xs">{channel.name}</strong><span className="text-[10px] font-bold text-stone-400">{pct}%</span></div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#3E73A8]" style={{ width: `${Math.min(pct,100)}%` }}/></div>
              <p className="mt-2 text-[10px] text-stone-500">{count} de {variants.length} SKUs com preço</p>
            </div>;
          })}
          {!profileChannels.length && <div className="col-span-full rounded-2xl border border-dashed p-6 text-center text-xs text-stone-500">Os perfis comerciais ainda não foram carregados.</div>}
        </div>
      </Card>

      <Card className="p-5">
        <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#B87518]"><TriangleAlert size={13}/> Atenção comercial</p>
        <h2 className="mt-1 text-lg font-bold">O que falta completar</h2>
        <div className="mt-4 space-y-3">
          <Attention label="SKUs ativos" value={variants.length} detail="Base disponível para venda"/>
          <Attention label="Preços vigentes" value={activePrices.length} detail="Linhas da política comercial"/>
          <Attention label="Pedidos pendentes" value={dashboard.pedidosPendentes} detail="Exigem continuidade operacional"/>
        </div>
        {coverage < 100 && <div className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">A matriz ainda possui perfis sem preço para alguns SKUs. O BBOS não deve usar fallback entre perfis.</div>}
      </Card>
    </section>

    <section className="mt-6 grid gap-3 md:grid-cols-3">
      <Quick href="/clientes" title="Clientes" detail="Perfil comercial, crédito e condição de pagamento"/>
      <Quick href="/pedidos" title="Pedidos" detail="Preço automático, crédito, frete e aprovação"/>
      <Quick href="/commerce/precos" title="Matriz de preços" detail="Um SKU por linha, todos os perfis lado a lado"/>
    </section>
  </div>;
}

function Metric({ icon: Icon, label, value, tone }: { icon: typeof Globe2; label: string; value: string; tone: "blue"|"green"|"violet"|"amber" }) {
  const styles = { blue: "bg-blue-50 text-[#3E73A8]", green: "bg-emerald-50 text-[#087568]", violet: "bg-violet-50 text-[#6D4FA3]", amber: "bg-amber-50 text-[#B87518]" };
  return <Card className="p-4"><span className={`grid size-8 place-items-center rounded-xl ${styles[tone]}`}><Icon size={15}/></span><p className="mt-3 text-[10px] font-semibold text-stone-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></Card>;
}
function Attention({ label, value, detail }: { label:string; value:number; detail:string }) { return <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3"><div><p className="text-xs font-bold">{label}</p><p className="mt-1 text-[10px] text-stone-500">{detail}</p></div><strong className="text-lg">{value}</strong></div>; }
function Quick({ href, title, detail }: { href:string; title:string; detail:string }) { return <Link href={href}><Card className="group h-full p-4 transition hover:-translate-y-0.5"><div className="flex items-center justify-between"><div><p className="text-sm font-bold">{title}</p><p className="mt-1 text-[10px] leading-5 text-stone-500">{detail}</p></div><ArrowRight size={15} className="text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-[#3E73A8]"/></div></Card></Link>; }
