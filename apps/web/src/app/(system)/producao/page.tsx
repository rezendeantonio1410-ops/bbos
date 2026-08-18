"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Factory,
  Flame,
  Gauge,
  PackageCheck,
  Plus,
  Scale,
  Target,
  X,
} from "lucide-react";
import { Badge, Button, Card } from "@bbos/ui";
import {
  calculateProductionCost,
  type ProductionAlert,
  type ProductionOrderStatus,
  type ProductionOrderView,
} from "@bbos/shared";
import { inventoryLotsDemo } from "@/lib/inventory-demo-data";
import {
  PRODUCT_CATALOG_DEMO,
  PRODUCT_LINE_LABELS,
  PRODUCT_LINES,
  type CatalogProduct,
  type ProductLine,
} from "@bbos/shared/product-presentation";
import { loadProductCatalog } from "@/lib/product-catalog-api";
import {
  productionDemoDashboard,
  productionOrdersDemo,
} from "@/lib/production-demo-data";
import { getApiBaseUrl } from "@/lib/api-url";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const status: Record<
  ProductionOrderStatus,
  { label: string; tone: "neutral" | "success" | "warning" | "danger" }
> = {
  planned: { label: "Planejada", tone: "neutral" },
  reserved: { label: "Reservada", tone: "neutral" },
  "in-production": { label: "Em produção", tone: "warning" },
  roasted: { label: "Torrada", tone: "warning" },
  packaging: { label: "Em embalagem", tone: "warning" },
  completed: { label: "Concluída", tone: "success" },
  blocked: { label: "Bloqueada", tone: "danger" },
  cancelled: { label: "Cancelada", tone: "danger" },
};
const field =
  "mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest-700";

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone = "normal",
}: {
  label: string;
  value: string;
  icon: typeof Factory;
  tone?: "normal" | "warning" | "danger";
}) {
  const color =
    tone === "danger"
      ? "bg-red-50 text-red-700"
      : tone === "warning"
        ? "bg-amber-50 text-amber-700"
        : "bg-forest-50 text-forest-700";
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-stone-500">{label}</p>
        <span className={`grid size-8 place-items-center rounded-lg ${color}`}>
          <Icon size={16} />
        </span>
      </div>
      <p className="mt-4 text-xl font-bold tracking-tight">{value}</p>
    </Card>
  );
}

