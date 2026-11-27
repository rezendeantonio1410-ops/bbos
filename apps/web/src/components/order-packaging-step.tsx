"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Flame, PackageCheck, RefreshCw } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type PlanItem = {
  salesOrderItemId: string;
  productVariantId: string;
  productName: string;
  sku: string;
  coffeeProductId: string;
  coffeeName: string;
  lineName: string;
  packages: number;
  packageWeightG: number;
  requiredKg: number;
  state: "PACKED" | "FROM_STOCK" | "READY" | "ROASTING" | "NEEDS_ROAST";
  readyOp: { id: string; code: string; kind: "ROASTED" | "WIP"; availableKg: number } | null;
  roastingOp: { id: string; code: string; status: string; plannedKg: number } | null;
  bestAvailableKg: number;
  suggestedGreenKg: number;
};

const kg = (value: number) => `${value.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} kg`;
const brl = (value: string) => Number(value.replace(/\./g, "").replace(",", ".")) || 0;

async function errorOf(response: Response, fallback: string) {
  const body = (await response.json().catch(() => ({}))) as { message?: string | { message?: string } };
  return typeof body.message === "string" ? body.message : (body.message?.message ?? fallback);
}

/**
 * Etapa de embalagem dentro do pedido: diz o que falta (torrar ou embalar)
 * e confirma a embalagem usando o mesmo registro da Produção, que dá baixa
 * no café torrado, cria os pacotes e reserva para o pedido.
 */
