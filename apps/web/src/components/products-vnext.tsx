"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, PackageCheck, Plus, ShieldCheck, Sparkles, Tags } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import type { CatalogProduct } from "@bbos/shared/product-presentation";

const api = getApiBaseUrl();
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });
const PROFILE_COUNT = 9;

type PriceRow = {
  id: string;
  productVariantId: string;
  salesChannelId: string;
  channelCode: string;
  channelName: string;
  currency: string;
  price: string | number;
  active: boolean;
};

type CostProduct = {
  productVariantId: string;
  sku: string;
  product: string;
  line: string;
  presentationGrams: number;
  status: string;
  industrialCost: number;
  costPerUnit: number;
  costPerKg: number;
};

type CostSummary = { products?: CostProduct[] };

type VariantInsight = {
  cost?: CostProduct;
  activePrices: PriceRow[];
};

const lineMeta: Record<string, { label: string; eyebrow: string; soft: string; strong: string }> = {
  GOURMET: { label: "Gourmet", eyebrow: "Cotidiano", soft: "bg-emerald-50", strong: "text-emerald-700" },
  CLASSICOS: { label: "Clássicos", eyebrow: "Consistência", soft: "bg-sky-50", strong: "text-sky-700" },
  EPICOS: { label: "Épicos", eyebrow: "Experiência", soft: "bg-amber-50", strong: "text-amber-700" },
  RAROS: { label: "Raros", eyebrow: "Exclusividade", soft: "bg-violet-50", strong: "text-violet-700" },
};

