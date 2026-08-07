import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Factory,
  Warehouse,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import {
  getAllowedPresentations,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINE_META,
  PRODUCT_LINES,
  type ProductLine,
} from "@bbos/shared/product-presentation";
import { loadProductCatalog } from "@/lib/product-catalog-api";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
export default async function ProductLinePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const line = PRODUCT_LINES.find(
    (item) => PRODUCT_LINE_META[item].slug === slug,
  ) as ProductLine | undefined;
  if (!line) notFound();
  const { products: catalog } = await loadProductCatalog();
  const products = catalog.filter((item) => item.line === line);
  const sales = products
    .flatMap((item) => item.skus)
    .reduce((sum, sku) => sum + sku.salesAmount, 0);
  const stock = products
    .flatMap((item) => item.skus)
    .reduce((sum, sku) => sum + sku.stockUnits, 0);
  const production = products.reduce((sum, item) => sum + item.productionKg, 0);
  const margin = products.length
    ? products.reduce((sum, item) => sum + item.marginPercent, 0) /
      products.length
    : 0;
  return (
    <div className="mx-auto max-w-[1500px]">
      <nav className="flex items-center gap-1 text-[10px] text-stone-400">
        <Link href="/produtos">Produtos</Link>
        <ChevronRight size={10} />
        <strong className="text-forest-700">{PRODUCT_LINE_LABELS[line]}</strong>
      </nav>
      <header className="mt-5 flex items-start gap-4">
        <Link href="/produtos" className="rounded-xl border bg-white p-2">
          <ArrowLeft size={16} />
        </Link>
        <span className="grid size-11 place-items-center rounded-xl bg-forest-900 text-white">
          <Boxes size={20} />
        </span>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
            Linha oficial
          </p>
          <h1 className="mt-1 text-3xl font-bold">
            {PRODUCT_LINE_LABELS[line]}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            {PRODUCT_LINE_META[line].description}
          </p>
          <p className="mt-2 text-xs font-semibold text-forest-700">
            {PRODUCT_LINE_META[line].positioning}
          </p>
        </div>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          icon={CircleDollarSign}
          label="Vendas da linha"
          value={currency.format(sales)}
        />
        <Metric
          icon={CircleDollarSign}
          label="Margem"
          value={`${number.format(margin)}%`}
        />
        <Metric
          icon={Warehouse}
          label="Estoque"
          value={`${number.format(stock)} un.`}
        />
        <Metric
          icon={Factory}
          label="Produção"
          value={`${number.format(production)} kg`}
        />
      </section>
      <Card className="mt-5 p-5">
        <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
          Apresentações permitidas
        </p>
        <div className="mt-3 flex gap-2">
          {getAllowedPresentations(line).map((weight) => (
            <Badge key={weight} tone="neutral">
              {weight === 1000 ? "1 kg" : `${weight} g`}
            </Badge>
          ))}
        </div>
      </Card>
      <section className="mt-7">
        <h2 className="text-lg font-bold">Produtos associados</h2>
        {products.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <Link key={product.id} href={`/produtos/${product.id}`}>
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-base font-bold">{product.name}</h3>
                      <p className="mt-1 text-[10px] text-stone-500">
                        {product.skus.length} SKUs
                      </p>
                    </div>
                    <Badge tone="success">Ativo</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {product.skus.map((sku) => (
                      <span
                        key={sku.id}
                        className="rounded-lg bg-stone-100 px-3 py-2 text-[10px] font-bold"
                      >
                        {sku.packageWeightG === 1000
                          ? "1 kg"
                          : `${sku.packageWeightG} g`}
                      </span>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="mt-4 border-dashed p-10 text-center">
            <p className="text-sm font-semibold">
              Linha preparada para receber produtos
            </p>
            <p className="mt-2 text-xs text-stone-500">
              Nenhum produto cadastrado nesta linha.
            </p>
          </Card>
        )}
      </section>
    </div>
  );
}
function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Boxes;
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
