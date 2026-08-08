"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  Boxes,
  ChevronRight,
  CircleDollarSign,
  Factory,
  PackageCheck,
  Plus,
  Warehouse,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import {
  assertCatalogSkuAvailable,
  getAllowedPresentations,
  PRODUCT_CATALOG_DEMO,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINE_META,
  PRODUCT_LINES,
  validateCreateProductSku,
  type CatalogProduct,
  type ProductLine,
} from "@bbos/shared/product-presentation";
import {
  loadProductCatalog,
  PRODUCTS_API_URL,
} from "@/lib/product-catalog-api";

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const lineTone: Record<ProductLine, string> = {
  RAROS: "bg-[#eef2eb] text-forest-800",
  EPICOS: "bg-[#f4eee7] text-coffee-700",
  CLASSICOS: "bg-[#F0F0ED] text-[#4d7b82]",
  GOURMET: "bg-stone-100 text-stone-700",
};

export default function ProductsPage() {
  const [catalog, setCatalog] =
    useState<CatalogProduct[]>(PRODUCT_CATALOG_DEMO);
  const [catalogSource, setCatalogSource] = useState<
    "loading" | "database" | "compatibility"
  >("loading");
  const [line, setLine] = useState<ProductLine | null>(null);
  const [selected, setSelected] = useState<CatalogProduct | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    line: "CLASSICOS" as ProductLine,
    productName: "",
    packageWeightG: 500,
    sku: "",
    commercialUnit: "UN" as "UN" | "KG",
    active: true,
  });
  const [error, setError] = useState("");
  const products = useMemo(
    () => (line ? catalog.filter((item) => item.line === line) : []),
    [catalog, line],
  );
  useEffect(() => {
    void loadProductCatalog().then(({ products: persisted, source }) => {
      setCatalog(persisted);
      setCatalogSource(source);
    });
  }, []);
  const submit = async () => {
    try {
      setError("");
      validateCreateProductSku(form);
      assertCatalogSkuAvailable(catalog, form);
      const response = await fetch(PRODUCTS_API_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!response.ok)
        throw new Error(
          (await response.json()).message ??
            "Não foi possível criar o produto.",
        );
      const created = (await response.json()) as CatalogProduct;
      setCatalog((current) => [
        ...current.filter((item) => item.id !== created.id),
        created,
      ]);
      setLine(created.line);
      setCreating(false);
      setSelected(created);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Dados inválidos.");
    }
  };
  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Catálogo oficial
          </p>
          <h1 className="mt-1 text-3xl font-bold">Produtos</h1>
          <p className="mt-2 text-sm text-stone-500">
            Catálogo oficial Bispo Coffees
          </p>
          {catalogSource === "compatibility" && (
            <p className="mt-2 text-[10px] font-semibold text-amber-700">
              API persistente indisponível • exibindo adaptador de
              compatibilidade
            </p>
          )}
        </div>
        <button
          onClick={() => setCreating(true)}
          className="flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white"
        >
          <Plus size={15} />
          Novo produto
        </button>
      </header>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <CatalogKpi label="Linhas ativas" value="4" />
        <CatalogKpi
          label="Produtos ativos"
          value={String(catalog.filter((item) => item.active).length)}
        />
        <CatalogKpi
          label="SKUs ativos"
          value={String(
            catalog.flatMap((item) => item.skus).filter((sku) => sku.active)
              .length,
          )}
        />
        <CatalogKpi
          label="Produtos sem estoque"
          value={String(
            catalog.filter((item) =>
              item.skus.every((sku) => sku.stockUnits === 0),
            ).length,
          )}
          tone="danger"
        />
        <CatalogKpi label="Produtos em atenção" value="1" tone="warning" />
      </section>
      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {PRODUCT_LINES.map((item) => {
          const items = catalog.filter((product) => product.line === item);
          const skuCount = items.reduce(
            (sum, product) => sum + product.skus.length,
            0,
          );
          return (
            <Link
              key={item}
              href={`/produtos/linhas/${PRODUCT_LINE_META[item].slug}`}
              className="text-left"
            >
              <Card
                className={`h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg ${line === item ? "border-forest-700 ring-1 ring-forest-700" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`grid size-10 place-items-center rounded-xl ${lineTone[item]}`}
                  >
                    <Boxes size={18} />
                  </span>
                  <ChevronRight size={15} className="text-stone-300" />
                </div>
                <h2 className="mt-5 text-lg font-bold">
                  {PRODUCT_LINE_LABELS[item]}
                </h2>
                <p className="mt-2 text-xs text-stone-500">
                  {PRODUCT_LINE_META[item].positioning}
                </p>
                <p className="mt-2 text-[10px] text-stone-400">
                  {getAllowedPresentations(item)
                    .map((weight) => (weight === 1000 ? "1 kg" : `${weight} g`))
                    .join(" • ")}
                </p>
                <p className="mt-4 text-[10px] text-stone-400">
                  {items.length} produtos • {skuCount} SKUs
                </p>
                <Badge tone="success">Ativa</Badge>
              </Card>
            </Link>
          );
        })}
      </section>
      {line && (
        <section className="mt-8">
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
                {PRODUCT_LINE_LABELS[line]}
              </p>
              <h2 className="mt-1 text-xl font-bold">Produtos da linha</h2>
            </div>
            <Badge tone="neutral">{products.length} produtos</Badge>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {products.map((product) => (
              <button
                key={product.id}
                onClick={() => setSelected(product)}
                className="text-left"
              >
                <Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                  <div className="flex justify-between">
                    <div>
                      <h3 className="text-base font-bold">{product.name}</h3>
                      <p className="mt-1 text-[10px] text-stone-500">
                        {product.skus.length} apresentações
                      </p>
                    </div>
                    <Badge tone={product.active ? "success" : "neutral"}>
                      {product.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    {product.skus.map((sku) => (
                      <span
                        key={sku.id}
                        className="rounded-lg bg-stone-100 px-3 py-2 text-[10px] font-bold"
                      >
                        {sku.packageWeightG === 1000
                          ? "1 kg"
                          : `${sku.packageWeightG} g`}{" "}
                        • {sku.sku}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-[9px] text-stone-500">
                    <span>
                      Vendas
                      <br />
                      <strong className="text-xs text-stone-900">
                        {currency.format(
                          product.skus.reduce(
                            (sum, sku) => sum + sku.salesAmount,
                            0,
                          ),
                        )}
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
                      Produção
                      <br />
                      <strong className="text-xs text-stone-900">
                        {number.format(product.productionKg)} kg
                      </strong>
                    </span>
                  </div>
                </Card>
              </button>
            ))}
          </div>
        </section>
      )}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Fechar"
            className="absolute inset-0 bg-forest-950/25"
            onClick={() => setSelected(null)}
          />
          <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
                  {PRODUCT_LINE_LABELS[selected.line]}
                </p>
                <h2 className="mt-2 text-2xl font-bold">{selected.name}</h2>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="rounded-xl border p-2"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat
                icon={CircleDollarSign}
                label="Vendas"
                value={currency.format(
                  selected.skus.reduce((sum, sku) => sum + sku.salesAmount, 0),
                )}
              />
              <Stat
                icon={Warehouse}
                label="Estoque"
                value={`${number.format(selected.skus.reduce((sum, sku) => sum + sku.stockUnits, 0))} un.`}
              />
              <Stat
                icon={CircleDollarSign}
                label="Margem"
                value={`${number.format(selected.marginPercent)}%`}
              />
              <Stat
                icon={Factory}
                label="Produção"
                value={`${number.format(selected.productionKg)} kg`}
              />
            </div>
            <h3 className="mt-8 text-sm font-bold">Apresentações / SKUs</h3>
            <div className="mt-3 space-y-3">
              {selected.skus.map((sku) => (
                <Card key={sku.id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <PackageCheck size={16} className="text-forest-700" />
                      <div>
                        <p className="text-sm font-bold">
                          {selected.name}{" "}
                          {sku.packageWeightG === 1000
                            ? "1 kg"
                            : `${sku.packageWeightG} g`}
                        </p>
                        <p className="mt-1 text-[10px] text-stone-500">
                          {sku.sku} • unidade {sku.commercialUnit}
                        </p>
                      </div>
                    </div>
                    <Badge tone={sku.active ? "success" : "neutral"}>
                      {sku.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </div>
                </Card>
              ))}
            </div>
          </aside>
        </div>
      )}
      {creating && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            aria-label="Fechar"
            className="absolute inset-0 bg-forest-950/25"
            onClick={() => setCreating(false)}
          />
          <aside className="relative h-full w-full max-w-lg overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-forest-700">
                  Catálogo
                </p>
                <h2 className="mt-2 text-xl font-bold">Novo produto / SKU</h2>
              </div>
              <button
                onClick={() => setCreating(false)}
                className="rounded-xl border p-2"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-7 space-y-5">
              <Field label="1. Linha">
                <select
                  value={form.line}
                  onChange={(e) => {
                    const next = e.target.value as ProductLine;
                    setForm({
                      ...form,
                      line: next,
                      packageWeightG: getAllowedPresentations(next)[0]!,
                    });
                  }}
                >
                  <>
                    {PRODUCT_LINES.map((item) => (
                      <option key={item} value={item}>
                        {PRODUCT_LINE_LABELS[item]}
                      </option>
                    ))}
                  </>
                </select>
              </Field>
              <Field label="2. Produto">
                <input
                  value={form.productName}
                  onChange={(e) =>
                    setForm({ ...form, productName: e.target.value })
                  }
                  placeholder="Ex.: Caramelo"
                />
              </Field>
              <Field label="3. Apresentação">
                <div className="flex gap-2">
                  {getAllowedPresentations(form.line).map((weight) => (
                    <button
                      key={weight}
                      onClick={() =>
                        setForm({ ...form, packageWeightG: weight })
                      }
                      className={`rounded-xl border px-4 py-3 text-xs font-bold ${form.packageWeightG === weight ? "border-forest-700 bg-forest-50 text-forest-800" : ""}`}
                    >
                      {weight === 1000 ? "1 kg" : `${weight} g`}
                    </button>
                  ))}
                </div>
              </Field>
              <Field label="4. SKU">
                <input
                  value={form.sku}
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                  placeholder="Ex.: CLA-CAR-500"
                />
              </Field>
              <Field label="5. Unidade comercial">
                <select
                  value={form.commercialUnit}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      commercialUnit: e.target.value as "UN" | "KG",
                    })
                  }
                >
                  <option value="UN">Unidade</option>
                  <option value="KG">Quilograma</option>
                </select>
              </Field>
              <label className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                6. Produto ativo
              </label>
              {error && (
                <p className="rounded-xl bg-red-50 p-3 text-xs text-red-700">
                  {error}
                </p>
              )}
              <button
                onClick={submit}
                className="w-full rounded-xl bg-forest-900 px-4 py-3 text-sm font-bold text-white"
              >
                Criar produto e SKU
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Factory;
  label: string;
  value: string;
}) {
  return (
    <Card className="p-4">
      <Icon size={15} className="text-forest-700" />
      <p className="mt-3 text-[9px] text-stone-500">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </Card>
  );
}
function CatalogKpi({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: string;
  tone?: "neutral" | "warning" | "danger";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-stone-700">{label}</p>
        {tone !== "neutral" && (
          <i
            className={`size-2 rounded-full ${tone === "danger" ? "bg-red-500" : "bg-amber-500"}`}
          />
        )}
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
    </Card>
  );
}
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-semibold text-stone-700">
      <span>{label}</span>
      <div className="mt-2 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:p-3 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:p-3">
        {children}
      </div>
    </label>
  );
}
