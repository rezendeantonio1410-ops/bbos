"use client";

import * as React from "react";
import Link from "next/link";
import {
  Anchor,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  FileCheck2,
  Globe2,
  LocateFixed,
  PackageCheck,
  RefreshCw,
  Ship,
  TriangleAlert,
  X,
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

const trackingSteps = [
  { title: "Booking confirmado", detail: "12 set · 14:20", done: true },
  { title: "Gate-in no terminal", detail: "18 set · 09:45", done: true },
  { title: "Embarcado", detail: "20 set · 23:10", done: true },
  { title: "Em trânsito marítimo", detail: "Posição ilustrativa", current: true },
  { title: "Chegada ao destino", detail: "Previsão: 18 out" },
];

export default function ExportsPage() {
  const [data, setData] = React.useState<ExportOverview | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "unavailable">(
    "loading",
  );
  const [selectedOrder, setSelectedOrder] = React.useState<ExportOrder | null>(
    null,
  );
  const [trackingOpen, setTrackingOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const response = await fetch(
        `${getApiBaseUrl()}/sales-orders/export-overview`,
        { credentials: "include", cache: "no-store" },
      );
      if (!response.ok) throw new Error(`exports-${response.status}`);
      const result = (await response.json()) as ExportOverview;
      setData(result);
      setSelectedOrder((current) =>
        current
          ? result.items.find((item) => item.id === current.id) ?? null
          : result.items[0] ?? null,
      );
      setState("ready");
    } catch {
      setState("unavailable");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  React.useEffect(() => {
    if (!trackingOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTrackingOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [trackingOpen]);

  const metrics = data?.metrics ?? {
    orders: 0,
    open: 0,
    ready: 0,
    attention: 0,
    totalsByCurrency: [],
  };
  const available = state === "ready" && data !== null;

  return (
    <div className="mx-auto max-w-[1580px] space-y-6 pb-12">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-violet-700">
            <Globe2 size={14} /> Mercado internacional
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Central de Exportações
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
            Contratos, bookings, contêineres e documentos em uma operação
            independente do mercado interno.
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
          <span className="rounded-full border border-violet-100 bg-violet-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.08em] text-violet-800">
            Moedas preservadas
          </span>
          <Link
            href="/pedidos"
            className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            Abrir pedidos <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      <ModuleRail
        orders={available ? metrics.open : null}
        attention={available ? metrics.attention : null}
        currencies={available ? metrics.totalsByCurrency.length : null}
      />

      {state === "unavailable" && (
        <Card className="border-amber-200 bg-amber-50 p-5 text-amber-900">
          <div className="flex flex-wrap items-center gap-3">
            <TriangleAlert size={18} />
            <div className="min-w-0 flex-1">
              <strong className="text-sm">
                Não foi possível confirmar a operação internacional.
              </strong>
              <p className="mt-1 text-xs">
                O BBOS não apresenta zero nem operação em dia sem consultar a
                fonte oficial.
              </p>
            </div>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold"
            >
              <RefreshCw size={13} /> Tentar novamente
            </button>
          </div>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={FileCheck2}
          label="Contratos registrados"
          value={available ? String(metrics.orders) : "—"}
          note="Pedidos no canal Exportação"
        />
        <Metric
          icon={Ship}
          label="Operações em aberto"
          value={available ? String(metrics.open) : "—"}
          note="Da confirmação à entrega"
        />
        <Metric
          icon={TriangleAlert}
          label="Exigem atenção"
          value={available ? String(metrics.attention) : "—"}
          note="Dados comerciais incompletos"
          attention={Boolean(available && metrics.attention)}
        />
        <CurrencyMetric
          available={available}
          totals={metrics.totalsByCurrency}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.45fr_.55fr]">
        <Card className="overflow-hidden p-0">
          <div className="border-b border-stone-100 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">
              Carteira internacional
            </p>
            <div className="mt-1 flex flex-col justify-between gap-2 md:flex-row md:items-end">
              <div>
                <h2 className="text-lg font-bold">Contratos e prontidão</h2>
                <p className="mt-1 text-xs text-stone-500">
                  Cada contrato preserva a moeda, a condição comercial e seu
                  prazo prometido.
                </p>
              </div>
              <span className="text-[10px] font-semibold text-stone-400">
                Contrato → booking → contêiner
              </span>
            </div>
          </div>

          {state === "loading" ? (
            <LoadingRows />
          ) : available && data.items.length ? (
            <div className="divide-y divide-stone-100">
              {data.items.map((order) => (
                <button
                  type="button"
                  key={order.id}
                  onClick={() => setSelectedOrder(order)}
                  className={`grid w-full gap-4 px-5 py-4 text-left transition hover:bg-stone-50 md:grid-cols-[1.15fr_.8fr_.8fr_150px_22px] md:items-center ${selectedOrder?.id === order.id ? "bg-violet-50/55" : ""}`}
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
                  <DataCell
                    label="Condição"
                    value={
                      order.incoterm
                        ? `${order.incoterm} · ${order.incotermLocation}`
                        : "Não definida"
                    }
                  />
                  <DataCell
                    label="Prazo"
                    value={
                      order.expectedDeliveryDate
                        ? new Date(
                            order.expectedDeliveryDate,
                          ).toLocaleDateString("pt-BR")
                        : "Não informado"
                    }
                  />
                  <div className="md:text-right">
                    <strong className="text-sm">
                      {formatMoney(order.totalAmount, order.currency)}
                    </strong>
                    <p
                      className={`mt-1 text-[10px] font-semibold ${order.readiness.ready ? "text-emerald-700" : "text-amber-700"}`}
                    >
                      {order.readiness.ready
                        ? "Base comercial pronta"
                        : `Falta: ${order.readiness.missing.join(", ")}`}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-stone-300" />
                </button>
              ))}
            </div>
          ) : state === "ready" ? (
            <div className="m-5 rounded-2xl border border-dashed p-8 text-center">
              <Ship size={22} className="mx-auto text-stone-300" />
              <strong className="mt-3 block text-sm">
                Nenhum contrato de exportação registrado
              </strong>
              <p className="mx-auto mt-1 max-w-lg text-xs leading-5 text-stone-500">
                Um contrato aparecerá aqui quando o pedido usar um canal do
                tipo Exportação. Ausência de dados não é tratada como operação
                concluída.
              </p>
            </div>
          ) : null}
        </Card>

        <AttentionPanel
          state={state}
          order={selectedOrder}
          attention={metrics.attention}
        />
      </section>

      <TrackingPreview onOpen={() => setTrackingOpen(true)} />

      <section className="grid gap-4 lg:grid-cols-3">
        <CapabilityCard
          icon={FileCheck2}
          eyebrow="Documentos"
          title="Dossiê por embarque"
          text="Proforma, commercial invoice, packing list e documentos aduaneiros vinculados ao mesmo contrato."
          status="Próxima camada"
        />
        <CapabilityCard
          icon={CalendarClock}
          eyebrow="Alertas"
          title="Mudanças que pedem ação"
          text="Cut-offs, VGM, SI, gate-in, transbordo, ETA e demurrage sem depender de conferência manual."
          status="Preparado"
        />
        <CapabilityCard
          icon={CircleDollarSign}
          eyebrow="Financeiro"
          title="Exposição por moeda"
          text="USD, EUR e demais moedas permanecem separadas. Conversão só com taxa, data e fonte registradas."
          status="Regra ativa"
        />
      </section>

      {data?.updatedAt && state === "ready" && (
        <p className="text-center text-[10px] text-stone-400">
          Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")} ·
          Fonte operacional: pedidos BBOS no canal Exportação.
        </p>
      )}

      {trackingOpen && (
        <TrackingDialog onClose={() => setTrackingOpen(false)} />
      )}
    </div>
  );
}

function ModuleRail({
  orders,
  attention,
  currencies,
}: {
  orders: number | null;
  attention: number | null;
  currencies: number | null;
}) {
  const modules = [
    ["Central", "Visão operacional", "active"],
    ["Contratos", orders == null ? "—" : String(orders), ""],
    ["Bookings", "A integrar", ""],
    ["Contêineres", "A integrar", ""],
    ["Documentos", attention == null ? "—" : `${attention} pendência(s)`, ""],
    ["Financeiro", currencies == null ? "—" : `${currencies} moeda(s)`, ""],
  ];
  return (
    <div className="grid overflow-hidden rounded-2xl border border-stone-200 bg-white sm:grid-cols-2 lg:grid-cols-6">
      {modules.map(([label, detail, stateName]) => (
        <div
          key={label}
          className={`border-b border-stone-100 px-4 py-3 last:border-b-0 sm:border-r lg:border-b-0 ${stateName === "active" ? "bg-violet-50" : ""}`}
        >
          <p className="text-[10px] font-bold uppercase tracking-[.08em] text-stone-800">
            {label}
          </p>
          <p className="mt-1 text-[10px] text-stone-400">{detail}</p>
        </div>
      ))}
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  attention = false,
}: {
  icon: typeof Ship;
  label: string;
  value: string;
  note: string;
  attention?: boolean;
}) {
  return (
    <Card className={attention ? "border-amber-200 bg-amber-50 p-4" : "p-4"}>
      <div className="flex items-center justify-between gap-3">
        <span
          className={`grid size-8 place-items-center rounded-xl ${attention ? "bg-white text-amber-700" : "bg-violet-50 text-violet-700"}`}
        >
          <Icon size={16} />
        </span>
        {attention && <Badge tone="warning">Ação</Badge>}
      </div>
      <p className="mt-3 text-[10px] text-stone-500">{label}</p>
      <strong className="mt-1 block text-xl">{value}</strong>
      <p className="mt-1 text-[10px] text-stone-400">{note}</p>
    </Card>
  );
}

function CurrencyMetric({
  available,
  totals,
}: {
  available: boolean;
  totals: Array<{ currency: string; amount: number }>;
}) {
  return (
    <Card className="p-4">
      <span className="grid size-8 place-items-center rounded-xl bg-violet-50 text-violet-700">
        <CircleDollarSign size={16} />
      </span>
      <p className="mt-3 text-[10px] text-stone-500">Carteira por moeda</p>
      {!available ? (
        <strong className="mt-1 block text-xl">—</strong>
      ) : totals.length ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {totals.map((item) => (
            <strong key={item.currency} className="text-base">
              {formatMoney(item.amount, item.currency)}
            </strong>
          ))}
        </div>
      ) : (
        <strong className="mt-1 block text-sm">Sem valores registrados</strong>
      )}
      <p className="mt-1 text-[10px] text-stone-400">
        Sem conversão silenciosa para real
      </p>
    </Card>
  );
}

function DataCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-stone-400">{label}</p>
      <p className="mt-1 text-xs font-semibold">{value}</p>
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-4 p-5" aria-label="Carregando contratos">
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid animate-pulse grid-cols-4 gap-4">
          <span className="h-9 rounded-lg bg-stone-100" />
          <span className="h-9 rounded-lg bg-stone-100" />
          <span className="h-9 rounded-lg bg-stone-100" />
          <span className="h-9 rounded-lg bg-stone-100" />
        </div>
      ))}
    </div>
  );
}

