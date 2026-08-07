"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BarChart3,
  ChevronRight,
  CircleDollarSign,
  Filter,
  MapPinned,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import type { Period, SalesProductPerformance } from "@bbos/shared";
import {
  getAllowedPresentations,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINES,
  type ProductLine,
} from "@bbos/shared/product-presentation";
import { salesDemoData } from "@/lib/sales-demo-data";
import { BrazilSalesPanel } from "@/components/brazil-sales-map";

const periods: Array<{ key: Period; label: string }> = [
  { key: "day", label: "Dia" },
  { key: "week", label: "Semana" },
  { key: "month", label: "Mês" },
  { key: "year", label: "Ano" },
];
const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const field =
  "rounded-xl border bg-white px-3 py-2.5 text-xs text-stone-700 outline-none transition focus:border-forest-700";

function productLine(product: SalesProductPerformance): ProductLine {
  if (product.product.includes("Microlote")) return "RAROS";
  if (product.product.includes("Clássico")) return "CLASSICOS";
  return "GOURMET";
}

function productPresentation(product: SalesProductPerformance) {
  if (product.product.includes("250 g")) return 250;
  if (product.product.includes("500 g")) return 500;
  return 1000;
}

function packageQuantity(product: SalesProductPerformance) {
  const packageKg = product.product.includes("250 g")
    ? 0.25
    : product.product.includes("500 g")
      ? 0.5
      : 1;
  return Math.round(product.volumeKg / packageKg);
}

function Sparkline({
  values,
  positive = true,
  large = false,
}: {
  values: number[];
  positive?: boolean;
  large?: boolean;
}) {
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.05;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${46 - ((value - min) / (max - min)) * 38}`,
    )
    .join(" ");
  return (
    <svg
      viewBox="0 0 100 50"
      className={large ? "h-48 w-full" : "h-10 w-24"}
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#4d7b82" : "#b45309"}
        strokeWidth={large ? 1.5 : 2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
  supporting,
}: {
  label: string;
  value: string;
  icon: typeof Target;
  supporting?: string;
}) {
  return (
    <Card className="border-0 p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700">{label}</p>
        <Icon size={15} strokeWidth={1.7} className="text-forest-700" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
      {supporting && (
        <p className="mt-1 text-[10px] text-stone-500">{supporting}</p>
      )}
    </Card>
  );
}

function CompactProductValue({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <span className="min-w-0 text-[10px] text-stone-500">
      {label}
      <strong className="mt-1 block truncate text-xs text-stone-900">
        {value}
      </strong>
    </span>
  );
}

function SalesGoalChart({ period }: { period: Period }) {
  const values: Record<Period, number[]> = {
    day: [16, 18, 17, 20, 21, 23, 24.86],
    week: [82, 86, 91, 96, 104, 112, 118.74],
    month: [312, 338, 361, 397, 421, 455, 486.32],
    year: [1.9, 2.15, 2.52, 2.81, 3.16, 3.49, 3.84],
  };
  const series = values[period];
  const min = Math.min(...series) * 0.92;
  const max = Math.max(...series) * 1.08;
  const points = series
    .map(
      (value, index) =>
        `${(index / (series.length - 1)) * 100},${68 - ((value - min) / (max - min)) * 54}`,
    )
    .join(" ");
  const previous = points
    .split(" ")
    .map((point) => {
      const [x, y] = point.split(",").map(Number);
      return `${x},${Math.min((y ?? 0) + 8, 72)}`;
    })
    .join(" ");
  return (
    <Card className="border-0 p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Meta x realizado
          </p>
          <h2 className="mt-1 text-lg font-bold">Performance comercial</h2>
          <p className="mt-2 text-xs text-stone-500">
            Faltam{" "}
            <strong className="text-red-700">
              {currency.format(salesDemoData.target - salesDemoData.actual)}
            </strong>{" "}
            para a meta
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-stone-500">Projeção de fechamento</p>
          <p className="mt-1 text-lg font-bold">
            {currency.format(salesDemoData.closingProjection)}
          </p>
          <p className="mt-1 flex items-center justify-end text-[10px] font-bold text-emerald-700">
            <ArrowUpRight size={11} />
            Tendência +
            {number.format(salesDemoData.previousPeriodGrowthPercent)}%
          </p>
        </div>
      </div>
      <div className="mt-4">
        <svg
          viewBox="0 0 100 74"
          className="h-44 w-full"
          role="img"
          aria-label="Vendas realizadas, meta, projeção e período anterior"
        >
          <defs>
            <linearGradient id="sales-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#4d7b82" stopOpacity=".18" />
              <stop offset="1" stopColor="#4d7b82" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points={`0,72 ${points} 100,72`} fill="url(#sales-fill)" />
          <polyline
            points={previous}
            fill="none"
            stroke="#a8a29e"
            strokeWidth="1"
            strokeDasharray="2 2"
          />
          <line
            x1="0"
            x2="100"
            y1="13"
            y2="13"
            stroke="#b98955"
            strokeWidth="1"
            strokeDasharray="3 2"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#4d7b82"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="83"
            y1={Number(points.split(" ").at(-2)?.split(",")[1])}
            x2="100"
            y2="8"
            stroke="#7065a8"
            strokeWidth="1.4"
            strokeDasharray="2 2"
          />
        </svg>
        <div className="mt-2 flex flex-wrap gap-4 text-[9px] text-stone-500">
          <span>— Realizado</span>
          <span className="text-coffee-700">┄ Meta</span>
          <span className="text-[#7065a8]">┄ Projeção</span>
          <span className="text-stone-400">┄ Período anterior</span>
        </div>
      </div>
    </Card>
  );
}

type CommercialAlert = {
  title: string;
  datum: string;
  diagnosis: string;
  impact: string;
  action: string;
  tone: "warning" | "danger";
};

function CommercialAlertDrawer({
  alert,
  onClose,
}: {
  alert: CommercialAlert;
  onClose: () => void;
}) {
  const steps = [
    ["Dado", alert.datum],
    ["Alerta", alert.title],
    ["Diagnóstico", alert.diagnosis],
    ["Impacto", alert.impact],
    ["Ação", alert.action],
    [
      "Resultado",
      "Acompanhar o próximo fechamento e registrar o efeito da ação.",
    ],
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-forest-950/25"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
              Diagnóstico comercial
            </p>
            <h2 className="mt-2 text-xl font-bold">{alert.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-7 space-y-4">
          {steps.map(([label, value], index) => (
            <div key={label} className="flex gap-3">
              <span
                className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index < 4 ? "bg-amber-50 text-amber-700" : "bg-forest-50 text-forest-700"}`}
              >
                {index + 1}
              </span>
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
                  {label}
                </p>
                <p className="mt-1 text-sm leading-6 text-stone-600">{value}</p>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