export function OrderPackagingStep({ orderId, canOperate, onDone }: { orderId: string; canOperate: boolean; onDone: () => void | Promise<void> }) {
  const [items, setItems] = useState<PlanItem[] | null>(null);
  const [openItem, setOpenItem] = useState("");
  const [unitCost, setUnitCost] = useState("2,80");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const api = getApiBaseUrl();

  const load = useCallback(async () => {
    const response = await fetch(`${api}/production/sales-orders/${orderId}/packaging-plan`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!response?.ok) return setItems([]);
    const payload = (await response.json()) as { items: PlanItem[] };
    setItems(payload.items);
  }, [api, orderId]);

  useEffect(() => { void load(); }, [load]);

  const confirmPacked = async (item: PlanItem) => {
    if (!item.readyOp) return;
    setBusy(true);
    setMessage("");
    try {
      const op = item.readyOp;
      let response: Response;
      if (op.kind === "WIP") {
        response = await fetch(`${api}/production/orders/${op.id}/packaging/complete-wip`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ productVariantId: item.productVariantId, salesOrderItemId: item.salesOrderItemId, producedPackages: item.packages, idempotencyKey: `order-pack:${item.salesOrderItemId}` }),
        });
      } else {
        const utility = await fetch(`${api}/production/orders/${op.id}/utility-costs`, { credentials: "include", cache: "no-store" })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null) as { configured?: boolean; energyCost?: number; gasCost?: number } | null;
        const cost = brl(unitCost);
        response = await fetch(`${api}/production/orders/${op.id}/complete`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            productVariantId: item.productVariantId,
            salesOrderItemId: item.salesOrderItemId,
            finishedOutputKg: item.requiredKg,
            producedPackages: item.packages,
            packaging: [{ materialType: "PACKAGE", materialName: `Embalagem ${item.sku}`, sku: item.sku, quantity: item.packages, unit: "UN", unitCost: cost }],
            laborCost: 0,
            energyCost: utility?.configured ? Number(Number(utility.energyCost ?? 0).toFixed(2)) : 0,
            gasCost: utility?.configured ? Number(Number(utility.gasCost ?? 0).toFixed(2)) : 0,
            suppliesCost: 0,
            otherIndustrialCosts: 0,
            standardCostPerKg: 0,
          }),
        });
      }
      if (!response.ok) throw new Error(await errorOf(response, "Não foi possível confirmar a embalagem."));
      setOpenItem("");
      setMessage(`${item.packages.toLocaleString("pt-BR")} pacotes de ${item.productName} embalados e reservados para este pedido.`);
      await load();
      await onDone();
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Não foi possível confirmar a embalagem.");
    } finally {
      setBusy(false);
    }
  };

  if (!items?.length) return null;

  return (
    <div className="mt-3 space-y-2">
      {items.map((item) => {
        const what = `${item.packages.toLocaleString("pt-BR")} pacotes de ${item.packageWeightG} g`;
        const coffee = `${item.coffeeName} (linha ${item.lineName})`;
        if (item.state === "PACKED" || item.state === "FROM_STOCK")
          return (
            <div key={item.salesOrderItemId} className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
              <CheckCircle2 size={15} />
              <span><strong>{item.productName}</strong> · {item.state === "PACKED" ? "embalado e reservado." : "há pacotes prontos no estoque."}</span>
            </div>
          );
        if (item.state === "NEEDS_ROAST")
          return (
            <div key={item.salesOrderItemId} className="rounded-xl border border-amber-200 bg-white p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-amber-900"><Flame size={14} /> Falta torrar {coffee}</p>
              <p className="mt-1 text-[11px] leading-4 text-stone-600">
                {what} de {item.productName} precisam de <strong>{kg(item.requiredKg)} torrados</strong>, cerca de {kg(item.suggestedGreenKg)} de café verde.
                {item.bestAvailableKg > 0 ? ` Hoje há só ${kg(item.bestAvailableKg)} torrados desse café.` : ""}
              </p>
              {canOperate && (
                <Link href={`/producao?nova=1&produto=${encodeURIComponent(item.coffeeProductId)}&kg=${item.suggestedGreenKg}`} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-[11px] font-bold text-white">
                  <Flame size={14} /> Pedir torra do {item.coffeeName}
                </Link>
              )}
            </div>
          );
        if (item.state === "ROASTING")
          return (
            <div key={item.salesOrderItemId} className="rounded-xl border border-blue-100 bg-white p-3">
              <p className="flex items-center gap-1.5 text-xs font-bold text-blue-900"><RefreshCw size={14} /> Torra do {item.coffeeName} em andamento</p>
              <p className="mt-1 text-[11px] leading-4 text-stone-600">
                {item.roastingOp?.code} precisa ser torrada por completo. Depois disso, o botão Confirmar café embalado aparece aqui.
              </p>
              {canOperate && item.roastingOp && (
                <Link href={`/producao?op=${encodeURIComponent(item.roastingOp.id)}`} className="mt-2 inline-flex rounded-xl border px-4 py-2.5 text-[11px] font-bold text-stone-700">Abrir torra {item.roastingOp.code}</Link>
              )}
            </div>
          );
        const op = item.readyOp!;
        const open = openItem === item.salesOrderItemId;
        return (
          <div key={item.salesOrderItemId} className="rounded-xl border border-emerald-200 bg-white p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-900"><PackageCheck size={14} /> {item.coffeeName} torrado pronto para embalar</p>
            <p className="mt-1 text-[11px] leading-4 text-stone-600">
              {op.code} tem {kg(op.availableKg)} torrados. Este pedido usa {kg(item.requiredKg)} para {what} de {item.productName}.
            </p>
            {canOperate && !open && (
              <button type="button" disabled={busy} onClick={() => { setMessage(""); setOpenItem(item.salesOrderItemId); }} className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-50">
                <PackageCheck size={14} /> Confirmar café embalado
              </button>
            )}
            {canOperate && open && (
              <div className="mt-2 space-y-2 rounded-xl bg-emerald-50/60 p-3">
                <p className="text-[11px] font-semibold text-stone-800">Confirma que {what} foram embalados com o café de {op.code}?</p>
                {op.kind === "ROASTED" && (
                  <label className="block text-[10px] font-semibold text-stone-600">Custo da embalagem por pacote (R$)
                    <input inputMode="decimal" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} className="mt-1 block w-28 rounded-lg border border-stone-200 bg-white px-2 py-2 text-xs" />
                  </label>
                )}
                <p className="text-[10px] text-stone-500">O BBOS dá baixa no café torrado, cria os pacotes no estoque e reserva para este pedido. Depois ele fica pronto para faturar.</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setOpenItem("")} className="rounded-xl border bg-white px-4 py-2.5 text-[11px] font-bold text-stone-600">Cancelar</button>
                  <button type="button" disabled={busy} onClick={() => void confirmPacked(item)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-[11px] font-bold text-white disabled:opacity-50">
                    {busy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />} Sim, está embalado
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      {message && <p role="status" className="text-[11px] font-semibold text-stone-700">{message}</p>}
    </div>
  );
}