function AttentionPanel({
  state,
  order,
  attention,
}: {
  state: "loading" | "ready" | "unavailable";
  order: ExportOrder | null;
  attention: number;
}) {
  return (
    <Card className="p-5">
      <p className="text-[10px] font-bold uppercase tracking-[.14em] text-amber-700">
        Próxima melhor ação
      </p>
      <h2 className="mt-1 text-lg font-bold">O que pede decisão</h2>
      {state === "loading" ? (
        <p className="mt-5 text-xs text-stone-500">Avaliando a carteira…</p>
      ) : state === "unavailable" ? (
        <p className="mt-5 text-xs leading-5 text-stone-500">
          Sem acesso à fonte, o BBOS não classifica a operação como saudável.
        </p>
      ) : order ? (
        <div className="mt-5 space-y-4">
          <div className="rounded-2xl bg-stone-50 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[.08em] text-stone-400">
              Selecionado
            </p>
            <strong className="mt-1 block text-sm">
              {order.orderNumber ?? order.code}
            </strong>
            <p className="mt-1 text-xs text-stone-500">
              {order.customer.name}
            </p>
          </div>
          {order.readiness.ready ? (
            <ActionLine
              icon={CheckCircle2}
              title="Base comercial completa"
              text="Incoterm, local nomeado e prazo estão registrados."
              tone="green"
            />
          ) : (
            <ActionLine
              icon={TriangleAlert}
              title="Completar dados comerciais"
              text={order.readiness.missing.join(" · ")}
              tone="amber"
            />
          )}
          <ActionLine
            icon={Anchor}
            title="Vincular booking"
            text="O pedido ainda não possui fonte marítima vinculada."
            tone="violet"
          />
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-dashed p-5">
          <strong className="text-sm">Sem contrato selecionado</strong>
          <p className="mt-1 text-xs leading-5 text-stone-500">
            {attention
              ? `${attention} operação(ões) exige(m) atenção.`
              : "Registre um pedido de Exportação para iniciar a leitura."}
          </p>
        </div>
      )}
    </Card>
  );
}

