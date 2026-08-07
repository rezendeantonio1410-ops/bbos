"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  Package,
  PackageCheck,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { salesDemoData } from "@/lib/sales-demo-data";
import { BrazilSalesPanel } from "@/components/brazil-sales-map";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function Metric({
  label,
  value,
  icon: Icon,
  trend,
  supporting,
}: {
  label: string;
  value: string;
  icon: typeof Target;
  trend?: number;
  supporting?: string;
}) {
  return (
    <Card className="border-0 p-4 shadow-sm transition hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700">{label}</p>
        <Icon size={15} strokeWidth={1.7} className="text-forest-700" />
      </div>
      <p className="mt-3 text-xl font-bold">{value}</p>
      <div className="mt-1 flex min-h-4 items-center justify-between gap-2 text-[9px]">
        {supporting && (
          <span className="truncate text-stone-500">{supporting}</span>
        )}
        {trend !== undefined && (
          <span
            className={`ml-auto font-bold ${trend > 0 ? "text-emerald-700" : trend < 0 ? "text-red-700" : "text-amber-700"}`}
          >
            {trend > 0 ? "↑" : trend < 0 ? "↓" : "→"}{" "}
            {number.format(Math.abs(trend))}%
          </span>
        )}
      </div>
    </Card>
  );
}

function LineChart({
  values,
  color = "#4d7b82",
}: {
  values: number[];
  color?: string;
}) {
  const min = Math.min(...values) * 0.92;
  const max = Math.max(...values) * 1.05;
  const points = values
    .map(
      (value, index) =>
        `${(index / (values.length - 1)) * 100},${66 - ((value - min) / (max - min)) * 54}`,
    )
    .join(" ");
  const coordinates = values.map((value, index) => ({
    value,
    x: (index / (values.length - 1)) * 100,
    y: 66 - ((value - min) / (max - min)) * 54,
  }));
  return (
    <svg
      viewBox="0 0 100 70"
      className="h-40 w-full"
      role="img"
      aria-label="Evolução no período"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="0"
        x2="100"
        y1="18"
        y2="18"
        stroke="#d6d3d1"
        strokeWidth=".6"
        strokeDasharray="2 3"
      />
      {coordinates.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r="1.8"
          fill={color}
          className="cursor-help"
        >
          <title>{`Período ${index + 1} • Valor ${number.format(point.value)} • Variação ${index ? number.format(((point.value - values[index - 1]!) / values[index - 1]!) * 100) : "0"}%`}</title>
        </circle>
      ))}
    </svg>
  );
}

