"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Clock3,
  Database,
  ShoppingBag,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type SalesTruth = {
  salesToday: number;
  salesMonth: number;
  openOrders: number;
  overdueOrders: number;
};

const emptySales: SalesTruth = {
  salesToday: 0,
  salesMonth: 0,
  openOrders: 0,
  overdueOrders: 0,
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

export default function VendasPage() {
  const [data, setData] = React.useState<SalesTruth>(emptySales);
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">("loading");
  const [updatedAt, setUpdatedAt] = React.useState<Date | null>(null);

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(`${getApiBaseUrl()}/dashboard/home`, {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`dashboard-home-${response.status}`);
      const payload = await response.json();
      setData({
        salesToday: Number(payload.salesToday ?? 0),
        salesMonth: Number(payload.salesMonth ?? 0),
        openOrders: Number(payload.openOrders ?? 0),
        overdueOrders: Number(payload.overdueOrders ?? 0),
      });
      setUpdatedAt(new Date());
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const nextBestAction = data.overdueOrders > 0
    ? {
        eyebrow: "Prioridade comercial",
        title: `${data.overdueOrders} pedido${data.overdueOrders > 1 ? "s" : ""} atrasado${data.overdueOrders > 1 ? "s" : ""}`,
        text: "Resolva os pedidos em atraso antes de perseguir novas metas. O impacto mais próximo está no cliente e na expedição.",
        href: "/pedidos",
        action: "Revisar atrasos",
        tone: "attention" as const,
      }
    : data.openOrders > 0
      ? {
          eyebrow: "Próxima melhor ação",
          title: "Acompanhar os pedidos em aberto",
          text: "Não há atraso registrado. O próximo passo é proteger o fluxo dos pedidos já assumidos antes de ampliar a carga comercial.",
          href: "/pedidos",
          action: "Abrir pedidos",
          tone: "normal" as const,
        }
      : {
          eyebrow: "Próxima melhor ação",
          title: "Nenhuma pendência comercial urgente",
          text: "O BBOS não encontrou pedidos abertos ou atrasados. Use a carteira de clientes para decidir a próxima ação comercial.",
          href: "/clientes",
          action: "Ver clientes",
          tone: "normal" as const,
        };

  const openIntelligence = () => window.dispatchEvent(new Event("bbos:open-assistant"));

  return (
    <div className="mx-auto w-full max-w-[1580px] space-y-7">
      <section className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="bbos-eyebrow">Performance comercial</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--bbos-text-primary)]">Vendas</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--bbos-text-secondary)]">
            Receita e pedidos com origem operacional rastreável. O BBOS não exibe projeções, margem ou volume enquanto a fonte oficial não estiver conectada.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={openIntelligence} className="inline-flex items-center gap-2 rounded-xl bg-[var(--bbos-intelligence-soft)] px-4 py-2.5 text-xs font-bold text-[var(--bbos-intelligence)]">
            <Sparkles size={14} /> Perguntar à IA
          </button>
          <Link href="/pedidos" className="inline-flex items-center gap-2 rounded-xl border border-[var(--bbos-border)] bg-white px-4 py-2.5 text-xs font-bold text-[var(--bbos-text-primary)]">
            Abrir pedidos <ArrowRight size={13} />
          </Link>
        </div>
      </section>

      {state === "unavailable" && (
        <Card className="border border-amber-200 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white text-amber-700"><TriangleAlert size={16} /></span>
            <div className="min-w-0 flex-1">
              <strong className="text-sm">Dados comerciais temporariamente indisponíveis</strong>
              <p className="mt-1 text-xs text-stone-600">A interface continua disponível. Assim que a API responder, os valores voltam sem substituir ausência por dados demonstrativos.</p>
            </div>
            <button type="button" onClick={() => void load()} className="rounded-xl bg-white px-3 py-2 text-xs font-bold text-amber-800 shadow-sm">Tentar novamente</button>
          </div>
        </Card>
      )}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <TruthCard label="Vendas hoje" value={state === "loading" ? "Carregando…" : money.format(data.salesToday)} note="Receita registrada hoje" icon={CircleDollarSign} />
        <TruthCard label="Vendas no mês" value={state === "loading" ? "Carregando…" : money.format(data.salesMonth)} note="Receita acumulada no mês" icon={CircleDollarSign} />
        <TruthCard label="Pedidos em aberto" value={state === "loading" ? "—" : String(data.openOrders)} note="Pedidos ainda não concluídos" icon={ShoppingBag} />
        <TruthCard label="Pedidos atrasados" value={state === "loading" ? "—" : String(data.overdueOrders)} note={data.overdueOrders > 0 ? "Exigem atenção comercial" : "Nenhum atraso registrado"} icon={Clock3} attention={data.overdueOrders > 0} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.15fr_.85fr]">
        <Card className={`p-6 ${nextBestAction.tone === "attention" ? "border-amber-200 bg-amber-50/60" : "border-[var(--bbos-border)] bg-white"}`}>
          <p className="bbos-eyebrow">{nextBestAction.eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold">{nextBestAction.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--bbos-text-secondary)]">{nextBestAction.text}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={nextBestAction.href} className="inline-flex items-center gap-2 rounded-xl bg-[var(--bbos-coffee-green)] px-4 py-2.5 text-xs font-bold text-white">
              {nextBestAction.action} <ArrowRight size={13} />
            </Link>
            <button type="button" onClick={openIntelligence} className="inline-flex items-center gap-2 rounded-xl border border-[var(--bbos-intelligence-soft)] bg-white px-4 py-2.5 text-xs font-bold text-[var(--bbos-intelligence)]">
              <Sparkles size={13} /> Explicar recomendação
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]"><Database size={17} /></span>
            <div>
              <p className="bbos-eyebrow">Integridade dos dados</p>
              <h2 className="mt-2 text-base font-bold">O que já é confiável nesta tela</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3 text-xs text-[var(--bbos-text-secondary)]">
            <DataStatus label="Receita hoje" ready />
            <DataStatus label="Receita no mês" ready />
            <DataStatus label="Pedidos abertos e atrasados" ready />
            <DataStatus label="Margem líquida" />
            <DataStatus label="Volume vendido por produto" />
            <DataStatus label="Meta, tendência e projeção de fechamento" />
          </div>
          <p className="mt-5 text-[10px] leading-4 text-[var(--bbos-text-muted)]">
            Os itens ainda não conectados permanecem explicitamente indisponíveis. Nenhum valor demonstrativo é usado para completar a tela.
          </p>
        </Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <HumanEmptyState title="Margem ainda não disponível" text="A margem só aparecerá quando custos e vendas estiverem ligados pela mesma origem operacional." action="Abrir custos" href="/custos" />
        <HumanEmptyState title="Mix por produto em construção" text="O BBOS ainda não possui uma série de vendas por produto confiável nesta tela." action="Ver produtos" href="/produtos" />
        <HumanEmptyState title="Meta e projeção sem fonte oficial" text="A projeção anterior era demonstrativa e foi removida. A próxima versão calculará tendência apenas com histórico real." action="Abrir executivo" href="/dashboard" />
      </section>

      <p className="text-center text-[10px] text-[var(--bbos-text-muted)]">
        {updatedAt ? `Atualizado às ${updatedAt.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ` : ""}
        Fonte: banco operacional BBOS via Dashboard Home.
      </p>
    </div>
  );
}