function ActionLine({
  icon: Icon,
  title,
  text,
  tone,
}: {
  icon: typeof Ship;
  title: string;
  text: string;
  tone: "green" | "amber" | "violet";
}) {
  const colors = {
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return (
    <div className="flex gap-3">
      <span
        className={`grid size-8 shrink-0 place-items-center rounded-xl ${colors[tone]}`}
      >
        <Icon size={15} />
      </span>
      <div>
        <strong className="text-xs">{title}</strong>
        <p className="mt-1 text-[11px] leading-4 text-stone-500">{text}</p>
      </div>
    </div>
  );
}

function TrackingPreview({ onOpen }: { onOpen: () => void }) {
  return (
    <Card className="overflow-hidden border-violet-100 p-0">
      <div className="grid lg:grid-cols-[1fr_auto] lg:items-stretch">
        <div className="p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-violet-700">
              Camada logística
            </p>
            <Badge tone="neutral">Demonstração visual</Badge>
          </div>
          <h2 className="mt-2 text-xl font-bold">
            Acompanhe cada booking até o destino
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-5 text-stone-500">
            Esta prévia mostra como o BBOS exibirá rota, posição do navio,
            contêineres e alterações de ETA. Os dados abaixo são ilustrativos e
            não entram nos indicadores operacionais.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <PreviewDatum label="Contrato" value="EXP-DEMO-014" />
            <PreviewDatum label="Booking" value="MAEU-782014" />
            <PreviewDatum label="Rota" value="Santos → Gotemburgo" />
            <PreviewDatum label="Estado" value="Em trânsito" accent />
          </div>
        </div>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-24 items-center justify-between gap-6 bg-forest-900 px-6 py-5 text-left text-white transition hover:bg-forest-800 lg:w-64"
        >
          <span>
            <span className="block text-[10px] font-bold uppercase tracking-[.12em] text-white/55">
              Prévia interativa
            </span>
            <strong className="mt-1 block text-sm">Abrir mapa</strong>
          </span>
          <ArrowRight size={18} />
        </button>
      </div>
    </Card>
  );
}

function PreviewDatum({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="border-l border-stone-200 pl-3">
      <p className="text-[9px] uppercase tracking-[.08em] text-stone-400">
        {label}
      </p>
      <p
        className={`mt-1 text-xs font-bold ${accent ? "text-blue-700" : "text-stone-800"}`}
      >
        {value}
      </p>
    </div>
  );
}

function CapabilityCard({
  icon: Icon,
  eyebrow,
  title,
  text,
  status,
}: {
  icon: typeof Ship;
  eyebrow: string;
  title: string;
  text: string;
  status: string;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
          <Icon size={16} />
        </span>
        <span className="rounded-full bg-stone-100 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.08em] text-stone-500">
          {status}
        </span>
      </div>
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
        {eyebrow}
      </p>
      <h3 className="mt-1 text-sm font-bold">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-stone-500">{text}</p>
    </Card>
  );
}

function TrackingDialog({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-stone-950/55 p-0 backdrop-blur-sm md:items-center md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tracking-title"
    >
      <button
        type="button"
        aria-label="Fechar rastreamento"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-t-[28px] bg-[#F8F8F5] shadow-2xl md:rounded-[28px]">
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stone-200 bg-white/95 px-5 py-4 backdrop-blur md:px-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">
                Booking MAEU-782014
              </p>
              <Badge tone="neutral">Dados ilustrativos</Badge>
            </div>
            <h2 id="tracking-title" className="mt-1 text-xl font-bold">
              Santos → Gotemburgo
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-stone-200 bg-white transition hover:bg-stone-50"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </header>

        <div className="grid lg:grid-cols-[1.45fr_.55fr]">
          <div className="border-b border-stone-200 p-4 md:p-7 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
                  Posição do navio
                </p>
                <p className="mt-1 text-sm font-bold">MV Northern Light</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="success">Em trânsito</Badge>
                <span className="rounded-full bg-white px-3 py-1 text-[10px] font-semibold text-stone-500 shadow-sm">
                  Atualização ilustrativa · 37 min
                </span>
              </div>
            </div>
            <AtlanticRouteMap />
            <p className="mt-3 flex items-start gap-2 text-[10px] leading-4 text-stone-500">
              <LocateFixed size={13} className="mt-0.5 shrink-0" />
              Em uma integração real, esta posição representa o navio obtido
              por AIS. O contêiner individual só terá posição própria se houver
              telemetria IoT vinculada.
            </p>
          </div>

          <aside className="p-5 md:p-7">
            <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
              Linha do tempo
            </p>
            <div className="mt-5">
              {trackingSteps.map((step, index) => (
                <div key={step.title} className="relative flex gap-3 pb-6 last:pb-0">
                  {index < trackingSteps.length - 1 && (
                    <span className="absolute left-[7px] top-4 h-full w-px bg-stone-200" />
                  )}
                  <span
                    className={`relative z-[1] mt-0.5 size-4 shrink-0 rounded-full border-4 ${step.current ? "border-blue-100 bg-blue-600" : step.done ? "border-emerald-100 bg-emerald-600" : "border-stone-100 bg-stone-300"}`}
                  />
                  <div>
                    <strong className="block text-xs">{step.title}</strong>
                    <span className="mt-1 block text-[10px] text-stone-400">
                      {step.detail}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-800">
                <Clock3 size={15} />
                <strong className="text-xs">ETA alterado em 1 dia</strong>
              </div>
              <p className="mt-2 text-[11px] leading-4 text-amber-800/75">
                Exemplo de alerta: o BBOS registrará valor anterior, novo valor,
                fonte e horário da mudança.
              </p>
            </div>
          </aside>
        </div>

        <footer className="grid gap-3 border-t border-stone-200 bg-white px-5 py-4 text-xs sm:grid-cols-3 md:px-7">
          <TrackingFact icon={PackageCheck} label="Contêiner" value="MSKU 123456-7" />
          <TrackingFact icon={Anchor} label="Armador" value="Maersk · demonstrativo" />
          <TrackingFact icon={CalendarClock} label="ETA atual" value="18 out · 07:30" />
        </footer>
      </div>
    </div>
  );
}

function AtlanticRouteMap() {
  return (
    <div className="relative min-h-[330px] overflow-hidden rounded-3xl bg-[#DCEAF0] shadow-inner md:min-h-[430px]">
      <svg
        viewBox="0 0 900 520"
        className="absolute inset-0 h-full w-full"
        role="img"
        aria-label="Rota marítima ilustrativa entre Santos e Gotemburgo"
      >
        <defs>
          <pattern id="grid" width="70" height="70" patternUnits="userSpaceOnUse">
            <path d="M 70 0 L 0 0 0 70" fill="none" stroke="#B9CDD5" strokeWidth="1" opacity=".45" />
          </pattern>
          <filter id="routeShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity=".18" />
          </filter>
        </defs>
        <rect width="900" height="520" fill="url(#grid)" />
        <path d="M0,30 L112,28 L145,84 L126,151 L167,212 L151,283 L191,354 L174,430 L111,520 L0,520 Z" fill="#DCE0C9" opacity=".88" />
        <path d="M165,0 L324,0 L350,45 L321,96 L332,150 L294,213 L273,290 L225,354 L205,416 L174,430 L191,354 L151,283 L167,212 L126,151 L145,84 L112,28 Z" fill="#C9D4B4" opacity=".96" />
        <path d="M705,0 L900,0 L900,520 L760,520 L741,456 L767,386 L728,326 L749,253 L712,187 L744,117 Z" fill="#DCE0C9" opacity=".9" />
        <path d="M690,0 L768,0 L744,117 L712,187 L749,253 L728,326 L767,386 L741,456 L760,520 L690,520 L656,448 L678,372 L641,310 L670,239 L643,171 L677,103 Z" fill="#C9D4B4" opacity=".96" />
        <path d="M286 405 C 360 340, 411 299, 485 261 S 619 185, 693 111" fill="none" stroke="#FFFFFF" strokeWidth="10" strokeLinecap="round" opacity=".82" filter="url(#routeShadow)" />
        <path d="M286 405 C 360 340, 411 299, 485 261 S 619 185, 693 111" fill="none" stroke="#315E82" strokeWidth="4" strokeDasharray="12 12" strokeLinecap="round" />
        <circle cx="286" cy="405" r="9" fill="#0B7163" stroke="#fff" strokeWidth="5" />
        <circle cx="693" cy="111" r="9" fill="#0B7163" stroke="#fff" strokeWidth="5" />
        <g transform="translate(491 242)" filter="url(#routeShadow)">
          <circle r="22" fill="#102D29" stroke="#fff" strokeWidth="5" />
          <path d="M-9 3 H10 L6 9 H-5 Z M-4 2 V-8 H2 V2 M2-5 H7 V2" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
      <span className="absolute left-[25%] top-[77%] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-stone-700 shadow-sm">
        Santos
      </span>
      <span className="absolute right-[17%] top-[16%] rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-bold text-stone-700 shadow-sm">
        Gotemburgo
      </span>
      <span className="absolute bottom-4 left-4 rounded-full bg-white/90 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.08em] text-stone-500 shadow-sm">
        Rota esquemática · não operacional
      </span>
    </div>
  );
}

function TrackingFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Ship;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-stone-100 text-stone-500">
        <Icon size={14} />
      </span>
      <div>
        <p className="text-[9px] uppercase tracking-[.08em] text-stone-400">
          {label}
        </p>
        <strong className="mt-0.5 block text-xs">{value}</strong>
      </div>
    </div>
  );
}

function formatMoney(amount: number, currency: string) {
  if (currency === "UNSPECIFIED") {
    return `Moeda não informada · ${amount.toLocaleString("pt-BR", {
      maximumFractionDigits: 2,
    })}`;
  }
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
