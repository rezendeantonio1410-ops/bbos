"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Factory,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { PRODUCT_CATALOG_DEMO } from "@bbos/shared/product-presentation";
import { skuCostDemo } from "@/lib/costing-demo-data";
import { PRODUCTS_API_URL } from "@/lib/product-catalog-api";
import type { CatalogProduct } from "@bbos/shared/product-presentation";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const pct = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const parts = [
  ["Café verde", 12.4, "Lote 2026-041"],
  ["Perda de torra", 1.84, "OP-2026-0112 / Batch 03"],
  ["Embalagem", 2.9, "Consumo confirmado"],
  ["Etiqueta", 0.42, "Consumo confirmado"],
  ["Caixa / material", 0.36, "Consumo confirmado"],
  ["Mão de obra", 1.7, "Apontamento da OP"],
  ["Energia", 0.64, "Medição direta"],
  ["Gás", 0.91, "Medição da torra"],
  ["Máquina / depreciação", 0.48, "TOR-01 • 0,38 h"],
  ["Manutenção", 0.31, "Centro IND-MAN"],
  ["Outros industriais", 1.28, "Rateios industriais"],
] as const;

export default function SkuCostPage({
  params,
}: {
  params: Promise<{ id: string; sku: string }>;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const route = use(params);
  const [persistedProduct, setPersistedProduct] =
    useState<CatalogProduct | null>(null);
  useEffect(() => {
    void fetch(`${PRODUCTS_API_URL}/${route.id}`)
      .then(async (response) => {
        if (response.ok)
          setPersistedProduct((await response.json()) as CatalogProduct);
      })
      .catch(() => undefined);
  }, [route.id]);
  const product =
    persistedProduct ??
    PRODUCT_CATALOG_DEMO.find((item) => item.id === route.id);
  const variant = product?.skus.find(
    (item) => item.sku === decodeURIComponent(route.sku),
  );
  if (!product || !variant) return <p>SKU não encontrado.</p>;
  const max = Math.max(...parts.map((item) => item[1]));
  return (
    <div className="mx-auto max-w-[1500px]">
      <nav className="flex items-center gap-1 text-[10px] text-stone-400">
        <Link href="/produtos">Produtos</Link>
        <ChevronRight size={10} />
        <Link href={`/produtos/${product.id}`}>{product.name}</Link>
        <ChevronRight size={10} />
        <strong className="text-forest-700">Custo Real</strong>
      </nav>
      <header className="mt-5 flex items-start gap-4">
        <Link
          href={`/produtos/${product.id}`}
          className="rounded-xl border bg-white p-2"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
            SKU • {variant.sku}
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {product.name}{" "}
            {variant.packageWeightG === 1000
              ? "1 kg"
              : `${variant.packageWeightG} g`}
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Custo real calculado • agosto/2026 • memória auditável
          </p>
        </div>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={CircleDollarSign}
          label="Preço líquido"
          value={brl.format(32.9)}
        />
        <Metric
          icon={Factory}
          label="Custo industrial"
          value={brl.format(skuCostDemo.realIndustrialCost)}
        />
        <Metric
          icon={Scale}
          label="Custo absorvido"
          value={brl.format(skuCostDemo.absorbedCost)}
        />
        <Metric
          icon={ShieldCheck}
          label="Margem industrial"
          value={`${pct.format(skuCostDemo.industrialMarginPercent)}%`}
        />
      </section>
      <section className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">Composição do custo</h2>
              <p className="text-xs text-stone-500">
                Clique em cada componente para ver sua origem.
              </p>
            </div>
            <Badge tone="success">CALCULATED</Badge>
          </div>
          <div className="mt-5 space-y-2">
            {parts.map(([label, value, source]) => (
              <button
                key={label}
                onClick={() => setOpened(opened === label ? null : label)}
                className="w-full rounded-xl p-2 text-left hover:bg-stone-50"
              >
                <div className="flex items-center gap-3">
                  <span className="w-36 text-xs font-medium">{label}</span>
                  <div className="h-2 flex-1 rounded-full bg-stone-100">
                    <div
                      className="h-full rounded-full bg-forest-700"
                      style={{ width: `${(value / max) * 100}%` }}
                    />
                  </div>
                  <strong className="w-20 text-right text-xs">
                    {brl.format(value)}
                  </strong>
                  <ChevronDown
                    size={13}
                    className={`transition ${opened === label ? "rotate-180" : ""}`}
                  />
                </div>
                {opened === label && (
                  <div className="ml-36 mt-2 rounded-lg bg-forest-50 p-3 text-[10px] text-forest-900">
                    Origem: {source} → componente de custo → OP → SKU.
                    Identificador preservado no snapshot.
                  </div>
                )}
              </button>
            ))}
          </div>
          <div className="mt-5 border-t pt-4">
            <Total label="Custo direto" value={skuCostDemo.directCost} />
            <Total
              label="Custo industrial real"
              value={skuCostDemo.realIndustrialCost}
            />
            <Total label="Rateio corporativo" value={1.28} />
            <Total
              label="Custo total absorvido"
              value={skuCostDemo.absorbedCost}
              strong
            />
          </div>
        </Card>
        <div className="space-y-4">
          <Card className="p-5">
            <h2 className="text-sm font-bold">Margens gerenciais</h2>
            <div className="mt-4 space-y-3">
              <Margin
                label="Margem bruta"
                value={skuCostDemo.grossMarginPercent}
              />
              <Margin
                label="Margem industrial"
                value={skuCostDemo.industrialMarginPercent}
              />
              <Margin
                label="Margem de contribuição"
                value={skuCostDemo.contributionMarginPercent}
              />
              <Margin
                label="Margem após rateio"
                value={skuCostDemo.afterAllocationMarginPercent}
              />
            </div>
          </Card>
          <Card className="p-5">
            <h2 className="text-sm font-bold">Rastreabilidade</h2>
            <p className="mt-3 text-xs leading-5 text-stone-600">
              Margem → {product.name} → {variant.sku} → OP-2026-0112 →
              componentes → centros de custo → lançamentos.
            </p>
            <p className="mt-3 rounded-xl bg-stone-50 p-3 text-[10px] text-stone-500">
              Snapshot cost-engine-v2. Períodos CLOSED não são recalculados
              automaticamente.
            </p>
          </Card>
        </div>
      </section>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Scale;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <Icon size={15} className="text-forest-700" />
      <p className="mt-3 text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}
function Total({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div
      className={`flex justify-between py-1.5 text-xs ${strong ? "mt-2 border-t pt-3 font-bold" : ""}`}
    >
      <span>{label}</span>
      <span>{brl.format(value)}</span>
    </div>
  );
}
function Margin({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-stone-600">{label}</span>
        <strong>{pct.format(value)}%</strong>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-stone-100">
        <div
          className="h-full rounded-full bg-forest-700"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