export default function SalesProductDetailPage() {
  const params = useParams<{ id: string }>();
  const product =
    salesDemoData.products.find((item) => item.id === params.id) ??
    salesDemoData.products[0]!;
  const maxCustomer = Math.max(
    ...product.customers.map((item) => item.revenue),
  );
  const marginTrend = [
    product.marginPercent - 2.1,
    product.marginPercent - 1.7,
    product.marginPercent - 1.2,
    product.marginPercent - 0.8,
    product.marginPercent - 0.3,
    product.marginPercent,
  ];
  const packageWeightKg = product.product.includes("250 g")
    ? 0.25
    : product.product.includes("500 g")
      ? 0.5
      : 1;
  const averageUnitPrice = product.averagePricePerKg * packageWeightKg;
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <nav className="flex items-center gap-1 text-[10px] text-stone-400">
            <Link href="/dashboard" className="hover:text-forest-700">
              Dashboard
            </Link>
            <ChevronRight size={10} />
            <Link href="/vendas" className="hover:text-forest-700">
              Vendas
            </Link>
            <ChevronRight size={10} />
            <strong className="text-forest-700">Produto</strong>
          </nav>
          <div className="mt-4 flex items-center gap-3">
            <Link
              href="/vendas"
              className="rounded-xl border bg-white p-2 text-stone-500 transition hover:bg-stone-50"
            >
              <ArrowLeft size={17} />
            </Link>
            <div>
              <h1 className="font-[var(--font-manrope)] text-3xl font-bold">
                {product.product}
              </h1>
              <p className="mt-1 text-sm text-stone-500">
                {product.sku} • análise comercial completa
              </p>
            </div>
          </div>
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
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-9">
        <Metric
          label="Vendas"
          value={currency.format(product.revenue)}
          icon={CircleDollarSign}
          trend={product.growthPercent}
        />
        <Metric
          label="Volume"
          value={`${number.format(product.volumeKg)} kg`}
          icon={Package}
          trend={product.growthPercent - 1.2}
        />
        <Metric
          label="Meta"
          value={currency.format(product.target)}
          icon={Target}
          supporting="Referência mensal"
        />
        <Metric
          label="Atingimento"
          value={`${number.format(product.attainmentPercent)}%`}
          icon={TrendingUp}
          trend={product.attainmentPercent - 100}
        />
        <Metric
          label="Margem"
          value={`${number.format(product.marginPercent)}%`}
          icon={TrendingUp}
          trend={1.7}
        />
        <Metric
          label="Lucro"
          value={currency.format(product.profit)}
          icon={CircleDollarSign}
          trend={product.growthPercent - 2.1}
        />
        <Metric
          label="Preço médio/unidade"
          value={currency.format(averageUnitPrice)}
          icon={CircleDollarSign}
          supporting={`Equivalente ${currency.format(product.averagePricePerKg)}/kg`}
        />
        <Metric
          label="Pedidos"
          value={String(product.orderCount)}
          icon={ShoppingBag}
          trend={6.3}
        />
        <Metric
          label="Clientes"
          value={String(product.customers.length)}
          icon={Users}
          trend={4.1}
        />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-3">
        <Card className="border-0 p-5 shadow-sm">
          <h2 className="text-sm font-bold">Evolução de vendas</h2>
          <p className="mt-1 text-[10px] text-stone-500">Receita no período</p>
          <LineChart values={product.trend} />
        </Card>
        <Card
          id="meta"
          className="border-0 p-5 shadow-sm"
          title={`Realizado ${currency.format(product.revenue)} • Meta ${currency.format(product.target)} • Projeção ${currency.format(product.closingProjection)}`}
        >
          <h2 className="text-sm font-bold">Meta x realizado</h2>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <p className="text-[10px] text-stone-500">Realizado</p>
              <p className="mt-1 text-xl font-bold">
                {currency.format(product.revenue)}
              </p>
            </div>
            <p className="text-xs font-bold text-forest-700">
              {number.format(product.attainmentPercent)}%
            </p>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full ${product.attainmentPercent >= 100 ? "bg-emerald-600" : product.attainmentPercent >= 95 ? "bg-amber-500" : "bg-red-600"}`}
              style={{ width: `${Math.min(product.attainmentPercent, 100)}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
            <span className="text-stone-500">
              Meta
              <br />
              <strong className="text-stone-900">
                {currency.format(product.target)}
              </strong>
            </span>
            <span className="text-stone-500">
              Projeção
              <br />
              <strong className="text-stone-900">
                {currency.format(product.closingProjection)}
              </strong>
            </span>
          </div>
        </Card>
        <Card id="margem" className="border-0 p-5 shadow-sm">
          <h2 className="text-sm font-bold">Margem no tempo</h2>
          <p className="mt-1 text-[10px] text-stone-500">Evolução percentual</p>
          <LineChart values={marginTrend} color="#b98955" />
        </Card>
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-2">
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-forest-700" />
            <h2 className="text-sm font-bold">Clientes do produto</h2>
          </div>
          <div className="mt-4 space-y-3">
            {product.customers.map((customer, index) => (
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
                    <div className="flex flex-wrap justify-between gap-2">
                      <p className="text-xs font-bold">{customer.name}</p>
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
                    <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[9px] text-stone-500 sm:grid-cols-4">
                      <span>
                        {number.format(
                          customer.revenue / product.averagePricePerKg,
                        )}{" "}
                        kg
                      </span>
                      <span>
                        Margem{" "}
                        {number.format(product.marginPercent - index * 1.1)}%
                      </span>
                      <span>
                        {Math.max(product.orderCount - index * 9, 4)} pedidos
                      </span>
                      <strong
                        className={
                          customer.growthPercent >= 0
                            ? "text-emerald-700"
                            : "text-red-700"
                        }
                      >
                        {number.format(customer.sharePercent)}% part. •{" "}
                        {customer.growthPercent > 0 ? "↑" : "↓"}{" "}
                        {number.format(Math.abs(customer.growthPercent))}%
                      </strong>
                    </div>
                  </div>
                  <ChevronRight size={13} className="text-stone-300" />
                </div>
              </Link>
            ))}
          </div>
        </Card>
        <BrazilSalesPanel />
      </section>
      <section className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                <PackageCheck size={17} />
              </span>
              <div>
                <h2 className="text-sm font-bold">
                  Disponibilidade do produto
                </h2>
                <p className="mt-1 text-[10px] text-stone-500">
                  Estoque demonstrativo preparado para integração com Inventory
                  Engine.
                </p>
              </div>
            </div>
            <Badge tone="success">Disponível</Badge>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-[10px] text-stone-500">Estoque atual</p>
              <p className="mt-1 text-xl font-bold">
                {number.format((product.volumeKg * 0.5) / packageWeightKg)} un.
              </p>
            </div>
            <div>
              <p className="text-[10px] text-stone-500">
                Disponível para venda
              </p>
              <p className="mt-1 text-xl font-bold">
                {number.format((product.volumeKg * 0.42) / packageWeightKg)} un.
              </p>
            </div>
            <div>
              <p className="text-[10px] text-stone-500">Reservado</p>
              <p className="mt-1 text-xl font-bold">
                {number.format((product.volumeKg * 0.08) / packageWeightKg)} un.
              </p>
            </div>
            <div>
              <p className="text-[10px] text-stone-500">Cobertura</p>
              <p className="mt-1 text-xl font-bold">23 dias</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-500">Estoque mínimo</p>
              <p className="mt-1 text-xl font-bold">480 un.</p>
            </div>
            <div>
              <p className="text-[10px] text-stone-500">Produção programada</p>
              <p className="mt-1 text-sm font-bold">12/08/2026</p>
            </div>
          </div>
          <div className="mt-5">
            <div className="flex justify-between text-[9px] text-stone-500">
              <span>Cobertura atual</span>
              <strong>23 de 30 dias</strong>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full w-[77%] rounded-full bg-amber-500" />
            </div>
          </div>
        </Card>
        <Card className="border-0 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-forest-700" />
              <h2 className="text-sm font-bold">Pedidos recentes</h2>
            </div>
            <Badge tone="neutral">{product.orders.length} pedidos</Badge>
          </div>
          <div className="mt-4 space-y-2">
            {product.orders.map((order, index) => (
              <Link
                href={`/pedidos?pedido=${order.id}`}
                key={order.id}
                className="grid gap-2 rounded-xl border p-4 text-xs transition hover:bg-stone-50 md:grid-cols-[105px_1fr_80px_105px_90px_100px]"
              >
                <strong>{order.code}</strong>
                <span>{order.customer}</span>
                <span>{number.format(order.quantityKg)} kg</span>
                <strong>{currency.format(order.amount)}</strong>
                <Badge tone={index === 0 ? "success" : "warning"}>
                  {order.status}
                </Badge>
                <span className="flex items-center gap-1 text-stone-500">
                  <CalendarDays size={11} />
                  {index === 0 ? "12/08/2026" : "14/08/2026"}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      </section>
      <section className="mt-6" id="bbos-ia-produto">
        <Card className="border-0 bg-stone-950 p-5 text-white shadow-xl">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-white/10 text-coffee-300">
              <Sparkles size={17} />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.16em] text-coffee-300">
                BBOS IA • Produto
              </p>
              <h2 className="mt-1 text-lg font-bold">Leitura executiva</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              [
                "Vendas",
                `Cresceram ${number.format(product.growthPercent)}% no período.`,
                "Ver pedidos",
                "/pedidos",
              ],
              [
                "Margem",
                "Aumentou 1,7 p.p. no período.",
                "Analisar margem",
                "#margem",
              ],
              [
                "Cliente",
                `${product.customers[0]?.name ?? "Cliente líder"} concentra ${number.format(product.customers[0]?.sharePercent ?? 0)}%.`,
                "Ver cliente",
                `/vendas?cliente=${product.customers[0]?.id ?? ""}`,
              ],
              [
                "Estoque",
                "Cobertura atual estimada em 23 dias.",
                "Ver estoque",
                "/estoque",
              ],
              [
                "Projeção",
                `Fechamento indica ${number.format((product.closingProjection / product.target) * 100)}% da meta.`,
                "Analisar",
                "#meta",
              ],
            ].map(([label, insight, action, href]) => (
              <Link
                key={label}
                href={href!}
                className="rounded-xl border border-white/10 bg-white/[.04] p-4 transition hover:bg-white/[.08]"
              >
                <p className="text-[9px] font-bold uppercase tracking-wider text-white/40">
                  {label}
                </p>
                <p className="mt-2 text-xs font-semibold leading-5">
                  {insight}
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-coffee-300">
                  {action}
                  <ChevronRight size={10} />
                </span>
              </Link>
            ))}
          </div>
          <p className="mt-4 text-[9px] text-white/35">
            Insights demonstrativos preparados para futura integração com o
            motor analítico.
          </p>
        </Card>
      </section>
    </div>
  );
}
