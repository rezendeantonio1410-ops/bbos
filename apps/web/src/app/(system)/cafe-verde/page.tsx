"use client";

import Link from "next/link";
import * as React from "react";
import {
  ArrowRight,
  FlaskConical,
  PackageOpen,
  RefreshCw,
  ShoppingBag,
  Warehouse,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();

type Purchase = {
  approvalStatus: string;
  externalAcceptanceStatus: string;
  operationalStatus: string;
  balanceKg: number;
};

type ReceiptOptions = {
  purchases?: Purchase[];
};

type StockSummary = {
  activeLots?: number;
};

const INITIAL_COUNTS = {
  purchases: 0,
  delivery: 0,
  receipts: 0,
  stock: 0,
};

async function getJson<T>(url: string, retries = 2): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        credentials: "include",
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastError = error;

      if (attempt < retries) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1200 * (attempt + 1)),
        );
      }
    }
  }

  throw lastError;
}

export default function GreenCoffeeHome() {
  const [counts, setCounts] = React.useState(INITIAL_COUNTS);
  const [loading, setLoading] = React.useState(true);
  const [warning, setWarning] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);

  const loadData = React.useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);

    const results = await Promise.allSettled([
      getJson<Purchase[]>(`${API}/green-coffee-purchases`),
      getJson<ReceiptOptions>(`${API}/receipts/options`),
      getJson<unknown[]>(`${API}/receipts`),
      getJson<StockSummary>(`${API}/inventory/summary`),
    ]);

    const [purchasesResult, optionsResult, receiptsResult, stockResult] =
      results;

    const purchases =
      purchasesResult.status === "fulfilled"
        ? purchasesResult.value
        : null;

    const options =
      optionsResult.status === "fulfilled"
        ? optionsResult.value
        : null;

    const receipts =
      receiptsResult.status === "fulfilled"
        ? receiptsResult.value
        : null;

    const stock =
      stockResult.status === "fulfilled"
        ? stockResult.value
        : null;

    setCounts((current) => ({
      purchases: purchases?.length ?? current.purchases,
      delivery:
        options?.purchases?.filter(
          (purchase) =>
            purchase.approvalStatus === "APPROVED" &&
            purchase.externalAcceptanceStatus === "ACCEPTED" &&
            purchase.operationalStatus === "AWAITING_DELIVERY" &&
            purchase.balanceKg > 0,
        ).length ?? current.delivery,
      receipts: receipts?.length ?? current.receipts,
      stock: stock?.activeLots ?? current.stock,
    }));

    const failures = results.filter(
      (result) => result.status === "rejected",
    ).length;

    if (failures === 0) {
      setWarning("");
    } else if (failures < results.length) {
      setWarning(
        "Algumas informações estão temporariamente indisponíveis. Os dados disponíveis foram mantidos.",
      );
    } else {
      setWarning(
        "A conexão com o servidor está lenta ou temporariamente indisponível. O módulo permanece disponível.",
      );
    }

    setLoading(false);
    setRefreshing(false);
  }, []);

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  const cards = [
    {
      href: "/compras-cafe-verde",
      label: "Compras",
      description: "Negociações, aprovações e contratos.",
      count: counts.purchases,
      icon: ShoppingBag,
      tone: "border-stone-200",
    },
    {
      href: "/recebimento",
      label: "Aguardando entrega",
      description:
        "Negócios confirmados com saldo físico a receber.",
      count: counts.delivery,
      icon: PackageOpen,
      tone: "border-amber-200",
    },
    {
      href: "/recebimento",
      label: "Recebimento",
      description:
        "Entradas físicas e recebimentos parciais.",
      count: counts.receipts,
      icon: PackageOpen,
      tone: "border-blue-200",
    },
    {
      href: "/laboratorio",
      label: "Laboratório",
      description:
        "Quarentena, amostras e análise de qualidade.",
      count: "—",
      icon: FlaskConical,
      tone: "border-amber-200",
    },
    {
      href: "/estoque",
      label: "Estoque verde",
      description:
        "Lotes liberados disponíveis para produção.",
      count: counts.stock,
      icon: Warehouse,
      tone: "border-emerald-200",
    },
  ];

  return (
    <div className="mx-auto max-w-[1280px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">
            Módulo operacional
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Café Verde
          </h1>

          <p className="mt-2 text-sm text-stone-500">
            Da compra à entrada no estoque.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void loadData(true)}
            disabled={refreshing}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 text-sm font-bold text-stone-700 disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            Atualizar
          </button>

          <Link
            href="/compras-cafe-verde"
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white"
          >
            <ShoppingBag size={16} />
            Nova compra
          </Link>
        </div>
      </header>

      {warning && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          <span>{warning}</span>

          <button
            type="button"
            onClick={() => void loadData(true)}
            className="font-bold underline underline-offset-4"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {loading && (
        <p className="mt-5 text-sm text-stone-500">
          Carregando informações operacionais...
        </p>
      )}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {cards.map(
          ({
            href,
            label,
            description,
            count,
            icon: Icon,
            tone,
          }) => (
            <Link key={label} href={href} className="group">
              <Card
                className={`h-full border-2 ${tone} p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-md`}
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="grid size-11 place-items-center rounded-xl bg-stone-50 text-forest-800">
                    <Icon size={20} />
                  </span>

                  <strong className="text-2xl">
                    {count}
                  </strong>
                </div>

                <h2 className="mt-5 text-lg font-bold">
                  {label}
                </h2>

                <p className="mt-2 min-h-10 text-sm leading-5 text-stone-500">
                  {description}
                </p>

                <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-forest-700">
                  Abrir etapa
                  <ArrowRight size={14} />
                </span>
              </Card>
            </Link>
          ),
        )}
      </section>

      <Card className="mt-8 p-5">
        <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
          Fluxo operacional
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-x-2 gap-y-3 text-sm font-semibold text-stone-700">
          <span>Nova compra</span>
          <ArrowRight size={15} className="text-stone-300" />
          <span>Compra</span>
          <ArrowRight size={15} className="text-stone-300" />
          <span>Aprovação</span>
          <ArrowRight size={15} className="text-stone-300" />
          <span>Confirmação</span>
          <ArrowRight size={15} className="text-stone-300" />

          <span className="inline-flex items-center gap-1.5">
            Aguardando entrega
            <em className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[11px] font-bold not-italic text-amber-800">
              {counts.delivery}
            </em>
          </span>

          <ArrowRight size={15} className="text-stone-300" />

          <span className="inline-flex items-center gap-1.5">
            Recebimento
            <em className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold not-italic text-blue-800">
              {counts.receipts}
            </em>
          </span>

          <ArrowRight size={15} className="text-stone-300" />
          <span>Laboratório</span>
          <ArrowRight size={15} className="text-stone-300" />
          <span>Estoque verde</span>
        </div>
      </Card>
    </div>
  );
}