function NewOrderWizard({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (order: ProductionOrderView) => void;
}) {
  const [step, setStep] = useState(0);
  const [catalog, setCatalog] = useState<CatalogProduct[]>(
    PRODUCT_CATALOG_DEMO,
  );
  const [line, setLine] = useState<ProductLine>(
    PRODUCT_CATALOG_DEMO[0]!.line,
  );
  const [productId, setProductId] = useState(PRODUCT_CATALOG_DEMO[0]!.id);
  const [productVariantId, setProductVariantId] = useState(
    PRODUCT_CATALOG_DEMO[0]!.skus[0]!.id,
  );
  const productsForLine = catalog.filter(
    (item) => item.line === line && item.active,
  );
  const catalogProduct =
    productsForLine.find((item) => item.id === productId) ?? productsForLine[0];
  const product = catalogProduct?.name ?? "";
  const variantsForProduct =
    catalogProduct?.skus.filter((item) => item.active) ?? [];
  const selectedVariant =
    variantsForProduct.find((item) => item.id === productVariantId) ??
    variantsForProduct[0];
  const sku = selectedVariant?.sku ?? "";
  useEffect(() => {
    void loadProductCatalog().then(({ products }) => {
      if (!products.length) return;
      const first = products[0]!;
      setCatalog(products);
      setLine(first.line);
      setProductId(first.id);
      setProductVariantId(first.skus[0]?.id ?? "");
    });
  }, []);
  const [quantity, setQuantity] = useState(240);
  const [date, setDate] = useState("2026-08-08");
  const [mode, setMode] = useState<"single" | "blend">("single");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [error, setError] = useState("");
  const available = inventoryLotsDemo.filter(
    (lot) => lot.status === "approved" || lot.status === "attention",
  );
  const allocated = Object.values(selected).reduce(
    (sum, value) => sum + value,
    0,
  );
  const stages = [
    "Produto",
    "Quantidade",
    "Data",
    "Café / Blend",
    "Lotes disponíveis",
    "Confirmar OP",
  ];
  const next = () => {
    setError("");
    if (step === 0 && !selectedVariant)
      return setError("Selecione uma apresentação/SKU ativa do catálogo.");
    if (step === 1 && quantity <= 0)
      return setError("Informe uma quantidade maior que zero.");
    if (step === 4 && Math.abs(allocated - quantity) > 0.001)
      return setError(
        `A reserva deve totalizar ${number.format(quantity)} kg.`,
      );
    setStep((current) => Math.min(5, current + 1));
  };
  const updateLot = (lotId: string, value: number) => {
    const lot = available.find((item) => item.id === lotId);
    if (!lot || value < 0 || value > lot.availableQuantityKg)
      return setError(`Saldo insuficiente no lote ${lot?.code ?? ""}.`);
    if (mode === "single") setSelected(value ? { [lotId]: value } : {});
    else setSelected((current) => ({ ...current, [lotId]: value }));
    setError("");
  };
  const confirm = () => {
    if (Math.abs(allocated - quantity) > 0.001)
      return setError(
        "A soma das reservas deve ser igual à quantidade planejada.",
      );
    const allocations = available
      .filter((lot) => selected[lot.id])
      .map((lot) => ({
        lotId: lot.id,
        lotCode: lot.code,
        origin: lot.origin,
        reservedKg: selected[lot.id]!,
        consumedKg: 0,
        percentage: (selected[lot.id]! / quantity) * 100,
        realCostPerKg: lot.realCostPerKg,
      }));
    if (
      Math.abs(
        allocations.reduce((sum, item) => sum + item.percentage, 0) - 100,
      ) > 0.01
    )
      return setError("A participação dos lotes deve somar 100%.");
    onCreate({
      id: `op-${Date.now()}`,
      code: `OP-2026-${String(111 + productionOrdersDemo.length).padStart(4, "0")}`,
      productVariantId: selectedVariant?.id,
      product,
      sku,
      plannedQuantity: quantity,
      producedQuantity: 0,
      unit: "kg",
      plannedAt: date,
      responsible: "A definir",
      priority: "normal",
      status: "reserved",
      blendName:
        mode === "single"
          ? `Café único — ${allocations[0]?.origin}`
          : "Blend operacional",
      allocations,
      batches: [],
      packaging: {
        packageWeightG: selectedVariant?.packageWeightG ?? 500,
        plannedPackages: Math.round(
          (quantity * 1000) / (selectedVariant?.packageWeightG ?? 500),
        ),
        producedPackages: 0,
        lossPackages: 0,
        packagingName: `Embalagem ${sku}`,
        packagingUnitCost: 2.75,
        labelsCost: 0,
        boxesCost: 0,
        otherSuppliesCost: 0,
      },
      costs: {
        greenCoffeeConsumedCost: allocations.reduce(
          (sum, item) => sum + item.reservedKg * item.realCostPerKg,
          0,
        ),
        roastLossCost: 0,
        packagingCost: 0,
        suppliesCost: 0,
        laborCost: 0,
        energyCost: 0,
        otherIndustrialCosts: 0,
        roastedOutputKg: quantity * 0.845,
        finishedOutputKg: quantity * 0.83,
        producedPackages: Math.max(1, Math.round(quantity * 2 * 0.83)),
        standardCostPerKg: 58,
        sku,
        sourceCostEventIds: [],
      },
      traceability: [
        "Fornecedor",
        "Recebimento",
        "Lote verde",
        "OP",
        "Torra",
        "Blend",
        "Embalagem",
        "Produto acabado",
      ].map((label, index) => ({
        id: `${Date.now()}-${index}`,
        label,
        detail:
          index < 3
            ? "Concluído"
            : index === 3
              ? "Etapa atual"
              : "Próxima etapa",
        status: index < 3 ? "complete" : index === 3 ? "current" : "future",
      })),
    });
  };
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
              Nova ordem de produção
            </p>
            <h2 className="mt-1 text-xl font-bold">{stages[step]}</h2>
          </div>
          <button onClick={onClose} className="rounded-xl border p-2">
            <X size={18} />
          </button>
        </div>
        <div className="mt-6 flex gap-2">
          {stages.map((label, index) => (
            <div key={label} className="min-w-0 flex-1">
              <div
                className={`h-1.5 rounded-full ${index <= step ? "bg-forest-800" : "bg-stone-100"}`}
              />
              <p className="mt-2 hidden truncate text-[10px] text-stone-400 md:block">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="min-h-72 py-8">
          {step === 0 && (
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="text-xs font-semibold">
                Linha
                <select
                  value={line}
                  onChange={(e) => {
                    const nextLine = e.target.value as ProductLine;
                    const nextProduct = catalog.find(
                      (item) => item.line === nextLine,
                    );
                    setLine(nextLine);
                    setProductId(nextProduct?.id ?? "");
                    setProductVariantId(nextProduct?.skus[0]?.id ?? "");
                  }}
                  className={field}
                >
                  {PRODUCT_LINES.map((item) => (
                    <option key={item} value={item}>
                      {PRODUCT_LINE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                Produto
                <select
                  value={catalogProduct?.id ?? ""}
                  onChange={(event) => {
                    const next = productsForLine.find(
                      (item) => item.id === event.target.value,
                    );
                    setProductId(event.target.value);
                    setProductVariantId(next?.skus[0]?.id ?? "");
                  }}
                  className={field}
                  disabled={!productsForLine.length}
                >
                  {!productsForLine.length && (
                    <option value="">Nenhum produto cadastrado</option>
                  )}
                  {productsForLine.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold">
                SKU / Apresentação
                <select
                  value={selectedVariant?.id ?? ""}
                  onChange={(event) =>
                    setProductVariantId(event.target.value)
                  }
                  className={field}
                  disabled={!variantsForProduct.length}
                >
                  {!variantsForProduct.length && (
                    <option value="">Nenhum SKU ativo</option>
                  )}
                  {variantsForProduct.map((variant) => (
                    <option key={variant.id} value={variant.id}>
                      {variant.sku} •{" "}
                      {variant.packageWeightG === 1000
                        ? "1 kg"
                        : `${variant.packageWeightG} g`}
                    </option>
                  ))}
                </select>
              </label>
              {selectedVariant && (
                <div className="sm:col-span-3 rounded-xl bg-stone-50 px-4 py-3 text-xs text-stone-600">
                  <strong className="text-stone-900">{product}</strong> • {sku} •{" "}
                  {selectedVariant.packageWeightG === 1000
                    ? "1 kg"
                    : `${selectedVariant.packageWeightG} g`} • unidade{" "}
                  {selectedVariant.commercialUnit} •{" "}
                  <span className="text-emerald-700">Ativo</span>
                </div>
              )}
            </div>
          )}
          {step === 1 && (
            <label className="mx-auto block max-w-sm text-xs font-semibold">
              Quantidade planejada (kg)
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className={field}
              />
            </label>
          )}
          {step === 2 && (
            <label className="mx-auto block max-w-sm text-xs font-semibold">
              Data planejada
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={field}
              />
            </label>
          )}
          {step === 3 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  {
                    key: "single",
                    title: "Café único",
                    text: "Uma origem e um lote.",
                  },
                  {
                    key: "blend",
                    title: "Blend",
                    text: "Múltiplos lotes com participação em kg e %.",
                  },
                ] as const
              ).map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    setMode(item.key);
                    setSelected({});
                  }}
                  className={`rounded-2xl border p-6 text-left ${mode === item.key ? "border-forest-700 bg-forest-50" : ""}`}
                >
                  <p className="font-bold">{item.title}</p>
                  <p className="mt-2 text-xs text-stone-500">{item.text}</p>
                </button>
              ))}
            </div>
          )}
          {step === 4 && (
            <div className="space-y-3">
              {available.map((lot) => (
                <div
                  key={lot.id}
                  className="grid items-center gap-3 rounded-2xl border p-4 sm:grid-cols-[1fr_150px_100px]"
                >
                  <div>
                    <p className="text-sm font-bold">{lot.code}</p>
                    <p className="mt-1 text-xs text-stone-500">
                      {lot.origin} • disponível{" "}
                      {number.format(lot.availableQuantityKg)} kg
                    </p>
                  </div>
                  <input
                    aria-label={`Reservar ${lot.code}`}
                    type="number"
                    min="0"
                    max={lot.availableQuantityKg}
                    value={selected[lot.id] ?? 0}
                    onChange={(e) => updateLot(lot.id, Number(e.target.value))}
                    className={field.replace("mt-2 ", "")}
                  />
                  <p className="text-right text-xs font-bold text-forest-700">
                    {allocated
                      ? number.format(
                          ((selected[lot.id] ?? 0) / quantity) * 100,
                        )
                      : 0}
                    %
                  </p>
                </div>
              ))}
              <div className="flex justify-between rounded-xl bg-stone-50 p-4 text-sm">
                <span>Reserva total</span>
                <strong
                  className={
                    Math.abs(allocated - quantity) < 0.001
                      ? "text-emerald-700"
                      : "text-amber-700"
                  }
                >
                  {number.format(allocated)} / {number.format(quantity)} kg
                </strong>
              </div>
            </div>
          )}
          {step === 5 && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="p-5">
                <p className="text-xs text-stone-400">Produto</p>
                <p className="mt-2 font-bold">{product}</p>
                <p className="mt-1 text-xs text-stone-500">
                  {sku} • {number.format(quantity)} kg • {date}
                </p>
              </Card>
              <Card className="p-5">
                <p className="text-xs text-stone-400">Reserva validada</p>
                <p className="mt-2 font-bold text-emerald-700">
                  {number.format(allocated)} kg disponíveis
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {Object.keys(selected).length} lote(s) • participação 100%
                </p>
              </Card>
            </div>
          )}
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
        <div className="flex justify-between">
          <button
            onClick={() => (step ? setStep(step - 1) : onClose())}
            className="px-4 py-2 text-sm font-semibold text-stone-500"
          >
            {step ? "Voltar" : "Cancelar"}
          </button>
          <Button onClick={step === 5 ? confirm : next}>
            {step === 5 ? "Confirmar e reservar" : "Continuar"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function OrderDrawer({
  order,
  alert,
  onClose,
}: {
  order: ProductionOrderView;
  alert?: ProductionAlert;
  onClose: () => void;
}) {
  const [alertOpen, setAlertOpen] = useState(false);
  const cost = calculateProductionCost(order.costs);
  const sections = [
    "Resumo",
    "Produção",
    "Lotes",
    "Torra",
    "Blend",
    "Embalagem",
    "Custos",
    "Rastreabilidade",
    "Alertas",
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        aria-label="Fechar"
        className="absolute inset-0 bg-forest-950/30"
        onClick={onClose}
      />
      <aside className="relative h-full w-full max-w-2xl overflow-y-auto bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Badge tone={status[order.status].tone}>
                {status[order.status].label}
              </Badge>
              <span className="text-xs text-stone-400">{order.code}</span>
            </div>
            <h2 className="mt-3 text-xl font-bold">{order.product}</h2>
            <p className="mt-1 text-xs text-stone-500">
              {order.sku} • {order.responsible}
            </p>
          </div>
          <button onClick={onClose} className="rounded-xl border p-2">
            <X size={18} />
          </button>
        </div>
        <nav className="mt-6 flex gap-2 overflow-x-auto pb-2">
          {sections.map((item) => (
            <a
              key={item}
              href={`#op-${item}`}
              className="whitespace-nowrap rounded-full bg-stone-100 px-3 py-1.5 text-[11px] font-semibold"
            >
              {item}
            </a>
          ))}
        </nav>
        <div className="mt-5 space-y-7">
          <section
            id="op-Resumo"
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          >
            <SummaryCard
              label="Planejado"
              value={`${number.format(order.plannedQuantity)} kg`}
              icon={Target}
            />
            <SummaryCard
              label="Produzido"
              value={`${number.format(order.producedQuantity)} kg`}
              icon={PackageCheck}
            />
            <SummaryCard
              label="Prioridade"
              value={order.priority}
              icon={Clock3}
            />
            <SummaryCard
              label="Data"
              value={order.plannedAt.slice(5).split("-").reverse().join("/")}
              icon={Clock3}
            />
          </section>
          <section id="op-Produção">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Produção
            </h3>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full bg-forest-800"
                style={{
                  width: `${Math.min((order.producedQuantity / order.plannedQuantity) * 100, 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-stone-500">
              {number.format(
                (order.producedQuantity / order.plannedQuantity) * 100,
              )}
              % da OP realizada
            </p>
          </section>
          <section id="op-Lotes">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Lotes e blend
            </h3>
            <div className="mt-3 space-y-2">
              {order.allocations.map((item) => (
                <div
                  key={item.lotId}
                  className="flex justify-between rounded-xl border p-4 text-sm"
                >
                  <div>
                    <strong>{item.lotCode}</strong>
                    <p className="mt-1 text-xs text-stone-400">{item.origin}</p>
                  </div>
                  <div className="text-right">
                    <strong>{number.format(item.reservedKg)} kg</strong>
                    <p className="mt-1 text-xs text-forest-700">
                      {number.format(item.percentage)}%
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section id="op-Torra">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Torra por batch
            </h3>
            {order.batches.length ? (
              <div className="mt-3 space-y-2">
                {order.batches.map((batch) => (
                  <div key={batch.id} className="rounded-xl border p-4">
                    <div className="flex justify-between">
                      <strong className="text-sm">
                        {batch.code} • {batch.machine}
                      </strong>
                      <Badge
                        tone={
                          batch.lossPercent >
                          productionDemoDashboard.roastLossTargetPercent
                            ? "warning"
                            : "success"
                        }
                      >
                        Perda {number.format(batch.lossPercent)}%
                      </Badge>
                    </div>
                    <p className="mt-2 text-xs text-stone-500">
                      {number.format(batch.greenInputKg)} kg verde →{" "}
                      {number.format(batch.roastedOutputKg)} kg torrado •{" "}
                      {batch.operator}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 rounded-xl bg-stone-50 p-4 text-xs text-stone-500">
                Nenhum batch registrado. Estrutura de curva e temperatura
                preparada para integração.
              </p>
            )}
          </section>
          <section id="op-Embalagem">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Embalagem
            </h3>
            {order.packaging && (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <SummaryCard
                  label="Formato"
                  value={`${order.packaging.packageWeightG} g`}
                  icon={Boxes}
                />
                <SummaryCard
                  label="Planejado"
                  value={`${order.packaging.plannedPackages} un.`}
                  icon={Target}
                />
                <SummaryCard
                  label="Produzido"
                  value={`${order.packaging.producedPackages} un.`}
                  icon={PackageCheck}
                />
                <SummaryCard
                  label="Perdas"
                  value={`${order.packaging.lossPackages} un.`}
                  icon={AlertTriangle}
                />
              </div>
            )}
          </section>
          <section id="op-Custos">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Custo real da OP
            </h3>
            <div className="mt-3 rounded-2xl bg-forest-950 p-5 text-white">
              <p className="text-xs text-white/50">Custo total</p>
              <p className="mt-1 text-2xl font-bold">
                {brl.format(cost.totalCost)}
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <span>
                  Custo/kg acabado
                  <br />
                  <strong>{brl.format(cost.costPerFinishedKg)}</strong>
                </span>
                <span>
                  Custo/pacote
                  <br />
                  <strong>{brl.format(cost.costPerPackage)}</strong>
                </span>
                <span>
                  Desvio padrão
                  <br />
                  <strong>
                    {number.format(cost.standardCostDeviationPercent)}%
                  </strong>
                </span>
              </div>
            </div>
          </section>
          <section id="op-Rastreabilidade">
            <h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Rastreabilidade
            </h3>
            <div className="mt-4 space-y-1">
              {order.traceability.map((item) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span
                    className={`grid size-7 place-items-center rounded-full ${item.status === "complete" ? "bg-emerald-100 text-emerald-700" : item.status === "current" ? "bg-amber-100 text-amber-700" : "bg-stone-100 text-stone-400"}`}
                  >
                    {item.status === "complete" ? (
                      <Check size={13} />
                    ) : (
                      <span className="size-1.5 rounded-full bg-current" />
                    )}
                  </span>
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-[10px] text-stone-400">{item.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          {alert && (
            <section
              id="op-Alertas"
              className="rounded-2xl border border-amber-200 bg-amber-50 p-5"
            >
              <p className="text-sm font-bold text-amber-900">{alert.alert}</p>
              <p className="mt-2 text-xs text-amber-800">
                {alert.datum} • impacto {brl.format(alert.financialImpact)}
              </p>
              <button
                onClick={() => setAlertOpen(!alertOpen)}
                className="mt-3 flex items-center gap-1 text-xs font-bold text-amber-900"
              >
                Ver causas e ações <ChevronRight size={13} />
              </button>
              {alertOpen && (
                <div className="mt-4 space-y-3 border-t border-amber-200 pt-4 text-xs text-stone-700">
                  <p>
                    <strong>Diagnóstico:</strong> {alert.diagnosis}
                  </p>
                  <p>
                    <strong>Impacto:</strong> +
                    {number.format(alert.differenceKg)} kg •{" "}
                    {brl.format(alert.financialImpact)}
                  </p>
                  <div>
                    <strong>Pontos de investigação:</strong>
                    <ul className="mt-2 list-disc space-y-1 pl-5">
                      {alert.investigationPoints.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <p>
                    <strong>Ação:</strong> {alert.action}
                  </p>
                  <p>
                    <strong>Resultado:</strong> {alert.expectedResult}
                  </p>
                </div>
              )}
            </section>
          )}
        </div>
      </aside>
    </div>
  );
}

export default function ProductionPage() {
  const [orders, setOrders] = useState<ProductionOrderView[]>([]);
  const [wizard, setWizard] = useState(false);
  const [selected, setSelected] = useState<ProductionOrderView | null>(null);
  const [message, setMessage] = useState("");
  const summary = { plannedTodayKg: 0, producedTodayKg: 0, openOrders: 0, inProgressOrders: 0, delayedOrders: 0, efficiencyPercent: 0, averageRoastLossPercent: 0, averageRealCostPerKg: 0, monthlyProducedKg: 0, monthlyTargetKg: 0 };
  useEffect(() => { void fetch(`${getApiBaseUrl()}/production/orders`, { credentials: "include" }).then((response) => response.ok ? response.json() : []).then((rows: Array<Record<string, unknown>>) => setOrders(rows.map((row) => ({ id: String(row.id), code: String(row.code), product: String(row.productName ?? "Produto não definido"), sku: String(row.sku ?? "—"), plannedQuantity: Number(row.plannedWeightKg ?? 0), producedQuantity: Number(row.actualOutputKg ?? 0), unit: String(row.unit ?? "kg"), plannedAt: String(row.plannedAt ?? ""), startedAt: row.startedAt ? String(row.startedAt) : undefined, completedAt: row.completedAt ? String(row.completedAt) : undefined, responsible: String(row.responsible ?? "—"), priority: String(row.priority ?? "normal").toLowerCase() as ProductionOrderView["priority"], status: String(row.status ?? "PLANNED").toLowerCase().replace("_", "-") as ProductionOrderView["status"], blendName: String((row.blend as { name?: string } | undefined)?.name ?? "—"), allocations: [], batches: [], packaging: undefined, costs: { greenCoffeeConsumedCost: 0, roastLossCost: 0, packagingCost: 0, suppliesCost: 0, laborCost: 0, energyCost: 0, otherIndustrialCosts: 0, roastedOutputKg: Number(row.actualOutputKg ?? 0), finishedOutputKg: 0, producedPackages: 0, totalCost: 0, costPerKg: 0, standardCostPerKg: 0, sku: String(row.sku ?? "—"), sourceCostEventIds: [] }, traceability: [] })) as unknown as ProductionOrderView[])).catch(() => setOrders([])); }, []);
  const cards = useMemo(
    () => [
      {
        label: "Planejado hoje",
        value: `${number.format(summary.plannedTodayKg)} kg`,
        icon: Target,
      },
      {
        label: "Realizado hoje",
        value: `${number.format(summary.producedTodayKg)} kg`,
        icon: PackageCheck,
      },
      { label: "OPs abertas", value: String(summary.openOrders), icon: Boxes },
      {
        label: "Em andamento",
        value: String(summary.inProgressOrders),
        icon: Factory,
      },
      {
        label: "OPs atrasadas",
        value: String(summary.delayedOrders),
        icon: Clock3,
        tone: "danger" as const,
      },
      {
        label: "Eficiência industrial",
        value: `${number.format(summary.efficiencyPercent)}%`,
        icon: Gauge,
      },
      {
        label: "Perda média de torra",
        value: `${number.format(summary.averageRoastLossPercent)}%`,
        icon: Flame,
        tone: "warning" as const,
      },
      {
        label: "Custo médio/kg",
        value: brl.format(summary.averageRealCostPerKg),
        icon: CircleDollarSign,
      },
      {
        label: "Produção no mês",
        value: `${number.format(summary.monthlyProducedKg)} kg`,
        icon: Scale,
      },
      {
        label: "Meta do mês",
        value: `${number.format(summary.monthlyTargetKg)} kg`,
        icon: Target,
      },
    ],
    [summary],
  );
  const create = (order: ProductionOrderView) => {
    setOrders((current) => [order, ...current]);
    setWizard(false);
    setMessage(
      `${order.code} criada e ${number.format(order.plannedQuantity)} kg reservados sem alterar o saldo físico.`,
    );
  };
  return (
    <div className="mx-auto max-w-[1480px]">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-forest-700">
            <Factory size={14} />
            Operação industrial
          </div>
          <h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight">
            Produção
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Da reserva do café verde à entrada do produto acabado
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/producao/recursos"
            className="flex items-center justify-center gap-2 rounded-xl border bg-white px-4 py-3 text-xs font-bold text-stone-700 transition hover:bg-stone-50"
          >
            <Factory size={15} /> Recursos e Máquinas
          </Link>
          <Button
            onClick={() => setWizard(true)}
            className="flex items-center justify-center gap-2 px-5 py-3"
          >
            <Plus size={16} />
            Nova OP
          </Button>
        </div>
      </div>
      {message && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <span className="flex items-center gap-2">
            <Check size={15} />
            {message}
          </span>
          <button onClick={() => setMessage("")}>
            <X size={15} />
          </button>
        </div>
      )}
      <section className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <SummaryCard key={card.label} {...card} />
        ))}
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6">
          <div className="flex justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
                Meta x realizado
              </p>
              <h2 className="mt-1 text-lg font-bold">Produção mensal</h2>
            </div>
            <strong>
              {number.format(
                (summary.monthlyProducedKg / summary.monthlyTargetKg) * 100,
              )}
              %
            </strong>
          </div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-stone-100">
            <div
              className="h-full rounded-full bg-forest-800"
              style={{
                width: `${(summary.monthlyProducedKg / summary.monthlyTargetKg) * 100}%`,
              }}
            />
          </div>
          <div className="mt-3 flex justify-between text-xs text-stone-500">
            <span>
              {number.format(summary.monthlyProducedKg)} kg realizados
            </span>
            <span>{number.format(summary.monthlyTargetKg)} kg meta</span>
          </div>
        </Card>
        <Card className="border-amber-200 p-6">
          <div className="flex gap-3">
            <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700">
              <AlertTriangle size={17} />
            </span>
            <div>
              <p className="text-sm font-bold">Perda acima da meta</p>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                Batch B-108-A: 16,0% contra meta de 15,5%.
              </p>
              <button
                onClick={() =>
                  setSelected(
                    orders.find((item) => item.id === "op-0108") ?? null,
                  )
                }
                className="mt-3 flex items-center gap-1 text-xs font-bold text-forest-700"
              >
                Ver causas e ações <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </Card>
      </section>
      <section className="mt-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
            Ordens de produção
          </p>
          <h2 className="mt-1 text-lg font-bold">Fluxo operacional</h2>
        </div>
        <div className="mt-4 space-y-3">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => setSelected(order)}
              className="w-full text-left"
            >
              <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-lg">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                  <div className="min-w-56">
                    <div className="flex items-center gap-2">
                      <strong>{order.code}</strong>
                      <Badge tone={status[order.status].tone}>
                        {status[order.status].label}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm font-semibold">
                      {order.product}
                    </p>
                    <p className="mt-1 text-xs text-stone-400">
                      {order.sku} • {order.blendName}
                    </p>
                  </div>
                  <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
                    <span>
                      <small className="text-stone-400">Planejado</small>
                      <p className="mt-1 text-sm font-bold">
                        {number.format(order.plannedQuantity)} kg
                      </p>
                    </span>
                    <span>
                      <small className="text-stone-400">Produzido</small>
                      <p className="mt-1 text-sm font-bold">
                        {number.format(order.producedQuantity)} kg
                      </p>
                    </span>
                    <span>
                      <small className="text-stone-400">Responsável</small>
                      <p className="mt-1 text-sm font-bold">
                        {order.responsible}
                      </p>
                    </span>
                    <span>
                      <small className="text-stone-400">Data</small>
                      <p className="mt-1 text-sm font-bold">
                        {order.plannedAt
                          .slice(5)
                          .split("-")
                          .reverse()
                          .join("/")}
                      </p>
                    </span>
                  </div>
                  <ChevronRight size={17} className="text-stone-300" />
                </div>
              </Card>
            </button>
          ))}
        </div>
      </section>
      {wizard && (
        <NewOrderWizard onClose={() => setWizard(false)} onCreate={create} />
      )}{" "}
      {selected && (
        <OrderDrawer
          order={selected}
          alert={productionDemoDashboard.alerts.find(
            (item) => item.orderId === selected.id,
          )}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
