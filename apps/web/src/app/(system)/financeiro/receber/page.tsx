"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ReceiptText } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Receivable = {
  id: string;
  invoiceId?: string | null;
  issueDate: string;
  dueDate: string;
  amount: number | string;
  openAmount: number | string;
  status: string;
  customer?: { name?: string | null } | null;
  salesOrder?: { code?: string | null; orderNumber?: string | null } | null;
};

type Filter = "Todas" | "A vencer" | "Vencidos" | "Parcial" | "Pagos";

const filters: Filter[] = ["Todas", "A vencer", "Vencidos", "Parcial", "Pagos"];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");

function displayStatus(row: Receivable) {
  if (row.status === "PAID") return "Pago";
  if (row.status === "CANCELLED") return "Cancelado";
  if (row.status === "PARTIAL") return "Parcial";
  if (row.status === "OVERDUE" || new Date(row.dueDate) < new Date()) return "Vencido";
  return "A vencer";
}

export default function ReceivablesPage() {
  const [rows, setRows] = React.useState<Receivable[]>([]);
  const [filter, setFilter] = React.useState<Filter>("Todas");
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");

  React.useEffect(() => {
    const controller = new AbortController();
    fetch(`${getApiBaseUrl()}/finance/receivables`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os recebíveis.");
        return response.json() as Promise<Receivable[]>;
      })
      .then((result) => {
        setRows(Array.isArray(result) ? result : []);
        setStatus("ready");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setRows([]);
        setStatus("error");
      });
    return () => controller.abort();
  }, []);

  const visibleRows = rows.filter((row) => {
    const label = displayStatus(row);
    if (filter === "Vencidos") return label === "Vencido";
    if (filter === "Pagos") return label === "Pago";
    return filter === "Todas" || label === filter;
  });

  return (
    <div className="mx-auto max-w-[1500px]">
      <Link href="/financeiro" className="inline-flex items-center gap-2 text-xs font-bold text-forest-700">
        <ArrowLeft size={14} /> Financeiro
      </Link>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas a receber</h1>
          <p className="mt-2 text-sm text-stone-500">Recebíveis reais gerados pelos pedidos faturados.</p>
        </div>
        <span className={`rounded-full px-3 py-2 text-[10px] font-bold ${status === "ready" ? "bg-emerald-50 text-emerald-800" : status === "error" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-600"}`}>
          {status === "ready" ? "Dados reais do PostgreSQL" : status === "error" ? "Falha ao carregar" : "Carregando…"}
        </span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`rounded-xl border px-3 py-2 text-xs font-semibold ${filter === item ? "border-forest-900 bg-forest-900 text-white" : "border-stone-200 bg-white text-stone-600"}`}>
            {item}
          </button>
        ))}
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="hidden grid-cols-7 gap-3 border-b bg-stone-50 p-4 text-[10px] font-bold uppercase tracking-wide text-stone-500 md:grid">
          <span>Cliente</span><span>Documento</span><span>Emissão</span><span>Vencimento</span><span>Valor</span><span>Aberto</span><span>Status</span>
        </div>
        {status === "loading" ? (
          <div className="p-12 text-center text-sm text-stone-500">Carregando recebíveis reais…</div>
        ) : status === "error" ? (
          <div className="p-12 text-center text-sm text-red-700">Não foi possível confirmar os dados no banco. Nenhum valor substituto foi exibido.</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-12 text-center">
            <ReceiptText className="mx-auto text-stone-300" />
            <p className="mt-3 font-semibold">Nenhum recebível nesta seleção</p>
            <p className="mt-1 text-sm text-stone-500">Os próximos registros aparecerão após o faturamento real dos pedidos.</p>
          </div>
        ) : visibleRows.map((row) => {
          const label = displayStatus(row);
          return (
            <div key={row.id} className="grid gap-2 border-b border-stone-100 p-4 text-xs md:grid-cols-7 md:items-center">
              <span className="font-semibold">{row.customer?.name ?? "Cliente não identificado"}</span>
              <span className="text-stone-500">{row.invoiceId ?? row.salesOrder?.orderNumber ?? row.salesOrder?.code ?? "—"}</span>
              <span className="text-stone-500">{date.format(new Date(row.issueDate))}</span>
              <span>{date.format(new Date(row.dueDate))}</span>
              <span>{money.format(Number(row.amount || 0))}</span>
              <span className="font-bold">{money.format(Number(row.openAmount || 0))}</span>
              <Badge tone={label === "Vencido" ? "danger" : label === "Parcial" ? "warning" : label === "Pago" ? "success" : "neutral"}>{label}</Badge>
            </div>
          );
        })}
      </Card>
      {status === "ready" && <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={14} />Somente registros persistidos no PostgreSQL.</p>}
    </div>
  );
}
