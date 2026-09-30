"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CircleDollarSign,
  Globe2,
  PackageCheck,
  Ship,
  TriangleAlert,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type ExportOrder = {
  id: string;
  code: string;
  orderNumber: string | null;
  status: string;
  totalAmount: number;
  quantity: number;
  orderedAt: string;
  expectedDeliveryDate: string | null;
  incoterm: string | null;
  incotermLocation: string | null;
  customerReference: string | null;
  currency: string;
  customer: { name: string };
  salesChannel: { name: string; currency: string | null } | null;
  items: Array<{
    id: string;
    sku: string;
    productName: string;
    quantity: number;
  }>;
  readiness: { ready: boolean; missing: string[] };
};

type ExportOverview = {
  metrics: {
    orders: number;
    open: number;
    ready: number;
    attention: number;
    totalsByCurrency: Array<{ currency: string; amount: number }>;
  };
  items: ExportOrder[];
  source: "database";
  updatedAt: string;
};

export default function ExportsPage() {
  const [data, setData] = React.useState<ExportOverview | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">(
    "loading",
  );

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/sales-orders/export-overview`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error(`exports-${response.status}`);
      setData(await response.json());
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const metrics = data?.metrics ?? {
    orders: 0,
    open: 0,
    ready: 0,
    attention: 0,
    totalsByCurrency: [],
  };
  const available = state === "ready" && data !== null;

  return (
    <div className="mx-auto max-w-[1580px] space-y-7">
      <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-blue-700">
            <Globe2 size={14} /> Mercado internacional
          </p>
          <h1 className="mt-2 text-3xl font-bold">Exportações</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Pedidos internacionais, condição comercial e prontidão operacional
            vistos pela mesma fonte de verdade do BBOS.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={state === "ready" ? "success" : "warning"}>
            {state === "loading"
              ? "Consolidando"
              : state === "unavailable"
                ? "Dados indisponíveis"
                : "Fonte operacional"}
          </Badge>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            Abrir pedidos <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {state === "unavailable" && (
        <Card className="border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex flex-wrap items-center gap-3">
            <TriangleAlert size={18} />
            <div className="min-w-0 flex-1">
              <strong className="text-sm">
                Não foi possível confirmar os pedidos de exportação.
              </strong>
              <p className="mt-1 text-xs">
                O BBOS não apresenta zero nem “operação em dia” sem consultar a
                fonte oficial.
              </p>
            </div>
            <button
              onClick={() => void load()}
              className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold"
            >
              Tentar novamente
            </button>
          </div>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          icon={Ship}
          label="Pedidos internacionais"
          value={available ? String(metrics.orders) : "—"}
        />
        <Metric
          icon={Globe2}
          label="Pedidos em aberto"
          value={available ? String(metrics.open) : "—"}
        />
        <Metric
          icon={PackageCheck}
          label="Base comercial pronta"
          value={available ? String(metrics.ready) : "—"}
        />
        <Metric
          icon={TriangleAlert}
          label="Exigem atenção"
          value={available ? String(metrics.attention) : "—"}
          attention={Boolean(available && metrics.attention)}
        />
        <Metric
          icon={CircleDollarSign}
          label="Valor registrado"
          value={
            available
              ? metrics.totalsByCurrency.length
                ? metrics.totalsByCurrency
                    .map((item) => formatMoney(item.amount, item.currency))
                    .join(" · ")
                : formatMoney(0, "BRL")
              : "—"
          }
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-blue-700">
                Carteira internacional
              </p>
              <h2 className="mt-1 text-lg font-bold">Prontidão por pedido</h2>
              <p className="mt-1 text-xs text-stone-500">
                Incoterm, local nomeado e prazo prometido, sem confundir
                ausência com conclusão.
              </p>
            </div>
          </div>

          {state === "loading" ? (
            <p className="mt-6 text-sm text-stone-500">
              Carregando a carteira internacional…
            </p>
          ) : available && data.items.length ? (
            <div className="mt-5 divide-y divide-stone-100">
              {data.items.map((order) => (
                <Link
                  key={order.id}
                  href="/pedidos"
                  className="grid gap-4 py-4 first:pt-0 md:grid-cols-[1.2fr_.8fr_.8fr_140px_20px] md:items-center"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <strong className="text-sm">
                        {order.orderNumber ?? order.code}
                      </strong>
                      <Badge tone={statusTone(order.status)}>
                        {statusLabel(order.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {order.customer.name} · {order.quantity} unidade(s)
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400">Condição</p>
                    <p className="mt-1 text-xs font-semibold">
                      {order.incoterm
                        ? `${order.incoterm} · ${order.incotermLocation}`
                        : "Não definida"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-stone-400">Prazo</p>
                    <p className="mt-1 text-xs font-semibold">
                      {order.expectedDeliveryDate
                        ? new Date(
                            order.expectedDeliveryDate,
                          ).toLocaleDateString("pt-BR")
                        : "Não informado"}
                    </p>
                  </div>
                  <div className="md:text-right">
                    <strong className="text-sm">
                      {formatMoney(order.totalAmount, order.currency)}
                    </strong>
                    <p
                      className={`mt-1 text-[10px] font-semibold ${order.readiness.ready ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {order.readiness.ready
                        ? "Base pronta"
                        : `Falta: ${order.readiness.missing.join(", ")}`}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-stone-300" />
                </Link>
              ))}
            </div>
          ) : state === "ready" ? (
            <div className="mt-6 rounded-2xl border border-dashed p-8 text-center">
              <Ship size={22} className="mx-auto text-stone-300" />
              <strong className="mt-3 block text-sm">
                Nenhum pedido de exportação registrado
              </strong>
              <p className="mt-1 text-xs text-stone-500">
                Um pedido aparecerá aqui quando usar um canal do tipo
                Exportação.
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">
            Consolidação responsável
          </p>
          <h2 className="mt-1 text-lg font-bold">O que esta etapa garante</h2>
          <div className="mt-5 space-y-4 text-xs leading-5 text-stone-600">
            <ScopeItem
              title="Já conectado"
              text="Pedido, cliente, moeda do canal, itens, valor, Incoterm, local nomeado, prazo e estado operacional."
              ready
            />
            <ScopeItem
              title="Obrigatório no novo pedido"
              text="Incoterm e local nomeado passam a ser exigidos para o canal Exportação."
              ready
            />
            <ScopeItem
              title="Próxima camada"
              text="Proforma, commercial invoice, packing list, documentos aduaneiros e marcos logísticos internacionais ainda precisam de modelos próprios e auditáveis."
            />
          </div>
        </Card>
      </section>

      {data?.updatedAt && state === "ready" && (
        <p className="text-center text-[10px] text-stone-400">
          Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")} ·
          Fonte: pedidos BBOS no canal Exportação.
        </p>
      )}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  attention = false,
}: {
  icon: typeof Ship;
  label: string;
  value: string;
  attention?: boolean;
}) {
  return (
    <Card className={attention ? "border-amber-200 bg-amber-50 p-4" : "p-4"}>
      <Icon
        size={16}
        className={attention ? "text-amber-700" : "text-blue-700"}
      />
      <p className="mt-3 text-[10px] text-stone-500">{label}</p>
      <strong className="mt-1 block text-xl">{value}</strong>
    </Card>
  );
}

function ScopeItem({
  title,
  text,
  ready = false,
}: {
  title: string;
  text: string;
  ready?: boolean;
}) {
  return (
    <div className="border-b border-stone-100 pb-4 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-stone-900">{title}</strong>
        <Badge tone={ready ? "success" : "neutral"}>
          {ready ? "Conectado" : "Planejado"}
        </Badge>
      </div>
      <p className="mt-1">{text}</p>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`;
  }
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: "Rascunho",
    CONFIRMED: "Confirmado",
    RESERVED: "Reservado",
    PICKING: "Separação",
    READY_TO_SHIP: "Pronto para envio",
    INVOICED: "Faturado",
    IN_PRODUCTION: "Em produção",
    SHIPPED: "Expedido",
    DELIVERED: "Entregue",
    CANCELLED: "Cancelado",
  };
  return labels[status] ?? status;
}

function statusTone(status: string): "success" | "warning" | "neutral" {
  if (["DELIVERED", "SHIPPED"].includes(status)) return "success";
  if (["DRAFT", "CONFIRMED", "IN_PRODUCTION"].includes(status))
    return "warning";
  return "neutral";
}
