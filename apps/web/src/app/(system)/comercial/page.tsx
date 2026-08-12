"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { currentUser } from "@/lib/current-user";
import {
  CommercialAttentionPanel,
  CommercialForecastCard,
  CommercialManagerKpi,
  RepresentativePerformanceTable,
  commercialMoney,
  type RepresentativePerformance,
} from "@/components/commercial-manager-dashboard";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
const navigation = [["Visão Geral","/comercial"],["Representantes","/comercial/representantes"],["Clientes / Carteiras","/comercial/clientes"],["Crédito","/comercial/credito"],["Metas","/comercial/metas"],["Comissões","/comercial/comissoes"],["Preços","/comercial/precos"],["Promoções","/comercial/promocoes"],["Desempenho","/comercial/desempenho"],["Relatórios","/comercial/relatorios"]] as const;
type Dashboard = {
  revenue: number; revenueChange: number | null; target: number; achievement: number;
  projection: number; pipeline: number; pipelineTotal: number; openOrders: number;
  openOrdersValue: number; openOrdersAttention: number; activeCustomers: number;
  newCustomers: number; inactiveCustomers: number; averageTicket: number;
  averageTicketChange: number | null; representatives: RepresentativePerformance[];
  attention: React.ComponentProps<typeof CommercialAttentionPanel>["items"];
};
const empty: Dashboard = { revenue: 0, revenueChange: null, target: 0, achievement: 0, projection: 0, pipeline: 0, pipelineTotal: 0, openOrders: 0, openOrdersValue: 0, openOrdersAttention: 0, activeCustomers: 0, newCustomers: 0, inactiveCustomers: 0, averageTicket: 0, averageTicketChange: null, representatives: [], attention: [] };

export default function CommercialPage() {
  const router = useRouter();
  const [data, setData] = React.useState<Dashboard>(empty);
  React.useEffect(() => { fetch(`${API}/commercial/dashboard`, { headers: { "x-user-id": currentUser.id } }).then(async (response) => { if (response.status === 403) { router.replace("/sales/desktop"); return null; } return response.ok ? response.json() : null; }).then((value) => value && setData(value)).catch(() => setData(empty)); }, [router]);
  const achievement = data.achievement * 100;
  const progressTone = achievement < 50 ? "orange" : achievement < 80 ? "blue" : "green";
  const targetDifference = data.revenue - data.target;
  const projectionDifference = data.projection - data.target;
  return <div className="mx-auto max-w-[1500px] pb-10">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Comercial · Visão Gerencial</p><h1 className="mt-2 text-3xl font-bold">Comercial</h1><p className="mt-2 text-sm text-stone-500">Equipe, carteiras, metas e desempenho comercial.</p><p className="mt-2 text-xs font-semibold text-stone-500">{currentUser.name} · {currentUser.corporateTitle}</p></div><div className="flex flex-wrap gap-2"><Link href="/sales/desktop" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold">Visualizar como representante</Link><Link href="/sales" className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold">Abrir versão mobile</Link></div></header>
    <nav className="mt-5 flex gap-2 overflow-x-auto border-b border-stone-200 pb-3 text-xs font-semibold">{navigation.map(([label,href]) => <Link key={href} href={href} className={`whitespace-nowrap rounded-lg px-3 py-2 ${href === "/comercial" ? "bg-forest-50 text-forest-800" : "text-stone-500 hover:bg-stone-50"}`}>{label}</Link>)}</nav>
    <section className="mt-6"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">Resultado</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <CommercialManagerKpi label="Vendas do mês" value={commercialMoney(data.revenue)} change={data.revenueChange} href="/comercial/relatorios?period=current-month" />
      <CommercialManagerKpi label="Meta do mês" value={commercialMoney(data.target)} supporting={data.target <= 0 ? "Meta ainda não configurada" : targetDifference >= 0 ? `Meta superada em ${commercialMoney(targetDifference)}` : `Faltam ${commercialMoney(Math.abs(targetDifference))}`} href="/comercial/metas" />
      <CommercialManagerKpi label="Atingimento" value={`${achievement.toFixed(1)}%`} progress={achievement} progressTone={progressTone} supporting={data.target > 0 ? "Progresso sobre a meta mensal" : "Configure uma meta mensal"} href="/comercial/metas" />
      <CommercialManagerKpi label="Projeção de fechamento" value={commercialMoney(data.projection)} supporting={data.target <= 0 ? "Sem meta para comparação" : projectionDifference >= 0 ? "Acima da meta" : `Abaixo da meta em ${commercialMoney(Math.abs(projectionDifference))}`} href="/comercial/desempenho" />
      <CommercialManagerKpi label="Pipeline ponderado" value={commercialMoney(data.pipeline)} supporting={`${commercialMoney(data.pipelineTotal)} em oportunidades`} href="/comercial/oportunidades" />
    </div></section>
    <section className="mt-5"><p className="mb-3 text-[10px] font-bold uppercase tracking-[.16em] text-stone-500">Operação comercial</p><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <CommercialManagerKpi label="Pedidos em aberto" value={data.openOrders} supporting={data.openOrdersAttention ? `${data.openOrdersAttention} precisam de atenção` : `${commercialMoney(data.openOrdersValue)} em valor`} href="/sales/desktop/pedidos?status=open" attention={data.openOrdersAttention > 0} />
      <CommercialManagerKpi label="Clientes ativos" value={data.activeCustomers} supporting="Compraram nos últimos 60 dias" href="/comercial/clientes?status=active" />
      <CommercialManagerKpi label="Novos clientes" value={data.newCustomers} supporting="Mês atual" href="/comercial/clientes?status=new" />
      <CommercialManagerKpi label="Sem comprar" value={data.inactiveCustomers} supporting="Sem recompra há mais de 60 dias" href="/comercial/clientes?status=inactive" attention={data.inactiveCustomers > 0} />
      <CommercialManagerKpi label="Ticket médio" value={commercialMoney(data.averageTicket)} change={data.averageTicketChange} href="/comercial/relatorios?metric=average-ticket" />
    </div></section>
    <section className="mt-6"><CommercialForecastCard revenue={data.revenue} pipeline={data.pipeline} projection={data.projection} target={data.target} /></section>
    <section className="mt-6"><RepresentativePerformanceTable people={data.representatives} /></section>
    <section className="mt-6"><CommercialAttentionPanel items={data.attention} /></section>
  </div>;
}
