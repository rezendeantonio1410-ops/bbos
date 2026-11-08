"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Boxes,
  CircleDollarSign,
  Flame,
  PackageCheck,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Tags,
  X,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import {
  getAllowedPresentations,
  PRODUCT_LINE_LABELS,
  ROASTED_PRODUCT_LINES,
  type CatalogProduct,
  type CreateCatalogProductInput,
  type ProductLine,
} from "@bbos/shared/product-presentation";

const api = getApiBaseUrl();
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
});
const kilograms = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 3,
});
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

type RoastedStockLine = {
  lineCode: string;
  lineName: string;
  physicalKg: number;
  reservedKg: number;
  availableKg: number;
  lotCount: number;
};

const INITIAL_PRODUCT: CreateCatalogProductInput = {
  line: "GOURMET",
  productName: "",
  description: "",
  commercialKind: "STANDARD",
  baseCoffeeProductId: undefined,
  sku: "",
  packageWeightG: 500,
  commercialUnit: "UN",
  active: true,
  grossWeightG: 530,
  packageWidthCm: 15,
  packageHeightCm: 24,
  packageDepthCm: 8,
  retailPrice: 52,
  maxDiscountPercent: 0,
  gtin: "",
  ncm: "09012100",
  originCode: 0,
  cest: "",
  productionType: "P",
  fiscalValidated: false,
};

const lineMeta: Record<
  string,
  { label: string; eyebrow: string; soft: string; strong: string }
> = {
  GREEN_COFFEE: {
    label: "Café Verde",
    eyebrow: "Matéria-prima",
    soft: "bg-lime-50",
    strong: "text-lime-800",
  },
  GOURMET: {
    label: "Gourmet",
    eyebrow: "Cotidiano",
    soft: "bg-emerald-50",
    strong: "text-emerald-700",
  },
  CLASSICOS: {
    label: "Clássicos",
    eyebrow: "Consistência",
    soft: "bg-sky-50",
    strong: "text-sky-700",
  },
  EPICOS: {
    label: "Épicos",
    eyebrow: "Experiência",
    soft: "bg-amber-50",
    strong: "text-amber-700",
  },
  RAROS: {
    label: "Raros",
    eyebrow: "Exclusividade",
    soft: "bg-violet-50",
    strong: "text-violet-700",
  },
};