function ProductDrawer({
  product,
  onClose,
}: {
  product: SalesProductPerformance;
  onClose: () => void;
}) {
  const maxCustomer = Math.max(
    ...product.customers.map((item) => item.revenue),
  );
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar painel"
        className="absolute inset-0 bg-forest-950/25 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="relative h-full w-full max-w-3xl overflow-y-auto bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 border-b bg-white/95 px-6 py-5 backdrop-blur">
          <div className="flex items-start justify-between">
            <div>
              <nav className="flex items-center gap-1 text-[10px] text-stone-400">
                <span>Dashboard</span>
                <ChevronRight size={10} />
                <span>Vendas</span>
                <ChevronRight size={10} />
                <strong className="text-forest-700">Produto</strong>
              </nav>
              <h2 className="mt-2 font-[var(--font-manrope)] text-xl font-bold">
                {product.product}
              </h2>
              <p className="mt-1 text-xs text-stone-500">{product.sku}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-xl border p-2 text-stone-500"
            >
              <X size={18} />
            </button>
          </div>
        </header>
        <div className="space-y-8 p-6">
          <section>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Summary
                label="Receita"
                value={currency.format(product.revenue)}
                icon={CircleDollarSign}
              />
              <Summary
                label="Volume"
                value={`${number.format(product.volumeKg)} kg`}
                icon={Package}
              />
              <Summary
                label="Pedidos"
                value={String(product.orderCount)}
                icon={ShoppingBag}
              />
              <Summary
                label="Margem"
                value={`${number.format(product.marginPercent)}%`}
                icon={TrendingUp}
              />
              <Summary
                label="Preço médio"
                value={`${currency.format(product.averagePricePerKg)}/kg`}
                icon={CircleDollarSign}
              />
              <Summary
                label="Ticket médio"
                value={currency.format(product.averageTicket)}
                icon={ShoppingBag}
              />
              <Summary
                label="Lucro"
                value={currency.format(product.profit)}
                icon={CircleDollarSign}
              />
              <Summary
                label="Projeção"
                value={currency.format(product.closingProjection)}
                icon={Target}
              />
            </div>
          </section>
          <section>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">Vendas e histórico</h3>
                <p className="mt-1 text-[10px] text-stone-500">
                  Evolução no período selecionado
                </p>
              </div>
              <Badge
                tone={
                  product.attainmentPercent >= 100
                    ? "success"
                    : product.attainmentPercent >= 95
                      ? "warning"
                      : "danger"
                }
              >
                {number.format(product.attainmentPercent)}% da meta
              </Badge>
            </div>
            <Card className="mt-4 border-0 bg-stone-50 p-5">
              <Sparkline
                values={product.trend}
                positive={product.growthPercent >= 0}
                large
              />
              <div className="mt-2 flex justify-between text-[10px] text-stone-400">
                <span>Início</span>
                <span>Atual</span>
              </div>
            </Card>
          </section>
          <section>
            <div className="flex items-center gap-2">
              <Users size={15} className="text-forest-700" />
              <h3 className="text-sm font-bold">Clientes</h3>
            </div>
            <div className="mt-4 space-y-3">
              {product.customers.map((customer, index) => (
                <Link
                  key={customer.id}
                  href="/vendas"
                  className="block rounded-xl border p-4 transition hover:bg-stone-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-stone-300">
                      0{index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex justify-between gap-3">
                        <p className="text-xs font-semibold">{customer.name}</p>
                        <p className="text-xs font-bold">
                          {currency.format(customer.revenue)}
                        </p>
                      </div>
                      <div className="mt-2 h-1 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-[#4d7b82]"
                          style={{
                            width: `${(customer.revenue / maxCustomer) * 100}%`,
                          }}
                        />
                      </div>
                      <p className="mt-1 text-[9px] text-stone-400">
                        {number.format(customer.sharePercent)}% de participação
                        • {customer.growthPercent > 0 ? "+" : ""}
                        {number.format(customer.growthPercent)}%
                      </p>
                    </div>
                    <ChevronRight size={13} className="text-stone-300" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center gap-2">
              <MapPinned size={15} className="text-forest-700" />
              <h3 className="text-sm font-bold">Geografia</h3>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {product.geography.map((item) => (
                <div key={item.id} className="rounded-xl bg-stone-50 p-4">
                  <p className="text-xs font-bold">
                    {item.country} → {item.region}
                  </p>
                  <p className="mt-1 text-[10px] text-stone-500">
                    {item.state} → {item.city}
                  </p>
                  <p className="mt-3 text-sm font-bold">
                    {currency.format(item.revenue)}
                  </p>
                  <p className="mt-1 text-[9px] text-stone-400">
                    {number.format(item.sharePercent)}% das vendas do produto
                  </p>
                </div>
              ))}
            </div>
          </section>
          <section>
            <div className="flex items-center gap-2">
              <ShoppingBag size={15} className="text-forest-700" />
              <h3 className="text-sm font-bold">Pedidos relacionados</h3>
            </div>
            <div className="mt-4 space-y-2">
              {product.orders.map((order) => (
                <Link
                  key={order.id}
                  href="/pedidos"
                  className="grid gap-2 rounded-xl border p-4 text-xs transition hover:bg-stone-50 sm:grid-cols-[110px_1fr_90px_110px_80px]"
                >
                  <strong>{order.code}</strong>
                  <span>{order.customer}</span>
                  <span>{number.format(order.quantityKg)} kg</span>
                  <strong>{currency.format(order.amount)}</strong>
                  <span className="text-forest-700">{order.status}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </aside>
    </div>
  );
}

export default function SalesPage() {
  const [period, setPeriod] = useState<Period>("month");
  const [productFilter, setProductFilter] = useState("all");
  const [lineFilter, setLineFilter] = useState("all");
  const [presentationFilter, setPresentationFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [geographyFilter, setGeographyFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<SalesProductPerformance | null>(
    null,
  );
  const [selectedAlert, setSelectedAlert] = useState<CommercialAlert | null>(
    null,
  );
  useEffect(() => {
    const saved = window.localStorage.getItem(
      "bbos-sales-period",
    ) as Period | null;
    if (saved && periods.some((item) => item.key === saved)) setPeriod(saved);
  }, []);
  const selectPeriod = (value: Period) => {
    setPeriod(value);
    window.localStorage.setItem("bbos-sales-period", value);
  };
  const products = useMemo(
    () =>
      salesDemoData.products.filter(
        (item) =>
          (productFilter === "all" || item.product === productFilter) &&
          (lineFilter === "all" || productLine(item) === lineFilter) &&
          (presentationFilter === "all" ||
            productPresentation(item) === Number(presentationFilter)) &&
          `${item.product} ${item.sku}`
            .toLowerCase()
            .includes(query.toLowerCase()),
      ),
    [lineFilter, presentationFilter, productFilter, query],
  );
  const maxRevenue = Math.max(
    ...salesDemoData.products.map((item) => item.revenue),
  );
  const totalOrders = salesDemoData.products.reduce(
    (sum, item) => sum + item.orderCount,
    0,
  );
  const averageTicket = salesDemoData.actual / totalOrders;
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <nav className="flex items-center gap-1 text-[10px] text-stone-400">
            <Link href="/dashboard" className="hover:text-forest-700">
              Dashboard
            </Link>
            <ChevronRight size={10} />
            <strong className="text-forest-700">Vendas</strong>
          </nav>
          <div className="mt-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-forest-700">
            <BarChart3 size={14} />
            Performance comercial
          </div>
          <h1 className="mt-1 font-[var(--font-manrope)] text-3xl font-bold">
            Vendas
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Performance comercial por produto • atualizado hoje, 10:30
          </p>
        </div>
        <div className="flex rounded-xl bg-stone-100 p-1">
          {periods.map((item) => (
            <button
              key={item.key}
              onClick={() => selectPeriod(item.key)}
              className={`rounded-lg px-4 py-2 text-xs font-semibold ${period === item.key ? "bg-white shadow-sm" : "text-stone-500"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Summary
          label="Vendas"
          value={currency.format(salesDemoData.actual)}
          icon={CircleDollarSign}
          supporting={`${number.format(salesDemoData.attainmentPercent)}% da meta`}
        />
        <Summary
          label="Volume vendido"
          value={`${number.format(salesDemoData.volumeKg)} kg`}
          icon={Package}
        />
        <Summary
          label="Ticket médio"
          value={currency.format(averageTicket)}
          icon={CircleDollarSign}
        />
        <Summary
          label="Margem líquida"
          value={`${number.format(salesDemoData.marginPercent)}%`}
          icon={TrendingUp}
        />
        <Summary
          label="Pedidos"
          value={String(totalOrders)}
          icon={ShoppingBag}
        />
        <Summary
          label="Clientes ativos"
          value={String(salesDemoData.filterOptions.customers.length)}
          icon={Users}
        />
      </section>
      <section className="mt-5">
        <SalesGoalChart period={period} />
      </section>
      <section className="mt-5">
        <Card className="border-0 p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="flex min-w-52 flex-1 items-center gap-2 rounded-xl border px-3 py-2.5">
              <Search size={14} className="text-stone-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar produto ou SKU"
                className="w-full bg-transparent text-xs outline-none"
              />
            </label>
            <span className="hidden items-center gap-1 text-[10px] font-bold text-stone-400 xl:flex">
              <Filter size={12} />
              Filtros
            </span>
            <select
              value={lineFilter}
              onChange={(event) => {
                setLineFilter(event.target.value);
                setProductFilter("all");
                setPresentationFilter("all");
              }}
              className={field}
            >
              <option value="all">Todas as linhas</option>
              {PRODUCT_LINES.map((line) => (
                <option key={line} value={line}>
                  {PRODUCT_LINE_LABELS[line]}
                </option>
              ))}
            </select>
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              className={field}
            >
              <option value="all">Todos os produtos</option>
              {salesDemoData.products
                .filter(
                  (item) =>
                    lineFilter === "all" || productLine(item) === lineFilter,
                )
                .map((item) => (
                  <option key={item.id} value={item.product}>
                    {item.product}
                  </option>
                ))}
            </select>
            <select
              value={presentationFilter}
              onChange={(event) => setPresentationFilter(event.target.value)}
              className={field}
            >
              <option value="all">Todas as apresentações</option>
              {(lineFilter === "all"
                ? [250, 500, 1000]
                : getAllowedPresentations(lineFilter as ProductLine)
              ).map((weight) => (
                <option key={weight} value={weight}>
                  {weight === 1000 ? "1 kg" : `${weight} g`}
                </option>
              ))}
            </select>
            <select
              value={customerFilter}
              onChange={(event) => setCustomerFilter(event.target.value)}
              className={field}
            >
              <option value="all">Todos os clientes</option>
              {salesDemoData.filterOptions.customers.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={geographyFilter}
              onChange={(event) => setGeographyFilter(event.target.value)}
              className={field}
            >
              <option value="all">País / Região</option>
              {salesDemoData.filterOptions.geographies.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={channelFilter}
              onChange={(event) => setChannelFilter(event.target.value)}
              className={field}
            >
              <option value="all">Todos os canais</option>
              {salesDemoData.filterOptions.channels.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </div>
          {(lineFilter !== "all" ||
            presentationFilter !== "all" ||
            customerFilter !== "all" ||
            geographyFilter !== "all" ||
            channelFilter !== "all") && (
            <p className="mt-3 text-[10px] text-stone-400">
              Filtros demonstrativos preparados para futura consulta da API.
            </p>
          )}
        </Card>
      </section>
      <section className="mt-7">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
              Vendas por produto
            </p>
            <h2 className="mt-1 text-lg font-bold">Ranking comercial</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelected(products[0] ?? null)}
              className="rounded-lg border bg-white px-3 py-1.5 text-[10px] font-bold text-forest-700"
            >
              Visualização rápida
            </button>
            <Badge tone="neutral">{products.length} produtos</Badge>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          {products.map((product, index) => (
            <Link
              key={product.id}
              href={`/vendas/produtos/${product.id}`}
              className="w-full text-left"
            >
              <Card className="group border-0 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[28px_minmax(180px,1.4fr)_repeat(7,minmax(74px,1fr))_90px] lg:items-center">
                  <span className="text-xs font-bold text-stone-300">
                    0{index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold">{product.product}</p>
                      <Badge
                        tone={
                          product.attainmentPercent >= 100
                            ? "success"
                            : product.attainmentPercent >= 95
                              ? "warning"
                              : "danger"
                        }
                      >
                        {number.format(product.attainmentPercent)}%
                      </Badge>
                    </div>
                    <p className="mt-1 text-[10px] text-stone-500">
                      {product.sku} •{" "}
                      {PRODUCT_LINE_LABELS[productLine(product)]}
                    </p>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className="h-full rounded-full bg-[#4d7b82]"
                        style={{
                          width: `${(product.revenue / maxRevenue) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                  <CompactProductValue
                    label="Linha"
                    value={PRODUCT_LINE_LABELS[productLine(product)]}
                  />
                  <CompactProductValue
                    label="Quantidade"
                    value={number.format(packageQuantity(product))}
                  />
                  <CompactProductValue
                    label="Volume"
                    value={`${number.format(product.volumeKg)} kg`}
                  />
                  <CompactProductValue
                    label="Receita"
                    value={currency.format(product.revenue)}
                  />
                  <CompactProductValue
                    label="Margem"
                    value={`${number.format(product.marginPercent)}%`}
                  />
                  <CompactProductValue
                    label="Participação"
                    value={`${number.format((product.revenue / salesDemoData.actual) * 100)}%`}
                  />
                  <CompactProductValue
                    label="Variação"
                    value={`${product.growthPercent > 0 ? "+" : ""}${number.format(product.growthPercent)}%`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <Sparkline
                      values={product.trend}
                      positive={product.growthPercent >= 0}
                    />
                    <ChevronRight
                      size={15}
                      className="text-stone-300 transition group-hover:translate-x-0.5"
                    />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
          {!products.length && (
            <div className="rounded-2xl border border-dashed py-12 text-center text-sm text-stone-500">
              Nenhum produto encontrado.
            </div>
          )}
        </div>
      </section>
      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
                Composição comercial
              </p>
              <h2 className="mt-1 text-lg font-bold">Mix de Produtos</h2>
            </div>
            <Package size={17} className="text-forest-700" />
          </div>
          <div className="mt-5 space-y-4">
            {salesDemoData.products.map((product) => {
              const share = (product.revenue / salesDemoData.actual) * 100;
              return (
                <Link
                  href={`/vendas/produtos/${product.id}`}
                  key={product.id}
                  className="group block"
                >
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">
                        {product.product}
                      </p>
                      <p className="mt-1 text-[9px] text-stone-400">
                        {currency.format(product.revenue)} •{" "}
                        {number.format(product.volumeKg)} kg
                      </p>
                    </div>
                    <strong className="text-xs">{number.format(share)}%</strong>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-[#4d7b82] transition group-hover:bg-forest-700"
                      style={{ width: `${share}%` }}
                    />
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
                Rentabilidade
              </p>
              <h2 className="mt-1 text-lg font-bold">Margem por Produto</h2>
            </div>
            <TrendingUp size={17} className="text-forest-700" />
          </div>
          <div className="mt-5 space-y-2">
            {salesDemoData.products.map((product) => (
              <Link
                href={`/vendas/produtos/${product.id}`}
                key={product.id}
                className="grid grid-cols-[1fr_92px_70px_88px] items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-stone-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">
                    {product.product}
                  </p>
                  <p className="mt-1 text-[9px] text-stone-400">
                    {product.sku}
                  </p>
                </div>
                <strong className="text-xs">
                  {currency.format(product.revenue)}
                </strong>
                <Badge
                  tone={
                    product.marginPercent >= 22
                      ? "success"
                      : product.marginPercent >= 18
                        ? "warning"
                        : "danger"
                  }
                >
                  {number.format(product.marginPercent)}%
                </Badge>
                <span
                  className={`text-right text-[10px] font-bold ${product.growthPercent >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {currency.format(product.profit)}
                  <small className="mt-1 block font-medium">
                    {product.growthPercent > 0 ? "+" : ""}
                    {number.format(product.growthPercent)}%
                  </small>
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_.95fr]">
        <BrazilSalesPanel />
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={17} className="text-forest-700" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
                Clientes
              </p>
              <h2 className="mt-1 text-lg font-bold">Top Clientes</h2>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            {salesDemoData.products[0]!.customers.map((customer, index) => (
              <Link
                href={`/vendas?cliente=${customer.id}`}
                key={customer.id}
                className="block rounded-xl border p-4 transition hover:bg-stone-50"
              >
                <div className="flex gap-3">
                  <span className="text-[10px] font-bold text-stone-300">
                    0{index + 1}
                  </span>
                  <div className="flex-1">
                    <div className="flex justify-between">
                      <p className="text-xs font-bold">{customer.name}</p>
                      <p className="text-xs font-bold">
                        {currency.format(customer.revenue)}
                      </p>
                    </div>
                    <p className="mt-2 text-[10px] text-stone-500">
                      {number.format(customer.revenue / 78)} kg • margem 22,4% •
                      18 pedidos
                    </p>
                    <p
                      className={`mt-1 text-[9px] font-bold ${customer.growthPercent >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {customer.growthPercent > 0 ? "+" : ""}
                      {number.format(customer.growthPercent)}% vs. período
                      anterior
                    </p>
                  </div>
                  <ChevronRight size={13} className="text-stone-300" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      </section>
      <section className="mt-8" id="bbos-ia-comercial">
        <Card className="border-0 bg-stone-950 p-5 text-white shadow-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-coffee-300">
                <Sparkles size={17} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-coffee-300">
                  BBOS IA • Comercial
                </p>
                <h2 className="mt-1 text-lg font-bold">Insights acionáveis</h2>
              </div>
            </div>
            <Badge tone="neutral">Demonstração</Badge>
          </div>
          <div className="mt-5 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
            {[
              {
                insight: "Microlote cresceu 18,4% no período.",
                impact: "R$ 16,8 mil de incremento estimado.",
                recommendation:
                  "Priorizar clientes recorrentes de maior margem.",
                action: "Ver produto",
                href: "/vendas/produtos/prod-mic-250",
              },
              {
                insight: "Essencial perdeu margem e volume.",
                impact: "R$ 5,2 mil de pressão no mix.",
                recommendation: "Revisar preço, frete e substituição de SKU.",
                action: "Analisar",
                href: "/vendas/produtos/prod-ess-500",
              },
              {
                insight: "Rede Grão Nobre reduziu compras em 2,4%.",
                impact: "R$ 1,1 mil no ritmo mensal.",
                recommendation:
                  "Reabrir planejamento da conta e pedidos pendentes.",
                action: "Ver cliente",
                href: "/vendas?cliente=cli-2",
              },
              {
                insight: "Região Sul está abaixo da meta.",
                impact: "R$ 15,6 mil ainda não realizados.",
                recommendation: "Aprofundar por estado, cliente e produto.",
                action: "Ver região",
                href: "/vendas?regiao=sul",
              },
            ].map((item) => (
              <Link
                key={item.insight}
                href={item.href}
                className="rounded-xl border border-white/10 bg-white/[.04] p-4 transition hover:bg-white/[.08]"
              >
                <p className="text-xs font-bold leading-5">{item.insight}</p>
                <p className="mt-3 text-[10px] text-white/60">
                  <strong className="text-white/80">Impacto:</strong>{" "}
                  {item.impact}
                </p>
                <p className="mt-2 text-[10px] leading-4 text-white/60">
                  {item.recommendation}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-coffee-300">
                  {item.action}
                  <ChevronRight size={10} />
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
      <section className="mt-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-red-700">
            Dado → ação
          </p>
          <h2 className="mt-1 text-lg font-bold">Alertas comerciais</h2>
        </div>
        <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          {(
            [
              {
                title: "Vendas abaixo da meta",
                datum: "Realizado em 94,6% da meta mensal.",
                diagnosis:
                  "O gap está concentrado na Região Sul e no SKU Essencial 500 g.",
                impact: "R$ 27.780 ainda não realizados.",
                action:
                  "Abrir plano de recuperação comercial por região e produto.",
                tone: "warning",
              },
              {
                title: "Produto em queda",
                datum: "Bispo Essencial 500 g recuou 3,1%.",
                diagnosis:
                  "Menor recorrência em distribuidores e margem abaixo da média.",
                impact: "R$ 5.200 de impacto estimado no mix.",
                action: "Revisar carteira, posicionamento e SKU substituto.",
                tone: "danger",
              },
              {
                title: "Região abaixo da meta",
                datum: "Sul atingiu 82,7% da meta.",
                diagnosis: "Paraná e Santa Catarina concentram a diferença.",
                impact: "R$ 15.600 abaixo da meta regional.",
                action: "Aprofundar até cliente e pedido antes do fechamento.",
                tone: "danger",
              },
              {
                title: "Margem comprimida",
                datum: "Margem consolidada em 18,8% contra meta de 20%.",
                diagnosis:
                  "Mix Essencial e custo logístico reduziram o resultado.",
                impact: "1,2 p.p. de diferença operacional.",
                action:
                  "Simular mix de maior margem e revisar política de frete.",
                tone: "warning",
              },
            ] as CommercialAlert[]
          ).map((alert) => (
            <button
              key={alert.title}
              onClick={() => setSelectedAlert(alert)}
              className="text-left"
            >
              <Card
                className={`h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${alert.tone === "danger" ? "border-red-200" : "border-amber-200"}`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-sm font-bold">{alert.title}</p>
                  <span
                    className={`size-2 rounded-full ${alert.tone === "danger" ? "bg-red-500" : "bg-amber-500"}`}
                  />
                </div>
                <p className="mt-3 text-xs leading-5 text-stone-500">
                  {alert.datum}
                </p>
                <span className="mt-4 flex items-center gap-1 text-[10px] font-bold text-forest-700">
                  Ver causas e ações <ChevronRight size={11} />
                </span>
              </Card>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <ProductDrawer product={selected} onClose={() => setSelected(null)} />
      )}
      {selectedAlert && (
        <CommercialAlertDrawer
          alert={selectedAlert}
          onClose={() => setSelectedAlert(null)}
        />
      )}
    </div>
  );
}