export function ProductsVNext() {
  const [catalog, setCatalog] = React.useState<CatalogProduct[]>([]);
  const [prices, setPrices] = React.useState<PriceRow[]>([]);
  const [costs, setCosts] = React.useState<CostProduct[]>([]);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${api}/products`, { credentials: "include", cache: "no-store", signal: controller.signal }),
      fetch(`${api}/commerce/prices`, { credentials: "include", cache: "no-store", signal: controller.signal }),
      fetch(`${api}/costing/summary`, { credentials: "include", cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([productsResponse, pricesResponse, costsResponse]) => {
        if (!productsResponse.ok) throw new Error("products");
        setCatalog(await productsResponse.json());
        setPrices(pricesResponse.ok ? await pricesResponse.json() : []);
        const summary: CostSummary = costsResponse.ok ? await costsResponse.json() : {};
        setCosts(summary.products ?? []);
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const activeVariants = catalog.flatMap((product) => product.skus.filter((sku) => sku.active));
  const variantsWithCost = activeVariants.filter((sku) => costs.some((cost) => cost.productVariantId === sku.id && cost.status === "CALCULATED")).length;
  const variantsWithPrice = activeVariants.filter((sku) => prices.some((price) => price.productVariantId === sku.id && price.active)).length;

  const insightFor = (variantId: string): VariantInsight => ({
    cost: costs.find((cost) => cost.productVariantId === variantId),
    activePrices: prices.filter((price) => price.productVariantId === variantId && price.active),
  });

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--vnext-green)]"><PackageCheck size={13}/> Cadastro mestre</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--vnext-text-2)]">Uma única verdade para SKU, custo, preço, produção, estoque e pedido.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/commerce/precos" className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-bold text-[var(--vnext-text)]"><Tags size={14}/> Matriz de preços</Link>
          <Link href="/produtos?novo=1" className="inline-flex items-center gap-2 rounded-xl bg-[#10211D] px-4 py-3 text-xs font-bold text-white"><Plus size={14}/> Novo produto</Link>
        </div>
      </header>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Produtos ativos" value={String(catalog.filter((product) => product.active).length)} detail="Catálogo operacional" icon={PackageCheck} />
        <Kpi label="SKUs ativos" value={String(activeVariants.length)} detail="Apresentações disponíveis" icon={ShieldCheck} />
        <Kpi label="Com custo calculado" value={`${variantsWithCost}/${activeVariants.length || 0}`} detail="Custo auditável por SKU" icon={CircleDollarSign} tone="blue" />
        <Kpi label="Com preço vigente" value={`${variantsWithPrice}/${activeVariants.length || 0}`} detail="Ao menos um perfil comercial" icon={Tags} tone="violet" />
      </section>

      {status === "error" && <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">Não foi possível consolidar o cadastro mestre agora. O BBOS não exibirá números estimados.</div>}

      <section className="mt-6 space-y-5">
        {Object.keys(lineMeta).map((line) => {
          const products = catalog.filter((product) => product.line === line && product.active);
          if (!products.length) return null;
          const meta = lineMeta[line];
          return (
            <div key={line} className="overflow-hidden rounded-[20px] border border-[var(--vnext-border)] bg-white/95 shadow-[var(--vnext-shadow-card)]">
              <div className="flex items-center justify-between border-b border-[var(--vnext-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span className={`grid size-9 place-items-center rounded-xl ${meta.soft} ${meta.strong}`}><Sparkles size={16}/></span>
                  <div><p className={`text-[9px] font-extrabold uppercase tracking-[.14em] ${meta.strong}`}>{meta.eyebrow}</p><h2 className="mt-0.5 text-lg font-bold">{meta.label}</h2></div>
                </div>
                <Badge tone="neutral">{products.length} produto{products.length === 1 ? "" : "s"}</Badge>
              </div>

              <div className="divide-y divide-[var(--vnext-border)]">
                {products.map((product) => (
                  <div key={product.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div><h3 className="text-base font-bold">{product.name}</h3><p className="mt-1 text-[10px] text-[var(--vnext-text-3)]">{product.skus.length} apresentação{product.skus.length === 1 ? "" : "ões"}</p></div>
                      <Link href={`/produtos/${product.id}`} className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--vnext-green)]">Abrir ficha <ArrowRight size={12}/></Link>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {product.skus.filter((sku) => sku.active).map((sku) => {
                        const insight = insightFor(sku.id);
                        const cost = insight.cost;
                        const coverage = new Set(insight.activePrices.map((price) => price.channelCode)).size;
                        const calculated = cost?.status === "CALCULATED";
                        return (
                          <div key={sku.id} className="grid gap-3 rounded-2xl bg-[var(--vnext-bg-soft)] px-4 py-3 md:grid-cols-[1.5fr_.8fr_.9fr_.9fr_auto] md:items-center">
                            <div><p className="text-sm font-bold">{formatWeight(sku.packageWeightG)}</p><p className="mt-0.5 text-[10px] text-[var(--vnext-text-3)]">{sku.sku}</p></div>
                            <div><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">Custo/un.</p><p className="mt-1 text-xs font-bold">{calculated ? money.format(cost!.costPerUnit) : "Aguardando cálculo"}</p></div>
                            <div><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">Custo/kg</p><p className="mt-1 text-xs font-bold">{calculated ? money.format(cost!.costPerKg) : "—"}</p></div>
                            <div><p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">Perfis com preço</p><p className="mt-1 text-xs font-bold">{coverage}/{PROFILE_COUNT}</p></div>
                            <Badge tone={calculated && coverage > 0 ? "success" : "warning"}>{calculated && coverage > 0 ? "Pronto para vender" : !calculated ? "Custo pendente" : "Preço incompleto"}</Badge>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {status === "loading" && <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-[var(--vnext-text-3)]">Consolidando catálogo, custos e preços…</div>}
    </div>
  );
}

function Kpi({ label, value, detail, icon: Icon, tone = "green" }: { label: string; value: string; detail: string; icon: typeof PackageCheck; tone?: "green" | "blue" | "violet" }) {
  const classes = tone === "blue" ? "bg-blue-50 text-blue-700" : tone === "violet" ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700";
  return <Card className="p-4"><span className={`grid size-8 place-items-center rounded-xl ${classes}`}><Icon size={14}/></span><p className="mt-3 text-[10px] font-semibold text-[var(--vnext-text-2)]">{label}</p><p className="mt-1 text-2xl font-bold tracking-tight">{value}</p><p className="mt-1 text-[10px] text-[var(--vnext-text-3)]">{detail}</p></Card>;
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}
