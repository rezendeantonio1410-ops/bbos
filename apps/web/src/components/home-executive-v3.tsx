"use client";

import { useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Building2,
  CircleDollarSign,
  Download,
  Factory,
  Gauge,
  PackageCheck,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
  WalletCards,
  Warehouse,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { BrazilSalesPanel } from "./brazil-sales-map";
import { executiveV3DemoData } from "@/lib/executive-v3-demo-data";
import { currentUser } from "@/lib/current-user";

const palette = {
  identity: "var(--analytic-identity)",
  positive: "var(--analytic-positive)",
  coffee: "var(--analytic-coffee)",
  finance: "var(--analytic-finance)",
  projection: "var(--analytic-projection)",
  attention: "var(--analytic-attention)",
  critical: "var(--analytic-critical)",
};
const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

type Period = "today" | "week" | "month";
const vital = [
  {
    label: "Vendas contratadas",
    value: "R$ 564.780",
    trend: "↑ 10,1%",
    href: "/vendas",
    color: palette.identity,
    icon: BarChart3,
    tooltip: "Valor total dos pedidos comerciais confirmados no período.",
  },
  {
    label: "Receita faturada",
    value: "R$ 486.320",
    trend: "↑ 12,4%",
    href: "/dashboard",
    color: palette.identity,
    icon: TrendingUp,
    tooltip: "Valor efetivamente faturado/reconhecido no período.",
  },
  {
    label: "Lucro líquido",
    value: "R$ 91.340",
    trend: "↑ 8,7%",
    href: "/dashboard",
    color: palette.positive,
    icon: CircleDollarSign,
  },
  {
    label: "ROI",
    value: "18,7%",
    trend: "Meta 20%",
    href: "/dashboard#roi",
    color: palette.attention,
    icon: Gauge,
  },
  {
    label: "Caixa",
    value: "R$ 312.400",
    trend: "+ R$ 48.200",
    href: "/financeiro",
    color: palette.finance,
    icon: WalletCards,
  },
];

export function HomeExecutiveV3() {
  const [period, setPeriod] = useState<Period>("month");
  const criticalInventory = executiveV3DemoData.inventory.criticalItems;
  const insights = [
    {
      tone: "ATENÇÃO",
      color: palette.attention,
      title: "ROI abaixo da meta",
      text: "18,7% realizado vs. meta de 20%",
      impact: "Principal impacto: custo industrial.",
      href: "/dashboard#roi",
      action: "Ver análise",
    },
    {
      tone: "CRÍTICO",
      color: palette.critical,
      title: "Estoque de embalagem 500 g",
      text: "Cobertura estimada: 6 dias",
      impact: "Requer acompanhamento de reposição.",
      href: "/estoque",
      action: "Ver estoque",
    },
    {
      tone: "POSITIVO",
      color: palette.positive,
      title: "Receita projetada acima da meta",
      text: "Projeção do mês: +7,2%",
      impact: "Tendência favorável no período.",
      href: "/dashboard",
      action: "Ver projeção",
    },
  ];
  return (
    <div className="home-command mx-auto w-full max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-[#087568]">
            <Building2 size={13} />
            Bispo Coffees · Visão Executiva
          </p>
          <h1 className="mt-1 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">
            Bom dia, {currentUser.name.split(" ")[0]}.
          </h1>
          <p className="mt-2 text-sm text-[#626B69]">
            A operação está saudável, mas há{" "}
            <strong className="text-[#111514]">3 pontos</strong> que merecem sua
            atenção hoje.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[#E7ECEA] bg-white p-1">
            {(
              [
                ["today", "Hoje"],
                ["week", "Semana"],
                ["month", "Mês"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${period === key ? "bg-[#F0F3F2] text-[#111514]" : "text-[#626B69] hover:bg-[#F7F9F8]"}`}
              >
                {label}
              </button>
            ))}
            <button className="rounded-lg px-3 py-2 text-xs font-semibold text-[#626B69] hover:bg-[#F7F9F8]">
              Personalizar
            </button>
          </div>
          <TopButton icon={SlidersHorizontal}>Filtros</TopButton>
          <TopButton icon={Download}>Exportar</TopButton>
        </div>
      </header>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="grid sm:grid-cols-2 xl:grid-cols-5">
          {vital.map((item, index) => (
            <Link
              key={item.label}
              href={item.href}
              title={item.tooltip}
              aria-label={
                item.tooltip ? `${item.label}: ${item.tooltip}` : item.label
              }
              className={`group relative p-4 transition hover:bg-[#F7F9F8] ${index ? "xl:border-l xl:border-[#E7ECEA]" : ""}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#626B69]">
                  {item.label}
                </p>
                <item.icon
                  size={14}
                  style={{ color: item.color }}
                  strokeWidth={1.7}
                />
              </div>
              <p className="mt-2 text-xl font-bold tracking-tight">
                {item.value}
              </p>
              <p
                className="mt-1 text-[10px] font-bold"
                style={{ color: item.color }}
              >
                {item.trend}
              </p>
            </Link>
          ))}
        </div>
      </Card>

      <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,.82fr)]">
        <BusinessVision period={period} />
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">
                <Sparkles size={13} />
                BBOS Intelligence
              </p>
              <h2 className="mt-2 text-lg font-bold">
                O que precisa da sua atenção hoje
              </h2>
            </div>
            <Badge tone="neutral">Regras atuais</Badge>
          </div>
          <div className="mt-4 divide-y divide-[#E7ECEA]">
            {insights.map((i) => (
              <div key={i.title} className="py-3 first:pt-0">
                <p
                  className="text-[9px] font-bold tracking-[.12em]"
                  style={{ color: i.color }}
                >
                  {i.tone}
                </p>
                <p className="mt-1 text-xs font-bold text-[#111514]">
                  {i.title}
                </p>
                <p className="mt-1 text-[10px] leading-4 text-[#626B69]">
                  {i.text}
                </p>
                <p className="text-[9px] leading-4 text-[#7A8381]">
                  {i.impact}
                </p>
                <Link
                  href={i.href}
                  className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold"
                  style={{ color: i.color }}
                >
                  {i.action} <ArrowRight size={10} />
                </Link>
              </div>
            ))}
          </div>
          <label className="mt-3 flex items-center gap-2 rounded-xl border border-[#E7ECEA] bg-[#F7F9F8] px-3 py-2.5">
            <Search size={14} className="text-[#7A8381]" />
            <input
              disabled
              placeholder="Pergunte ao BBOS..."
              className="w-full bg-transparent text-xs text-[#626B69] placeholder:text-[#7A8381] outline-none"
            />
            <span className="text-[8px] text-[#7A8381]">Em breve</span>
          </label>
        </Card>
      </section>

      <section className="mt-5">
        <SectionTitle
          eyebrow="Áreas da empresa"
          title="Quatro pilares"
          subtitle="Escolha onde agir e aprofunde em poucos cliques."
        />
        <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Pillar
            title="Comercial"
            href="/vendas"
            color={palette.positive}
            icon={BarChart3}
            items={[
              ["Vendas", "R$ 564.780"],
              ["Pedidos", "164"],
              ["Margem", "18,8%"],
              ["Clientes ativos", "86"],
            ]}
          />
          <Pillar
            title="Indústria"
            href="/dashboard-industrial"
            color={palette.coffee}
            icon={Factory}
            items={[
              ["Produção", "18.420 kg"],
              ["Eficiência", "91,8%"],
              ["Rendimento", "84,5%"],
              ["Perdas", "2,7%"],
            ]}
          />
          <Pillar
            title="Estoque & Suprimentos"
            href="/estoque"
            color={palette.identity}
            icon={Warehouse}
            items={[
              ["Estoque", "42.180 kg"],
              ["Cobertura", "38 dias"],
              ["Itens críticos", String(criticalInventory)],
              ["Compras", "R$ 215.600"],
            ]}
          />
          <Pillar
            title="Financeiro"
            href="/financeiro"
            color={palette.finance}
            icon={WalletCards}
            items={[
              ["Caixa", "R$ 312.400"],
              ["A receber", "R$ 384.200"],
              ["A pagar", "R$ 218.900"],
              ["Resultado projetado", "R$ 97.800"],
            ]}
          />
        </div>
      </section>

      <section className="mt-6">
        <SectionTitle
          eyebrow="Segunda camada"
          title="Detalhamento executivo"
          subtitle="Informações complementares sem competir com a central de comando."
        />
        <div className="mt-3 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
          <BrazilSalesPanel />
          <Rankings />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Secondary
            href="/pedidos"
            icon={PackageCheck}
            title="Pedidos"
            value="27 em aberto"
            detail="R$ 184.600 no backlog"
            color={palette.identity}
          />
          <Secondary
            href="/financeiro/fluxo-caixa"
            icon={WalletCards}
            title="Fluxo de Caixa"
            value="R$ 312.400"
            detail="Fechamento projetado R$ 360 mil"
            color={palette.finance}
          />
          <Secondary
            href="/dashboard-industrial"
            icon={Factory}
            title="Performance Industrial"
            value="91,8% eficiência"
            detail="2 OPs requerem atenção"
            color={palette.coffee}
          />
        </div>
      </section>
    </div>
  );
}

function BusinessVision({ period }: { period: Period }) {
  const [hover, setHover] = useState<number | null>(null);
  const labels = ["01", "05", "10", "15", "20", "25", "30"];
  const series = [
    {
      name: "Receita",
      color: palette.identity,
      values: [62, 128, 196, 274, 348, 422, 486],
      projection: 536,
    },
    {
      name: "Custos",
      color: palette.coffee,
      values: [50, 104, 158, 221, 280, 337, 395],
      projection: 428,
    },
    {
      name: "Lucro",
      color: palette.positive,
      values: [12, 24, 38, 53, 68, 85, 91],
      projection: 108,
    },
    {
      name: "Caixa",
      color: palette.finance,
      values: [238, 254, 247, 271, 282, 298, 312],
      projection: 360,
    },
  ];
  const max = 560;
  const x = (i: number) => 52 + i * 92;
  const y = (v: number) => 205 - (v / max) * 170;
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">
            Visão do Negócio
          </p>
          <h2 className="mt-1 text-lg font-bold">
            Realizado e projeção do período
          </h2>
        </div>
        <Badge tone="neutral">
          Demo consolidado ·{" "}
          {period === "today" ? "Hoje" : period === "week" ? "Semana" : "Mês"}
        </Badge>
      </div>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_210px]">
        <div>
          <div className="relative">
            <svg
              viewBox="0 0 660 230"
              className="h-[220px] w-full"
              onMouseLeave={() => setHover(null)}
            >
              {[0, 140, 280, 420, 560].map((v) => (
                <g key={v}>
                  <line
                    x1="52"
                    x2="620"
                    y1={y(v)}
                    y2={y(v)}
                    stroke="#D8E1DE"
                    strokeWidth="1"
                  />
                  <text
                    x="44"
                    y={y(v) + 4}
                    textAnchor="end"
                    fontSize="9"
                    fontWeight="500"
                    fill="#5F6C68"
                  >
                    {v ? `${v}k` : "0"}
                  </text>
                </g>
              ))}
              {labels.map((l, i) => (
                <text
                  key={l}
                  x={x(i)}
                  y="221"
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="500"
                  fill="#5F6C68"
                >
                  {l}
                </text>
              ))}
              {series.map((s) => {
                const pts = s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
                return (
                  <g key={s.name}>
                    <polyline
                      points={pts}
                      fill="none"
                      stroke={s.color}
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <line
                      x1={x(6)}
                      y1={y(s.values[6]!)}
                      x2="642"
                      y2={y(s.projection)}
                      stroke={s.color}
                      strokeWidth="2"
                      strokeDasharray="5 5"
                    />
                  </g>
                );
              })}
              {labels.map((_, i) => (
                <rect
                  key={i}
                  x={x(i) - 42}
                  y="28"
                  width="84"
                  height="183"
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  className="cursor-pointer"
                />
              ))}
              {hover !== null && (
                <line
                  x1={x(hover)}
                  x2={x(hover)}
                  y1="28"
                  y2="205"
                  stroke="#B8C7C2"
                  strokeDasharray="3 3"
                />
              )}
            </svg>
            {hover !== null && (
              <div
                className="pointer-events-none absolute top-7 rounded-xl border border-[#E7ECEA] bg-white p-3 text-[9px] shadow-lg"
                style={{
                  left: `${Math.min(72, Math.max(12, (x(hover) / 660) * 100))}%`,
                }}
              >
                <strong>Dia {labels[hover]}</strong>
                {series.map((s) => (
                  <p key={s.name} className="mt-1" style={{ color: s.color }}>
                    {s.name}: {brl.format((s.values[hover] ?? 0) * 1000)}
                  </p>
                ))}
              </div>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-3">
            {series.map((s) => (
              <span
                key={s.name}
                className="flex items-center gap-1.5 text-[9px] font-medium text-[#4F5C59]"
              >
                <i
                  className="size-1.5 rounded-full"
                  style={{ background: s.color }}
                />
                {s.name}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-[9px] font-medium text-[#4F5C59]">
              <i className="h-px w-3 border-t border-dashed border-[var(--analytic-projection)]" />
              Projeção
            </span>
          </div>
        </div>
        <div className="rounded-2xl border border-[#E7ECEA] bg-white p-4">
          <p className="text-[9px] font-bold uppercase tracking-[.13em] text-[var(--analytic-projection)]">
            Projeção do mês
          </p>
          <div className="mt-4 space-y-4">
            <Projection label="Receita" value="R$ 536.000" />
            <Projection label="Lucro" value="R$ 108.000" />
            <Projection label="Caixa" value="R$ 360.000" />
            <Projection label="Margem" value="20,1%" />
          </div>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex items-center gap-1 text-[10px] font-bold text-[var(--analytic-projection)]"
          >
            Abrir análise executiva <ArrowRight size={10} />
          </Link>
        </div>
      </div>
    </Card>
  );
}
function Projection({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] text-[#7A8381]">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}
function Pillar({
  title,
  href,
  color,
  icon: Icon,
  items,
}: {
  title: string;
  href: string;
  color: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number }>;
  items: string[][];
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full overflow-hidden p-0 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="h-1" style={{ background: color }} />
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className="grid size-8 place-items-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${color} 9%, white)`,
                  color,
                }}
              >
                <Icon size={15} strokeWidth={1.7} />
              </span>
              <h3 className="text-sm font-bold">{title}</h3>
            </div>
            <ArrowRight
              size={13}
              className="text-[#7A8381] transition group-hover:translate-x-0.5"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            {items.map(([label, value]) => (
              <div key={label}>
                <p className="text-[9px] text-[#7A8381]">{label}</p>
                <p className="mt-0.5 text-xs font-bold">{value}</p>
              </div>
            ))}
          </div>
          <svg
            viewBox="0 0 180 25"
            className="mt-3 h-6 w-full"
            aria-hidden="true"
          >
            <polyline
              points="0,20 24,17 48,18 72,11 96,14 120,7 145,9 180,3"
              fill="none"
              stroke={color}
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <p className="mt-2 text-[10px] font-bold" style={{ color }}>
            Ver {title} →
          </p>
        </div>
      </Card>
    </Link>
  );
}
function Rankings() {
  const customers = executiveV3DemoData.topCustomers.slice(0, 3);
  const products = executiveV3DemoData.topProducts.slice(0, 3);
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[#087568]">
            Destaques
          </p>
          <h2 className="mt-1 text-base font-bold">Clientes e produtos</h2>
        </div>
        <Badge tone="neutral">Demo comercial</Badge>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
        <Ranking
          title="Top Clientes"
          href="/vendas"
          items={customers.map((i) => [
            i.name,
            brl.format(i.revenue),
            i.salesShare ?? 0,
          ])}
        />
        <Ranking
          title="Top Produtos"
          href="/vendas"
          items={products.map((i) => [
            i.name,
            brl.format(i.revenue),
            (i.revenue / 486320) * 100,
          ])}
        />
      </div>
    </Card>
  );
}
function Ranking({
  title,
  href,
  items,
}: {
  title: string;
  href: string;
  items: Array<[string, string, number]>;
}) {
  return (
    <div>
      <div className="flex justify-between">
        <h3 className="text-xs font-bold">{title}</h3>
        <Link href={href} className="text-[9px] font-bold text-[#087568]">
          Detalhar
        </Link>
      </div>
      <div className="mt-3 space-y-3">
        {items.map(([name, value, share], i) => (
          <div key={name}>
            <div className="flex justify-between gap-3 text-[10px]">
              <span className="truncate">
                <b className="mr-2 text-[#7A8381]">0{i + 1}</b>
                {name}
              </span>
              <strong>{value}</strong>
            </div>
            <div className="mt-1 h-1 rounded-full bg-[#E7ECEA]">
              <div
                className="h-full rounded-full bg-[#087568]"
                style={{ width: `${Math.min(share * 3, 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
function Secondary({
  href,
  icon: Icon,
  title,
  value,
  detail,
  color,
}: {
  href: string;
  icon: ComponentType<{ size?: number }>;
  title: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <Link href={href}>
      <Card className="h-full p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
        <div className="flex items-start justify-between">
          <span
            className="grid size-8 place-items-center rounded-lg"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 9%, white)`,
            }}
          >
            <Icon size={15} />
          </span>
          <ArrowRight size={12} className="text-[#7A8381]" />
        </div>
        <p className="mt-3 text-[10px] font-semibold text-[#626B69]">{title}</p>
        <p className="mt-1 text-lg font-bold">{value}</p>
        <p className="mt-1 text-[9px] text-[#7A8381]">{detail}</p>
      </Card>
    </Link>
  );
}
function SectionTitle({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#087568]">
        {eyebrow}
      </p>
      <h2 className="mt-1 text-lg font-bold">{title}</h2>
      <p className="mt-1 text-xs text-[#626B69]">{subtitle}</p>
    </div>
  );
}
function TopButton({
  icon: Icon,
  children,
}: {
  icon: ComponentType<{ size?: number }>;
  children: string;
}) {
  return (
    <button className="flex items-center gap-2 rounded-xl border border-[#E7ECEA] bg-white px-3 py-2.5 text-xs font-semibold text-[#626B69] hover:bg-[#F7F9F8]">
      <Icon size={14} />
      {children}
    </button>
  );
}