function TruthCard({ label, value, note, icon: Icon, attention = false }: { label: string; value: string; note: string; icon: typeof CircleDollarSign; attention?: boolean }) {
  return (
    <Card className={`p-5 ${attention ? "border-amber-200 bg-amber-50/60" : "border-[var(--bbos-border)] bg-white"}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-[var(--bbos-text-secondary)]">{label}</p>
        <Icon size={16} className={attention ? "text-amber-700" : "text-[var(--bbos-blue)]"} />
      </div>
      <strong className="mt-4 block text-2xl tracking-tight text-[var(--bbos-text-primary)]">{value}</strong>
      <p className="mt-1 text-[10px] text-[var(--bbos-text-muted)]">{note}</p>
    </Card>
  );
}

function DataStatus({ label, ready = false }: { label: string; ready?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-[var(--bbos-border)] pb-2.5 last:border-0 last:pb-0">
      <span>{label}</span>
      <span className={`rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${ready ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>
        {ready ? "Rastreável" : "Aguardando fonte"}
      </span>
    </div>
  );
}

function HumanEmptyState({ title, text, action, href }: { title: string; text: string; action: string; href: string }) {
  return (
    <Card className="p-5">
      <strong className="text-sm">{title}</strong>
      <p className="mt-2 min-h-12 text-xs leading-5 text-[var(--bbos-text-secondary)]">{text}</p>
      <Link href={href} className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-[var(--bbos-blue)]">{action}<ArrowRight size={12} /></Link>
    </Card>
  );
}
