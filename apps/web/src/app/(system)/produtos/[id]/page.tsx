import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronRight,
  CircleDollarSign,
  Factory,
  PackageCheck,
  Warehouse,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import {
  PRODUCT_LINE_LABELS,
  PRODUCT_LINE_META,
} from "@bbos/shared/product-presentation";
import { loadProduct } from "@/lib/product-catalog-api";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const product = await loadProduct(id);
  if (!product) notFound();
  return (
    <div className="mx-auto max-w-[1500px]">
      <nav className="flex items-center gap-1 text-[10px] text-stone-400">
        <Link href="/produtos">Produtos</Link>
        <ChevronRight size={10} />
        <Link href={`/produtos/linhas/${PRODUCT_LINE_META[product.line].slug}`}>
          {PRODUCT_LINE_LABELS[product.line]}
        </Link>
        <ChevronRight size={10} />
        <strong className="text-forest-700">{product.name}</strong>
      </nav>
      <header className="mt-5 flex items-start gap-4">
        <Link
          href={`/produtos/linhas/${PRODUCT_LINE_META[product.line].slug}`}
          className="rounded-xl border bg-white p-2"
        >
          <ArrowLeft size={16} />
        </Link>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
            {PRODUCT_LINE_LABELS[product.line]}
          </p>
          <h1 className="mt-1 text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-sm text-stone-500">
            Produto oficial do catálogo Bispo Coffees.
          </p>
        </div>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Metric
          icon={CircleDollarSign}
          label="Vendas"
          value={currency.format(
            product.skus.reduce((s, v) => s + v.salesAmount, 0),
          )}
        />
        <Metric
          icon={Warehouse}
          label="Estoque"
          value={`${number.format(product.skus.reduce((s, v) => s + v.stockUnits, 0))} un.`}
        />
        <Metric
          icon={CircleDollarSign}
          label="Margem"
          value={`${number.format(product.marginPercent)}%`}
        />
        <Metric icon={CircleDollarSign} label="Custo médio" value="R$ 24,80" />
        <Metric
          icon={Factory}
          label="Produção"
          value={`${number.format(product.productionKg)} kg`}
        />
      </section>
      <section className="mt-7">
        <div className="flex justify-between">
          <h2 className="text-lg font-bold">SKUs / Apresentações</h2>
          <Badge tone={product.active ? "success" : "neutral"}>
            {product.active ? "Ativo" : "Inativo"}
          </Badge>
        </div>
        <div className="mt-4 grid gap-4 xl:grid-cols-2">
          {product.skus.map((sku, index) => {
            const unitCost = 18.4 + index * 8.2;
            const price = unitCost / (1 - product.marginPercent / 100);
            return (
              <Card key={sku.id} className="p-5">
                <div className="flex justify-between">
                  <div className="flex gap-3">
                    <span className="grid size-9 place-items-center rounded-xl bg-forest-50 text-forest-700">
                      <PackageCheck size={16} />
                    </span>
                    <div>
                      <h3 className="text-sm font-bold">
                        {product.name}{" "}
                        {sku.packageWeightG === 1000
                          ? "1 kg"
                          : `${sku.packageWeightG} g`}
                      </h3>
                      <p className="mt-1 text-[10px] text-stone-500">
                        {sku.sku} • unidade {sku.commercialUnit}
                      </p>
                    </div>
                  </div>
                  <Badge tone="success">Ativo</Badge>
                </div>
                <div className="mt-5 grid grid-cols-3 gap-3 text-[10px] text-stone-500">
                  <span>
                    Custo
                    <br />
                    <strong className="text-xs text-stone-900">
                      {currency.format(unitCost)}
                    </strong>
                  </span>
                  <span>
                    Preço
                    <br />
                    <strong className="text-xs text-stone-900">
                      {currency.format(price)}
                    </strong>
                  </span>
                  <span>
                    Estoque
                    <br />
                    <strong className="text-xs text-stone-900">
                      {sku.stockUnits} un.
                    </strong>
                  </span>
                  <span>
                    Vendas
                    <br />
                    <strong className="text-xs text-stone-900">
                      {currency.format(sku.salesAmount)}
                    </strong>
                  </span>
                  <span>
                    Margem
                    <br />
                    <strong className="text-xs text-stone-900">
                      {number.format(product.marginPercent)}%
                    </strong>
                  </span>
                  <span>
                    Peso
                    <br />
                    <strong className="text-xs text-stone-900">
                      {sku.packageWeightG} g
                    </strong>
                  </span>
                </div>
                <Link
                  href={`/produtos/${product.id}/custos/${encodeURIComponent(sku.sku)}`}
                  className="mt-4 inline-flex items-center gap-1 text-[10px] font-bold text-forest-700 hover:text-forest-900"
                >
                  Ver custo real e memória <ChevronRight size={12} />
                </Link>
              </Card>
            );
          })}
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
  icon: typeof Warehouse;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <Icon size={15} className="text-forest-700" />
      <p className="mt-3 text-[10px] text-stone-500">{label}</p>
      <p className="mt-1 text-lg font-bold">{value}</p>
    </Card>
  );
}
