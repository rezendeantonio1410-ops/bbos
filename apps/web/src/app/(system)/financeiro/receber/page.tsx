"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleDollarSign, ReceiptText, X } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Payment = {
  id: string;
  amount: number | string;
  paidAt: string;
  method: string;
  notes?: string | null;
};

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
  payments?: Payment[];
};

type FinancialAccount = {
  id: string;
  name: string;
  currency: string;
  financialInstitution?: { name?: string | null } | null;
};

type Filter = "Todas" | "A vencer" | "Vencidos" | "Parcial" | "Pagos";

const API = `${getApiBaseUrl()}/finance`;
const filters: Filter[] = ["Todas", "A vencer", "Vencidos", "Parcial", "Pagos"];
const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = new Intl.DateTimeFormat("pt-BR");
const field = "mt-1.5 min-h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm outline-none transition focus:border-forest-700";

function displayStatus(row: Receivable) {
  if (row.status === "PAID") return "Pago";
  if (row.status === "CANCELLED") return "Cancelado";
  if (row.status === "PARTIALLY_PAID") return "Parcial";
  if (row.status === "OVERDUE" || new Date(row.dueDate) < new Date()) return "Vencido";
  return "A vencer";
}

function localDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível concluir a operação.");
  return body;
}

export default function ReceivablesPage() {
  const [rows, setRows] = React.useState<Receivable[]>([]);
  const [accounts, setAccounts] = React.useState<FinancialAccount[]>([]);
  const [filter, setFilter] = React.useState<Filter>("Todas");
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [selected, setSelected] = React.useState<Receivable | null>(null);
  const [notice, setNotice] = React.useState("");

  const load = React.useCallback(async () => {
    setStatus("loading");
    try {
      const [nextRows, nextAccounts] = await Promise.all([
        request<Receivable[]>(`${API}/receivables`),
        request<FinancialAccount[]>(`${API}/accounts`),
      ]);
      setRows(Array.isArray(nextRows) ? nextRows : []);
      setAccounts(Array.isArray(nextAccounts) ? nextAccounts : []);
      setStatus("ready");
    } catch {
      setRows([]);
      setAccounts([]);
      setStatus("error");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const visibleRows = rows.filter((row) => {
    const label = displayStatus(row);
    if (filter === "Vencidos") return label === "Vencido";
    if (filter === "Pagos") return label === "Pago";
    return filter === "Todas" || label === filter;
  });

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <Link href="/financeiro" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-forest-700">
        <ArrowLeft size={14} /> Financeiro
      </Link>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Contas a receber</h1>
          <p className="mt-2 text-sm text-stone-500">Recebíveis reais gerados pelos pedidos faturados.</p>
        </div>
        <span className={`rounded-full px-3 py-2 text-[10px] font-bold ${status === "ready" ? "bg-emerald-50 text-emerald-800" : status === "error" ? "bg-red-50 text-red-800" : "bg-stone-100 text-stone-600"}`}>
          {status === "ready" ? "Dados reais do PostgreSQL" : status === "error" ? "Falha ao carregar" : "Carregando…"}
        </span>
      </div>

      {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">{notice}</p>}

      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button key={item} onClick={() => setFilter(item)} className={`min-h-11 rounded-xl border px-3 text-xs font-semibold ${filter === item ? "border-forest-900 bg-forest-900 text-white" : "border-stone-200 bg-white text-stone-600"}`}>
            {item}
          </button>
        ))}
      </div>

      <Card className="mt-5 overflow-hidden p-0">
        <div className="hidden grid-cols-[1.3fr_1fr_.8fr_.8fr_.8fr_.8fr_.7fr_1fr] gap-3 border-b bg-stone-50 p-4 text-[10px] font-bold uppercase tracking-wide text-stone-500 lg:grid">
          <span>Cliente</span><span>Documento</span><span>Emissão</span><span>Vencimento</span><span>Valor</span><span>Aberto</span><span>Status</span><span>Ação</span>
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
          const canReceive = !["Pago", "Cancelado"].includes(label) && Number(row.openAmount) > 0;
          return (
            <div key={row.id} className="grid gap-3 border-b border-stone-100 p-4 text-xs lg:grid-cols-[1.3fr_1fr_.8fr_.8fr_.8fr_.8fr_.7fr_1fr] lg:items-center">
              <span className="font-semibold">{row.customer?.name ?? "Cliente não identificado"}</span>
              <span className="text-stone-500">{row.invoiceId ?? row.salesOrder?.orderNumber ?? row.salesOrder?.code ?? "—"}</span>
              <span className="text-stone-500"><span className="mr-1 font-semibold text-stone-400 lg:hidden">Emissão:</span>{date.format(new Date(row.issueDate))}</span>
              <span><span className="mr-1 font-semibold text-stone-400 lg:hidden">Vencimento:</span>{date.format(new Date(row.dueDate))}</span>
              <span><span className="mr-1 font-semibold text-stone-400 lg:hidden">Valor:</span>{money.format(Number(row.amount || 0))}</span>
              <span className="font-bold"><span className="mr-1 font-semibold text-stone-400 lg:hidden">Aberto:</span>{money.format(Number(row.openAmount || 0))}</span>
              <div><Badge tone={label === "Vencido" ? "danger" : label === "Parcial" ? "warning" : label === "Pago" ? "success" : "neutral"}>{label}</Badge></div>
              <div>
                {canReceive ? (
                  <button onClick={() => { setNotice(""); setSelected(row); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 font-bold text-emerald-800 transition hover:bg-emerald-100">
                    <CircleDollarSign size={15} /> Marcar como pago
                  </button>
                ) : row.payments?.length ? (
                  <span className="text-[10px] font-semibold text-stone-500">{row.payments.length} baixa{row.payments.length === 1 ? "" : "s"} registrada{row.payments.length === 1 ? "" : "s"}</span>
                ) : <span className="text-stone-400">—</span>}
              </div>
            </div>
          );
        })}
      </Card>
      {status === "ready" && <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={14} />Somente registros persistidos no PostgreSQL.</p>}

      {selected && (
        <ReceiptDialog
          receivable={selected}
          accounts={accounts}
          onClose={() => setSelected(null)}
          onDone={async (message) => {
            setSelected(null);
            setNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function ReceiptDialog({ receivable, accounts, onClose, onDone }: { receivable: Receivable; accounts: FinancialAccount[]; onClose: () => void; onDone: (message: string) => Promise<void> }) {
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = React.useState(Number(receivable.openAmount).toFixed(2));
  const [paidAt, setPaidAt] = React.useState(localDate());
  const [method, setMethod] = React.useState("PIX");
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [idempotencyKey] = React.useState(() => crypto.randomUUID());
  const openAmount = Number(receivable.openAmount);
  const numericAmount = Number(amount);
  const isFull = Number.isFinite(numericAmount) && Math.abs(numericAmount - openAmount) < 0.005;
  const valid = Boolean(accountId && paidAt && numericAmount > 0 && numericAmount <= openAmount);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError("");
    try {
      const paidAtIso = (paidAt === localDate() ? new Date() : new Date(`${paidAt}T12:00:00`)).toISOString();
      await request(`${API}/receivables/${receivable.id}/payments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          financialAccountId: accountId,
          amount: numericAmount,
          paidAt: paidAtIso,
          method,
          notes,
          idempotencyKey,
        }),
      });
      await onDone(isFull ? "Pagamento registrado. O título foi marcado como pago." : "Pagamento parcial registrado. O saldo em aberto foi atualizado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível registrar o pagamento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true" aria-labelledby="receipt-dialog-title">
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto p-0">
        <header className="flex items-start justify-between border-b px-5 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-700">Baixa financeira controlada</p>
            <h2 id="receipt-dialog-title" className="mt-1 text-lg font-bold">Registrar pagamento recebido</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={busy} className="grid size-11 place-items-center rounded-xl border text-stone-500"><X size={17} /></button>
        </header>

        <form onSubmit={submit} className="p-5">
          <div className="rounded-xl bg-stone-50 p-4 text-sm">
            <p className="font-bold">{receivable.customer?.name ?? "Cliente não identificado"}</p>
            <p className="mt-1 text-xs text-stone-500">Documento {receivable.invoiceId ?? receivable.salesOrder?.orderNumber ?? receivable.salesOrder?.code ?? "não informado"}</p>
            <div className="mt-3 flex items-center justify-between border-t pt-3"><span className="text-xs text-stone-500">Saldo em aberto</span><strong>{money.format(openAmount)}</strong></div>
          </div>

          {accounts.length === 0 ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              Nenhuma conta financeira ativa está cadastrada. <Link href="/financeiro/bancos-contas" className="font-bold underline">Cadastre uma conta antes de registrar a baixa.</Link>
            </div>
          ) : (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-xs font-bold sm:col-span-2">Conta de recebimento
                <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required className={field}>
                  <option value="">Selecione</option>
                  {accounts.map((account) => <option key={account.id} value={account.id}>{account.financialInstitution?.name ?? "Sem banco"} · {account.name} ({account.currency})</option>)}
                </select>
              </label>
              <label className="text-xs font-bold">Valor recebido
                <input type="number" min="0.01" max={openAmount} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required className={field} />
              </label>
              <label className="text-xs font-bold">Data do recebimento
                <input type="date" max={localDate()} value={paidAt} onChange={(event) => setPaidAt(event.target.value)} required className={field} />
              </label>
              <label className="text-xs font-bold sm:col-span-2">Forma de pagamento
                <select value={method} onChange={(event) => setMethod(event.target.value)} className={field}>
                  <option value="PIX">Pix</option>
                  <option value="BANK_TRANSFER">Transferência bancária</option>
                  <option value="CASH">Dinheiro</option>
                  <option value="CREDIT_CARD">Cartão de crédito</option>
                  <option value="DEBIT_CARD">Cartão de débito</option>
                  <option value="BOLETO">Boleto</option>
                  <option value="OTHER">Outro</option>
                </select>
              </label>
              <label className="text-xs font-bold sm:col-span-2">Observação (opcional)
                <textarea value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={500} rows={3} placeholder="Ex.: comprovante, referência bancária ou observação interna" className={`${field} py-3`} />
              </label>
            </div>
          )}

          <p className="mt-4 text-[11px] leading-relaxed text-stone-500">A confirmação cria o pagamento e a movimentação financeira no histórico. Se o valor for menor que o saldo, o título permanecerá parcialmente pago.</p>
          {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
          <footer className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-bold text-stone-700">Cancelar</button>
            <button type="submit" disabled={!valid || busy || accounts.length === 0} className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500">
              {busy ? "Registrando…" : isFull ? "Confirmar e marcar como pago" : "Registrar pagamento parcial"}
            </button>
          </footer>
        </form>
      </Card>
    </div>
  );
}
