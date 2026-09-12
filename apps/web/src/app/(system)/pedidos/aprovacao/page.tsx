"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Link2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { OrderCustomerApprovalActions } from "@/components/order-customer-approval-actions";

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type Order = {
  id: string;
  code: string;
  orderNumber?: string;
  status: string;
  totalAmount: string;
  customer: { name: string };
};

export default function CustomerApprovalWorkspace() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch(`${getApiBaseUrl()}/sales-orders`, { credentials: "include", cache: "no-store" })
      .then(async (response) => response.ok ? setOrders(await response.json()) : setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  const drafts = orders.filter((order) => order.status === "DRAFT");
  const selected = drafts.find((order) => order.id === selectedId);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/pedidos" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500"><ArrowLeft size={13}/> Pedidos</Link>
          <p className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700"><ShieldCheck size={13}/> Comercial</p>
          <h1 className="mt-1 text-3xl font-bold">Aprovação do cliente</h1>
          <p className="mt-2 text-sm text-stone-500">Gere um link seguro da versão exata do pedido para o cliente revisar e aprovar.</p>
        </div>
      </header>

      <Card className="mt-6 p-5">
        <label className="text-xs font-semibold">Pedido em rascunho</label>
        <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="mt-2 w-full rounded-xl border px-3 py-3 text-sm">
          <option value="">{loading ? "Carregando pedidos…" : "Selecione um pedido"}</option>
          {drafts.map((order) => (
            <option key={order.id} value={order.id}>{order.orderNumber ?? order.code} · {order.customer.name} · {money.format(Number(order.totalAmount))}</option>
          ))}
        </select>

        {!loading && !drafts.length && <div className="mt-4 rounded-xl bg-stone-50 p-4 text-xs text-stone-500">Nenhum pedido em rascunho disponível para envio.</div>}

        {selected && (
          <div className="mt-5">
            <div className="rounded-2xl bg-stone-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pedido</p><p className="mt-1 text-lg font-bold">{selected.orderNumber ?? selected.code}</p><p className="text-xs text-stone-500">{selected.customer.name}</p></div>
                <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Total</p><p className="mt-1 text-lg font-bold">{money.format(Number(selected.totalAmount))}</p></div>
              </div>
            </div>
            <OrderCustomerApprovalActions orderId={selected.id}/>
          </div>
        )}
      </Card>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-dashed p-4 text-xs text-stone-500"><Link2 size={15}/> O cliente recebe somente a versão comercial do pedido; dados internos do BBOS não são expostos.</div>
    </div>
  );
}