export function ProductsVNext() {
  const [catalog, setCatalog] = React.useState<CatalogProduct[]>([]);
  const [prices, setPrices] = React.useState<PriceRow[]>([]);
  const [costs, setCosts] = React.useState<CostProduct[]>([]);
  const [roastedStock, setRoastedStock] = React.useState<RoastedStockLine[]>(
    [],
  );
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [createOpen, setCreateOpen] = React.useState(false);
  const [createStatus, setCreateStatus] = React.useState<"idle" | "saving">(
    "idle",
  );
  const [createError, setCreateError] = React.useState("");
  const [createdMessage, setCreatedMessage] = React.useState("");
  const [mappingProduct, setMappingProduct] =
    React.useState<CatalogProduct | null>(null);
  const [mappingBaseId, setMappingBaseId] = React.useState("");
  const [mappingBusy, setMappingBusy] = React.useState(false);
  const [mappingError, setMappingError] = React.useState("");
  const [ncmSource, setNcmSource] = React.useState<
    "HISTORY" | "OFFICIAL_REFERENCE"
  >("OFFICIAL_REFERENCE");
  const [newProduct, setNewProduct] =
    React.useState<CreateCatalogProductInput>(INITIAL_PRODUCT);
  const productNameRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`${api}/products`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`${api}/commerce/prices`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`${api}/costing/summary`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }),
      fetch(`${api}/operations-flow/roasted-stock-by-line`, {
        credentials: "include",
        cache: "no-store",
        signal: controller.signal,
      }),
    ])
      .then(
        async ([
          productsResponse,
          pricesResponse,
          costsResponse,
          roastedStockResponse,
        ]) => {
          if (!productsResponse.ok) throw new Error("products");
          setCatalog(await productsResponse.json());
          setPrices(pricesResponse.ok ? await pricesResponse.json() : []);
          const summary: CostSummary = costsResponse.ok
            ? await costsResponse.json()
            : {};
          setCosts(summary.products ?? []);
          setRoastedStock(
            roastedStockResponse.ok ? await roastedStockResponse.json() : [],
          );
          setStatus("ready");
        },
      )
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    if (!createOpen) return;
    productNameRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && createStatus !== "saving")
        setCreateOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [createOpen, createStatus]);

  const isGreenCoffee = newProduct.line === "GREEN_COFFEE";
  const isWhiteLabel = newProduct.commercialKind === "WHITE_LABEL";
  const baseCoffeeProducts = catalog.filter(
    (product) =>
      product.active &&
      product.line === newProduct.line &&
      product.commercialKind === "STANDARD",
  );
  React.useEffect(() => {
    if (!createOpen) return;
    const controller = new AbortController();
    const kind = isGreenCoffee ? "GREEN" : "ROASTED";
    void fetch(`${api}/products/ncm-suggestion?kind=${kind}`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("ncm");
        return response.json() as Promise<{
          ncm: string;
          source: "HISTORY" | "OFFICIAL_REFERENCE";
        }>;
      })
      .then((suggestion) => {
        setNcmSource(suggestion.source);
        setNewProduct((current) => ({
          ...current,
          ncm: suggestion.ncm,
          fiscalValidated: false,
        }));
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setNcmSource("OFFICIAL_REFERENCE");
      });
    return () => controller.abort();
  }, [createOpen, isGreenCoffee]);

  const activeVariants = catalog.flatMap((product) =>
    product.skus.filter((sku) => sku.active),
  );
  const variantsWithCost = activeVariants.filter((sku) =>
    costs.some(
      (cost) =>
        cost.productVariantId === sku.id && cost.status === "CALCULATED",
    ),
  ).length;
  const variantsWithPrice = activeVariants.filter((sku) =>
    prices.some((price) => price.productVariantId === sku.id && price.active),
  ).length;

  const openCreateProduct = () => {
    setNewProduct(INITIAL_PRODUCT);
    setCreateError("");
    setCreatedMessage("");
    setCreateOpen(true);
  };

  const closeCreateProduct = () => {
    if (createStatus === "saving") return;
    setCreateOpen(false);
    setCreateError("");
  };

  const changeLine = (line: ProductLine) => {
    const packageWeightG = getAllowedPresentations(line)[0]!;
    setNewProduct((current) => ({
      ...current,
      line,
      baseCoffeeProductId: undefined,
      packageWeightG,
      grossWeightG: Math.max(current.grossWeightG, packageWeightG),
      fiscalValidated: false,
    }));
  };

  const changeCoffeeKind = (kind: "ROASTED" | "GREEN") => {
    if (kind === "GREEN") {
      setNewProduct((current) => ({
        ...current,
        line: "GREEN_COFFEE",
        commercialKind: "STANDARD",
        baseCoffeeProductId: undefined,
        packageWeightG: 30000,
        grossWeightG: 30500,
        packageWidthCm: 40,
        packageHeightCm: 70,
        packageDepthCm: 15,
        commercialUnit: "UN",
        ncm: "09011110",
        fiscalValidated: false,
      }));
      return;
    }
    setNewProduct((current) => ({
      ...current,
      line: "GOURMET",
      commercialKind: "STANDARD",
      baseCoffeeProductId: undefined,
      packageWeightG: 500,
      grossWeightG: 530,
      packageWidthCm: 15,
      packageHeightCm: 24,
      packageDepthCm: 8,
      commercialUnit: "UN",
      ncm: "09012100",
      fiscalValidated: false,
    }));
  };

  const submitNewProduct = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreateStatus("saving");
    setCreateError("");
    try {
      const response = await fetch(`${api}/products`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      });
      if (!response.ok) throw new Error(await productRequestError(response));
      const created = (await response.json()) as CatalogProduct;
      setCatalog((current) => {
        const existing = current.findIndex(
          (product) => product.id === created.id,
        );
        if (existing === -1) return [...current, created];
        return current.map((product) =>
          product.id === created.id ? created : product,
        );
      });
      const createdVariant = created.skus.find(
        (item) => item.sku === newProduct.sku.trim().toLocaleUpperCase("pt-BR"),
      );
      if (createdVariant) {
        const priceResponse = await fetch(
          `${api}/commerce/prices?productVariantId=${encodeURIComponent(createdVariant.id)}`,
          { credentials: "include", cache: "no-store" },
        );
        if (priceResponse.ok) {
          const nextPrices = (await priceResponse.json()) as PriceRow[];
          setPrices((current) => [
            ...current.filter(
              (item) => item.productVariantId !== createdVariant.id,
            ),
            ...nextPrices,
          ]);
        }
      }
      setCreatedMessage(
        `${created.name} foi cadastrado. ${createdVariant?.blingSync?.label ?? "A sincronização com o Bling será acompanhada pelo BBOS."}`,
      );
      setCreateOpen(false);
      setNewProduct(INITIAL_PRODUCT);
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "Não foi possível cadastrar o produto.",
      );
    } finally {
      setCreateStatus("idle");
    }
  };

  const openWhiteLabelMapping = (product: CatalogProduct) => {
    setMappingProduct(product);
    setMappingBaseId(product.baseCoffeeProductId ?? "");
    setMappingError("");
  };

  const saveWhiteLabelMapping = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!mappingProduct || !mappingBaseId) return;
    setMappingBusy(true);
    setMappingError("");
    try {
      const response = await fetch(`${api}/products/${mappingProduct.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commercialKind: "WHITE_LABEL",
          baseCoffeeProductId: mappingBaseId,
        }),
      });
      if (!response.ok) throw new Error(await productRequestError(response));
      const updated = (await response.json()) as CatalogProduct;
      setCatalog((current) =>
        current.map((product) =>
          product.id === updated.id ? updated : product,
        ),
      );
      setCreatedMessage(
        `${updated.name} foi enquadrado em ${PRODUCT_LINE_LABELS[updated.line]} · ${updated.baseCoffeeProductName}.`,
      );
      setMappingProduct(null);
      setMappingBaseId("");
    } catch (cause) {
      setMappingError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enquadrar o White Label.",
      );
    } finally {
      setMappingBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--vnext-green)]">
            <PackageCheck size={13} /> Cadastro mestre
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Produtos</h1>
          <p className="mt-2 max-w-3xl text-sm text-[var(--vnext-text-2)]">
            Uma única verdade para SKU, custo, preço, produção, estoque e
            pedido.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/commerce/precos"
            className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-bold text-[var(--vnext-text)]"
          >
            <Tags size={14} /> Matriz de preços
          </Link>
          <button
            type="button"
            onClick={openCreateProduct}
            aria-haspopup="dialog"
            className="inline-flex items-center gap-2 rounded-xl bg-[#10211D] px-4 py-3 text-xs font-bold text-white"
          >
            <Plus size={14} /> Novo produto
          </button>
        </div>
      </header>

      <div aria-live="polite">
        {createdMessage && (
          <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
            <span>{createdMessage}</span>
            <button
              type="button"
              onClick={() => setCreatedMessage("")}
              className="rounded-lg p-1"
              aria-label="Fechar aviso"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Produtos ativos"
          value={String(catalog.filter((product) => product.active).length)}
          detail="Catálogo operacional"
          icon={PackageCheck}
        />
        <Kpi
          label="SKUs ativos"
          value={String(activeVariants.length)}
          detail="Apresentações disponíveis"
          icon={ShieldCheck}
        />
        <Kpi
          label="Com custo calculado"
          value={`${variantsWithCost}/${activeVariants.length || 0}`}
          detail="Custo auditável por SKU"
          icon={CircleDollarSign}
          tone="blue"
        />
        <Kpi
          label="Com preço vigente"
          value={`${variantsWithPrice}/${activeVariants.length || 0}`}
          detail="Ao menos um perfil comercial"
          icon={Tags}
          tone="violet"
        />
      </section>

      <section className="mt-6 overflow-hidden rounded-[20px] border border-[var(--vnext-border)] bg-white/95 shadow-[var(--vnext-shadow-card)]">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--vnext-border)] px-5 py-4">
          <div>
            <p className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[.14em] text-[var(--vnext-green)]">
              <Flame size={13} /> Café torrado a granel
            </p>
            <h2 className="mt-1 text-lg font-bold">Estoque por linha</h2>
            <p className="mt-1 text-xs text-[var(--vnext-text-3)]">
              Saldo em kg; a apresentação é definida somente pelo pedido.
            </p>
          </div>
          <Link
            href="/estoque#cafe-torrado"
            className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--vnext-green)]"
          >
            Ver perfis e lotes <ArrowRight size={12} />
          </Link>
        </div>
        {roastedStock.length ? (
          <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {roastedStock.map((line) => (
              <div
                key={line.lineCode}
                className="rounded-2xl bg-[var(--vnext-bg-soft)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">
                      Linha
                    </p>
                    <h3 className="mt-1 text-sm font-bold">{line.lineName}</h3>
                  </div>
                  <Badge tone="neutral">
                    {line.lotCount} {line.lotCount === 1 ? "lote" : "lotes"}
                  </Badge>
                </div>
                <p className="mt-4 text-2xl font-bold tracking-tight text-[var(--vnext-green)]">
                  {kilograms.format(line.availableKg)} kg
                </p>
                <p className="mt-0.5 text-[10px] text-[var(--vnext-text-3)]">
                  livres para novos pedidos
                </p>
                <div className="mt-3 flex gap-4 border-t border-[var(--vnext-border)] pt-3 text-[10px]">
                  <span>
                    Físico{" "}
                    <strong>{kilograms.format(line.physicalKg)} kg</strong>
                  </span>
                  <span>
                    Reservado{" "}
                    <strong>{kilograms.format(line.reservedKg)} kg</strong>
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid place-items-center px-5 py-8 text-center">
            <Boxes size={20} className="text-[var(--vnext-text-3)]" />
            <p className="mt-2 text-xs font-bold">
              Nenhum café torrado com saldo
            </p>
            <p className="mt-1 text-[10px] text-[var(--vnext-text-3)]">
              As linhas aparecerão aqui após a conclusão das torras.
            </p>
          </div>
        )}
      </section>

      {status === "error" && (
        <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800">
          Não foi possível consolidar o cadastro mestre agora. O BBOS não
          exibirá números estimados.
        </div>
      )}

      <section className="mt-6 space-y-5">
        {Object.keys(lineMeta).map((line) => {
          const products = catalog.filter(
            (product) => product.line === line && product.active,
          );
          if (!products.length) return null;
          const meta = lineMeta[line];
          if (!meta) return null;
          return (
            <div
              key={line}
              className="overflow-hidden rounded-[20px] border border-[var(--vnext-border)] bg-white/95 shadow-[var(--vnext-shadow-card)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--vnext-border)] px-5 py-4">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-9 place-items-center rounded-xl ${meta.soft} ${meta.strong}`}
                  >
                    <Sparkles size={16} />
                  </span>
                  <div>
                    <p
                      className={`text-[9px] font-extrabold uppercase tracking-[.14em] ${meta.strong}`}
                    >
                      {meta.eyebrow}
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold">{meta.label}</h2>
                  </div>
                </div>
                <Badge tone="neutral">
                  {products.length} produto{products.length === 1 ? "" : "s"}
                </Badge>
              </div>

              <div className="divide-y divide-[var(--vnext-border)]">
                {products.map((product) => (
                  <div key={product.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-bold">
                            {product.name}
                          </h3>
                          {product.commercialKind === "WHITE_LABEL" && (
                            <Badge
                              tone={
                                product.baseCoffeeProductId
                                  ? "success"
                                  : "warning"
                              }
                            >
                              White Label
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-[10px] text-[var(--vnext-text-3)]">
                          {product.skus.length} apresentação
                          {product.skus.length === 1 ? "" : "ões"}
                        </p>
                        {product.commercialKind === "WHITE_LABEL" && (
                          <p
                            className={`mt-1 text-[10px] font-semibold ${product.baseCoffeeProductId ? "text-emerald-700" : "text-amber-700"}`}
                          >
                            {product.baseCoffeeProductName
                              ? `Enquadrado em ${PRODUCT_LINE_LABELS[product.line]} · café-base ${product.baseCoffeeProductName}`
                              : "Vínculo com o café-base pendente de revisão"}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {product.commercialKind === "WHITE_LABEL" && (
                          <button
                            type="button"
                            onClick={() => openWhiteLabelMapping(product)}
                            className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-[10px] font-extrabold text-violet-800"
                          >
                            {product.baseCoffeeProductId
                              ? "Alterar enquadramento"
                              : "Enquadrar White Label"}
                          </button>
                        )}
                        <Link
                          href={`/produtos/${product.id}`}
                          className="inline-flex items-center gap-1 text-[10px] font-extrabold text-[var(--vnext-green)]"
                        >
                          Abrir ficha <ArrowRight size={12} />
                        </Link>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {product.skus
                        .filter((sku) => sku.active)
                        .map((sku) => {
                          return (
                            <div
                              key={sku.id}
                              className="grid gap-3 rounded-2xl bg-[var(--vnext-bg-soft)] px-4 py-3 md:grid-cols-[1.4fr_.8fr_.8fr_.8fr_auto] md:items-center"
                            >
                              <div>
                                <p className="text-sm font-bold">
                                  {formatWeight(sku.packageWeightG)}
                                </p>
                                <p className="mt-0.5 text-[10px] text-[var(--vnext-text-3)]">
                                  {sku.sku}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">
                                  Preço base
                                </p>
                                <p className="mt-1 text-xs font-bold">
                                  {money.format(sku.retailPrice)}
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">
                                  Desconto máx.
                                </p>
                                <p className="mt-1 text-xs font-bold">
                                  {sku.maxDiscountPercent.toLocaleString(
                                    "pt-BR",
                                  )}
                                  %
                                </p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--vnext-text-3)]">
                                  Peso bruto
                                </p>
                                <p className="mt-1 text-xs font-bold">
                                  {formatWeight(sku.grossWeightG)}
                                </p>
                              </div>
                              <BlingStatus
                                status={sku.blingSync}
                                variantId={sku.id}
                                onRetried={() => window.location.reload()}
                              />
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

      {status === "loading" && (
        <div className="mt-6 rounded-2xl border border-dashed p-8 text-center text-sm text-[var(--vnext-text-3)]">
          Consolidando catálogo, custos e preços…
        </div>
      )}

      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#07120f]/55 p-4 backdrop-blur-sm"
          onMouseDown={closeCreateProduct}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-product-title"
            className="max-h-[calc(100vh-2rem)] w-full max-w-4xl overflow-y-auto rounded-[24px] border border-white/30 bg-[#FAFAF8] shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className="sticky top-0 z-10 flex items-start justify-between border-b border-[var(--vnext-border)] bg-white px-6 py-5">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[var(--vnext-green)]">
                  Cadastro mestre
                </p>
                <h2 id="new-product-title" className="mt-1 text-2xl font-bold">
                  Novo produto
                </h2>
                <p className="mt-1 text-xs text-[var(--vnext-text-2)]">
                  Cadastro comercial, logístico e fiscal pronto para
                  sincronização segura com o Bling.
                </p>
              </div>
              <button
                type="button"
                onClick={closeCreateProduct}
                disabled={createStatus === "saving"}
                className="rounded-xl border bg-white p-2 text-[var(--vnext-text-2)] disabled:opacity-50"
                aria-label="Fechar cadastro"
              >
                <X size={18} />
              </button>
            </header>

            <form className="space-y-5 p-6" onSubmit={submitNewProduct}>
              <FormSection
                title="1. Identificação"
                description="Escolha primeiro o tipo do café. Isso define o caminho operacional e a sugestão de NCM."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => changeCoffeeKind("ROASTED")}
                    className={`rounded-2xl border p-4 text-left transition ${!isGreenCoffee ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-100" : "bg-white"}`}
                  >
                    <p className="text-sm font-bold">Café torrado</p>
                    <p className="mt-1 text-xs text-[var(--vnext-text-2)]">
                      Produto acabado, linhas Gourmet, Clássicos, Épicos ou
                      Raros.
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => changeCoffeeKind("GREEN")}
                    className={`rounded-2xl border p-4 text-left transition ${isGreenCoffee ? "border-lime-700 bg-lime-50 ring-2 ring-lime-100" : "bg-white"}`}
                  >
                    <p className="text-sm font-bold">Café verde</p>
                    <p className="mt-1 text-xs text-[var(--vnext-text-2)]">
                      Matéria-prima não torrada, com apresentação e fiscal
                      próprios.
                    </p>
                  </button>
                </div>
                {!isGreenCoffee && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() =>
                        setNewProduct((current) => ({
                          ...current,
                          commercialKind: "STANDARD",
                          baseCoffeeProductId: undefined,
                        }))
                      }
                      className={`rounded-2xl border p-4 text-left transition ${!isWhiteLabel ? "border-emerald-700 bg-emerald-50 ring-2 ring-emerald-100" : "bg-white"}`}
                    >
                      <p className="text-sm font-bold">
                        Produto Bispo / perfil-base
                      </p>
                      <p className="mt-1 text-xs text-[var(--vnext-text-2)]">
                        Pode gerar saldo de café torrado nesta linha e perfil.
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setNewProduct((current) => ({
                          ...current,
                          commercialKind: "WHITE_LABEL",
                          baseCoffeeProductId: undefined,
                        }))
                      }
                      className={`rounded-2xl border p-4 text-left transition ${isWhiteLabel ? "border-violet-700 bg-violet-50 ring-2 ring-violet-100" : "bg-white"}`}
                    >
                      <p className="text-sm font-bold">White Label</p>
                      <p className="mt-1 text-xs text-[var(--vnext-text-2)]">
                        Embalagem do cliente vinculada a um café-base da linha.
                      </p>
                    </button>
                  </div>
                )}
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  {!isGreenCoffee && (
                    <Field label="Linha do café torrado">
                      <select
                        value={newProduct.line}
                        onChange={(event) =>
                          changeLine(event.target.value as ProductLine)
                        }
                        className={inputClass}
                      >
                        {ROASTED_PRODUCT_LINES.map((line) => (
                          <option key={line} value={line}>
                            {PRODUCT_LINE_LABELS[line]}
                          </option>
                        ))}
                      </select>
                    </Field>
                  )}
                  {!isGreenCoffee && isWhiteLabel && (
                    <Field label="Café-base da linha">
                      <select
                        required
                        value={newProduct.baseCoffeeProductId ?? ""}
                        onChange={(event) =>
                          setNewProduct((current) => ({
                            ...current,
                            baseCoffeeProductId:
                              event.target.value || undefined,
                          }))
                        }
                        className={inputClass}
                      >
                        <option value="">
                          Selecione o café que será usado
                        </option>
                        {baseCoffeeProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                      <span className="mt-2 block text-[10px] font-normal text-[var(--vnext-text-3)]">
                        A reserva consumirá somente o saldo torrado deste
                        perfil, dentro da linha{" "}
                        {PRODUCT_LINE_LABELS[newProduct.line]}.
                      </span>
                    </Field>
                  )}
                  <Field label="Nome do produto">
                    <input
                      ref={productNameRef}
                      required
                      maxLength={120}
                      value={newProduct.productName}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          productName: event.target.value,
                        }))
                      }
                      className={inputClass}
                      placeholder={
                        isGreenCoffee
                          ? "Ex.: Café Verde Fazenda X"
                          : "Ex.: Essencial"
                      }
                    />
                  </Field>
                  <div className={isGreenCoffee ? "sm:col-span-2" : ""}>
                    <Field label="Descrição" hint="Opcional">
                      <textarea
                        rows={2}
                        maxLength={500}
                        value={newProduct.description ?? ""}
                        onChange={(event) =>
                          setNewProduct((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        className={inputClass}
                        placeholder="Descrição interna do produto"
                      />
                    </Field>
                  </div>
                </div>
              </FormSection>

              <FormSection
                title="2. Apresentação e logística"
                description="Peso bruto não pode ser menor que o líquido; dimensões são necessárias para expedição e Bling."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="SKU">
                    <input
                      required
                      maxLength={60}
                      value={newProduct.sku}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          sku: event.target.value.toLocaleUpperCase("pt-BR"),
                        }))
                      }
                      className={inputClass}
                      placeholder={
                        isGreenCoffee ? "VER-FAZ-30K" : "GOU-ESS-500"
                      }
                    />
                  </Field>
                  <Field label="Peso líquido / tamanho">
                    <select
                      value={newProduct.packageWeightG}
                      onChange={(event) => {
                        const packageWeightG = Number(event.target.value);
                        setNewProduct((current) => ({
                          ...current,
                          packageWeightG,
                          grossWeightG: Math.max(
                            current.grossWeightG,
                            packageWeightG,
                          ),
                        }));
                      }}
                      className={inputClass}
                    >
                      {getAllowedPresentations(newProduct.line).map(
                        (weight) => (
                          <option key={weight} value={weight}>
                            {formatWeight(weight)}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>
                  <Field label="Peso bruto (g)">
                    <input
                      required
                      type="number"
                      min={newProduct.packageWeightG}
                      step="1"
                      value={newProduct.grossWeightG}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          grossWeightG: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Unidade comercial">
                    <select
                      value={newProduct.commercialUnit}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          commercialUnit: event.target.value as "UN" | "KG",
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="UN">Unidade (UN)</option>
                      <option value="KG">Quilograma (KG)</option>
                    </select>
                  </Field>
                  <Field label="Largura (cm)">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newProduct.packageWidthCm}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          packageWidthCm: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Altura (cm)">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newProduct.packageHeightCm}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          packageHeightCm: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Profundidade (cm)">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newProduct.packageDepthCm}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          packageDepthCm: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="GTIN / EAN" hint="Opcional">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{8}|[0-9]{12,14}"
                      value={newProduct.gtin ?? ""}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          gtin: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 14),
                        }))
                      }
                      className={inputClass}
                      placeholder="Código de barras"
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection
                title="3. Preço e desconto"
                description="O BBOS grava o preço do consumidor final e protege o limite de desconto."
              >
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Preço de venda (R$)">
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={newProduct.retailPrice}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          retailPrice: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <Field label="Desconto máximo (%)">
                    <input
                      required
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={newProduct.maxDiscountPercent}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          maxDiscountPercent: Number(event.target.value),
                        }))
                      }
                      className={inputClass}
                    />
                  </Field>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                      Preço mínimo protegido
                    </p>
                    <p className="mt-2 text-lg font-bold text-emerald-950">
                      {money.format(
                        Math.max(
                          0,
                          newProduct.retailPrice *
                            (1 - newProduct.maxDiscountPercent / 100),
                        ),
                      )}
                    </p>
                  </div>
                </div>
              </FormSection>

              <FormSection
                title="4. Fiscal e Bling"
                description="O NCM é sugerido pelo histórico fiscal validado da Bispo; sem histórico, o BBOS usa a referência oficial do tipo de café."
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field label="NCM">
                    <input
                      required
                      inputMode="numeric"
                      pattern="[0-9]{8}"
                      value={newProduct.ncm}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          ncm: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 8),
                          fiscalValidated: false,
                        }))
                      }
                      className={inputClass}
                    />
                    <span className="mt-2 inline-flex rounded-full bg-white px-2 py-1 text-[10px] font-semibold text-[var(--vnext-text-2)]">
                      {ncmSource === "HISTORY"
                        ? "Histórico validado da Bispo"
                        : "Referência fiscal do tipo de café"}
                    </span>
                  </Field>
                  <Field label="Origem da mercadoria">
                    <select
                      value={newProduct.originCode}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          originCode: Number(event.target.value),
                          fiscalValidated: false,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value={0}>0 — Nacional</option>
                      <option value={1}>
                        1 — Estrangeira, importação direta
                      </option>
                      <option value={2}>
                        2 — Estrangeira, mercado interno
                      </option>
                      <option value={3}>
                        3 — Nacional, conteúdo importado &gt; 40%
                      </option>
                      <option value={4}>4 — Nacional, processo básico</option>
                      <option value={5}>
                        5 — Nacional, conteúdo importado ≤ 40%
                      </option>
                      <option value={6}>
                        6 — Estrangeira, sem similar nacional
                      </option>
                      <option value={7}>
                        7 — Estrangeira interna, sem similar
                      </option>
                      <option value={8}>
                        8 — Nacional, conteúdo importado &gt; 70%
                      </option>
                    </select>
                  </Field>
                  <Field label="CEST" hint="Quando aplicável">
                    <input
                      inputMode="numeric"
                      pattern="[0-9]{7}"
                      value={newProduct.cest ?? ""}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          cest: event.target.value
                            .replace(/\D/g, "")
                            .slice(0, 7),
                          fiscalValidated: false,
                        }))
                      }
                      className={inputClass}
                      placeholder="7 dígitos"
                    />
                  </Field>
                  <Field label="Tipo no Bling">
                    <select
                      value={newProduct.productionType}
                      onChange={(event) =>
                        setNewProduct((current) => ({
                          ...current,
                          productionType: event.target.value as "P" | "T",
                          fiscalValidated: false,
                        }))
                      }
                      className={inputClass}
                    >
                      <option value="P">Produção própria</option>
                      <option value="T">Adquirido de terceiros</option>
                    </select>
                  </Field>
                </div>
                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                  <input
                    required
                    type="checkbox"
                    checked={newProduct.fiscalValidated}
                    onChange={(event) =>
                      setNewProduct((current) => ({
                        ...current,
                        fiscalValidated: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 accent-emerald-700"
                  />
                  <span>
                    <strong>Confirmo a validação fiscal destes dados.</strong>
                    <span className="mt-1 block text-xs text-amber-900/75">
                      Sem esta confirmação o produto fica salvo no BBOS, mas o
                      envio ao Bling permanece bloqueado.
                    </span>
                  </span>
                </label>
              </FormSection>

              <label className="flex items-center gap-3 rounded-2xl border border-[var(--vnext-border)] bg-white px-4 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={newProduct.active}
                  onChange={(event) =>
                    setNewProduct((current) => ({
                      ...current,
                      active: event.target.checked,
                    }))
                  }
                  className="size-4 accent-emerald-700"
                />
                Produto e SKU ativos após o cadastro
              </label>

              {createError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"
                >
                  {createError}
                </div>
              )}

              <footer className="flex flex-wrap justify-end gap-3 border-t border-[var(--vnext-border)] pt-5">
                <button
                  type="button"
                  onClick={closeCreateProduct}
                  disabled={createStatus === "saving"}
                  className="rounded-xl border bg-white px-5 py-3 text-xs font-bold disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={createStatus === "saving"}
                  className="inline-flex min-w-40 items-center justify-center gap-2 rounded-xl bg-[#10211D] px-5 py-3 text-xs font-bold text-white disabled:cursor-wait disabled:opacity-60"
                >
                  <Plus size={14} />
                  {createStatus === "saving"
                    ? "Cadastrando…"
                    : "Cadastrar produto"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {mappingProduct && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-[#07120f]/55 p-4 backdrop-blur-sm"
          onMouseDown={() => !mappingBusy && setMappingProduct(null)}
        >
          <form
            onSubmit={saveWhiteLabelMapping}
            onMouseDown={(event) => event.stopPropagation()}
            className="w-full max-w-lg rounded-[24px] border bg-[#FAFAF8] p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-violet-700">
                  White Label
                </p>
                <h2 className="mt-1 text-xl font-bold">
                  Enquadrar {mappingProduct.name}
                </h2>
                <p className="mt-2 text-xs text-[var(--vnext-text-2)]">
                  Linha fixa: {PRODUCT_LINE_LABELS[mappingProduct.line]}. A
                  reserva usará somente o café-base escolhido abaixo.
                </p>
              </div>
              <button
                type="button"
                disabled={mappingBusy}
                onClick={() => setMappingProduct(null)}
                className="rounded-xl border bg-white p-2"
                aria-label="Fechar enquadramento"
              >
                <X size={17} />
              </button>
            </div>
            <div className="mt-5">
              <Field label="Café-base desta linha">
                <select
                  required
                  value={mappingBaseId}
                  onChange={(event) => setMappingBaseId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">Selecione o perfil torrado</option>
                  {catalog
                    .filter(
                      (candidate) =>
                        candidate.active &&
                        candidate.line === mappingProduct.line &&
                        candidate.commercialKind === "STANDARD",
                    )
                    .map((candidate) => (
                      <option key={candidate.id} value={candidate.id}>
                        {candidate.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            {mappingError && (
              <div className="mt-4 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-800">
                {mappingError}
              </div>
            )}
            <footer className="mt-6 flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                disabled={mappingBusy}
                onClick={() => setMappingProduct(null)}
                className="rounded-xl border bg-white px-4 py-3 text-xs font-bold"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={mappingBusy || !mappingBaseId}
                className="rounded-xl bg-[#10211D] px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
              >
                {mappingBusy ? "Salvando…" : "Salvar enquadramento"}
              </button>
            </footer>
          </form>
        </div>
      )}
    </div>
  );
}

const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--vnext-border)] bg-white px-3 py-2.5 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-[var(--vnext-border)] bg-white p-5">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-xs text-[var(--vnext-text-2)]">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs font-bold text-[var(--vnext-text)]">
      <span>{label}</span>
      {hint && (
        <span className="ml-2 font-normal text-[var(--vnext-text-3)]">
          {hint}
        </span>
      )}
      {children}
    </label>
  );
}

function BlingStatus({
  status,
  variantId,
  onRetried,
}: {
  status: CatalogProduct["skus"][number]["blingSync"];
  variantId: string;
  onRetried: () => void;
}) {
  const [retrying, setRetrying] = React.useState(false);
  const [error, setError] = React.useState("");
  const state = status?.state ?? "NOT_QUEUED";
  const tone =
    state === "SYNCED"
      ? "success"
      : state === "RETRYING" || state === "PENDING_VALIDATION"
        ? "warning"
        : "neutral";
  const canRetry = state === "RETRYING" || state === "NOT_QUEUED";

  const retry = async () => {
    setRetrying(true);
    setError("");
    try {
      const response = await fetch(
        `${api}/products/variants/${encodeURIComponent(variantId)}/bling/retry`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      if (!response.ok) throw new Error(await productRequestError(response));
      onRetried();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível reagendar o envio.",
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div
      className="flex min-w-40 flex-col items-start gap-1 md:items-end"
      title={status?.lastError ?? undefined}
    >
      <Badge tone={tone}>{status?.label ?? "Ainda não enviado"}</Badge>
      {canRetry && (
        <button
          type="button"
          onClick={retry}
          disabled={retrying}
          className="inline-flex items-center gap-1 text-[10px] font-bold text-[var(--vnext-green)] disabled:opacity-50"
        >
          <RotateCcw size={11} />
          {retrying ? "Reagendando…" : "Tentar envio"}
        </button>
      )}
      {error && (
        <span className="max-w-52 text-right text-[10px] text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

async function productRequestError(response: Response) {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join(" ");
    if (body.message) return body.message;
  } catch {
    // The fallback below keeps the user-facing error useful for non-JSON responses.
  }
  return "Não foi possível cadastrar o produto.";
}

function Kpi({
  label,
  value,
  detail,
  icon: Icon,
  tone = "green",
}: {
  label: string;
  value: string;
  detail: string;
  icon: typeof PackageCheck;
  tone?: "green" | "blue" | "violet";
}) {
  const classes =
    tone === "blue"
      ? "bg-blue-50 text-blue-700"
      : tone === "violet"
        ? "bg-violet-50 text-violet-700"
        : "bg-emerald-50 text-emerald-700";
  return (
    <Card className="p-4">
      <span className={`grid size-8 place-items-center rounded-xl ${classes}`}>
        <Icon size={14} />
      </span>
      <p className="mt-3 text-[10px] font-semibold text-[var(--vnext-text-2)]">
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tracking-tight">{value}</p>
      <p className="mt-1 text-[10px] text-[var(--vnext-text-3)]">{detail}</p>
    </Card>
  );
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}
