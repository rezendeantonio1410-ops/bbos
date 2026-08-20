"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  CircleDollarSign,
  CreditCard,
  GitCompareArrows,
  TrendingUp,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const API = `${getApiBaseUrl()}/finance`;

type FinanceSummary = {
  source?: string;
  cash: number;
  receivables: number;
  payables: number;
  plannedPurchases: number;
  projectedBalance: number;
  delinquency: number;
  accounts?: unknown[];
  transactions?: unknown[];
  greenCoffeePurchaseProjection?: unknown[];
};

const emptySummary: FinanceSummary = {
  source: "database",
  cash: 0,
  receivables: 0,
  payables: 0,
  plannedPurchases: 0,
  projectedBalance: 0,
  delinquency: 0,
  accounts: [],
  transactions: [],
  greenCoffeePurchaseProjection: [],
};

export default function FinancePage() {
  const [data, setData] = React.useState<FinanceSummary>(emptySummary);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/summary`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.message ?? "Não foi possível carregar o financeiro.");
        }
        return response.json() as Promise<FinanceSummary>;
      })
      .then((result) => {
        setData({ ...emptySummary, ...result });
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setData(emptySummary);
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const cards = [
    ["Caixa atual", money.format(data.cash), "/financeiro/fluxo-caixa", Banknote],
    ["Contas a receber", money.format(data.receivables), "/financeiro/receber", TrendingUp],
    ["Contas a pagar", money.format(data.payables), "/financeiro/pagar", CreditCard],
    ["Compras previstas", money.format(data.plannedPurchases), "/compras-cafe-verde", CreditCard],
    ["Saldo projetado", money.format(data.projectedBalance), "/financeiro/fluxo-caixa", CircleDollarSign],
    ["Inadimplência", money.format(data.delinquency), "/financeiro/receber", TrendingUp],
  ] as const;

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Gestão financeira
          </p>
          <h1 className="mt-2 text-3xl font-bold">Financeiro</h1>
          <p className="mt-2 text-sm text-stone-500">
            Caixa, recebíveis, pagamentos e projeções gerenciais.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-2 text-[10px] font-bold ${
            status === "ready"
              ? "bg-emerald-50 text-emerald-800"
              : status === "error"
                ? "bg-red-50 text-red-800"
                : "bg-stone-100 text-stone-600"
          }`}
        >
          {status === "ready"
            ? "Dados reais do PostgreSQL"
            : status === "error"
              ? "Falha ao carregar dados financeiros"
              : "Carregando dados financeiros..."}
        </span>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {cards.map(([label, value, href, Icon]) => (
          <Link key={label} href={href}>
            <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold text-stone-500">{label}</p>
                <Icon size={15} className="text-forest-700" />
              </div>
              <p className="mt-3 truncate text-xl font-bold">{value}</p>
            </Card>
          </Link>
        ))}
      </section>

      <section className="mt-6 grid gap-4 xl:grid-cols-[1.6fr_.8fr]">
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                Fluxo de caixa
              </p>
              <h2 className="mt-1 text-lg font-bold">Posição financeira atual</h2>
              <p className="mt-2 text-xs text-stone-500">
                Consolidado diretamente das contas, recebíveis, pagamentos e compromissos registrados no BBOs.
              </p>
            </div>
            <Link href="/financeiro/fluxo-caixa" className="text-xs font-bold text-forest-700">
              Detalhar
            </Link>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Position label="Caixa" value={money.format(data.cash)} />
            <Position label="Recebíveis" value={money.format(data.receivables)} />
            <Position label="Pagáveis" value={money.format(data.payables)} />
            <Position label="Projetado" value={money.format(data.projectedBalance)} />
          </div>
          {status === "ready" && (data.transactions?.length ?? 0) === 0 && (
            <div className="mt-6 rounded-xl border border-dashed border-stone-200 p-6 text-center text-xs text-stone-500">
              Ainda não há movimentações financeiras suficientes para exibir uma série histórica real.
            </div>
          )}
        </Card>

        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
            Atenção financeira
          </p>
          <h2 className="mt-1 text-lg font-bold">Indicadores operacionais</h2>
          <div className="mt-5 space-y-4">
            <Alert label="Inadimplência em aberto" value={money.format(data.delinquency)} tone="danger" />
            <Alert label="Compras previstas" value={money.format(data.plannedPurchases)} tone="warning" />
            <Alert label="Receita faturada ≠ caixa recebido" value="Conceitos separados" tone="neutral" />
          </div>
          <Link href="/financeiro/receber" className="mt-6 inline-flex items-center gap-1 text-xs font-bold text-forest-700">
            Ver contas a receber <ArrowRight size={13} />
          </Link>
        </Card>
      </section>

      <section className="mt-6 grid gap-3 md:grid-cols-4">
        <Quick href="/financeiro/receber" title="Contas a receber" detail="A vencer, vencidos e pagamentos parciais" />
        <Quick href="/financeiro/pagar" title="Contas a pagar" detail="Fornecedores e centros de custo" />
        <Quick href="/financeiro/fluxo-caixa" title="Fluxo de caixa" detail="Realizado, projeção e movimentações" />
        <Quick href="/financeiro/conciliacao" title="Conciliação" detail="Compare movimentos e confirme divergências" icon={GitCompareArrows} />
      </section>
    </div>
  );
}

function Position({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#F7F9F8] p-4">
      <p className="text-[10px] text-stone-500">{label}</p>
      <p className="mt-2 text-lg font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Alert({ label, value, tone }: { label: string; value: string; tone: "danger" | "warning" | "neutral" }) {
  return (
    <div className="flex items-center justify-between border-b border-stone-100 pb-3">
      <p className="text-xs text-stone-500">{label}</p>
      <strong
        className={
          tone === "danger"
            ? "text-xs text-red-700"
            : tone === "warning"
              ? "text-xs text-amber-700"
              : "text-xs text-stone-700"
        }
      >
        {value}
      </strong>
    </div>
  );
}

function Quick({
  href,
  title,
  detail,
  icon: Icon = ArrowRight,
}: {
  href: string;
  title: string;
  detail: string;
  icon?: typeof ArrowRight;
}) {
  return (
    <Link href={href}>
      <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">{title}</h3>
          <Icon size={14} className="text-stone-400" />
        </div>
        <p className="mt-2 text-xs text-stone-500">{detail}</p>
      </Card>
    </Link>
  );
}
