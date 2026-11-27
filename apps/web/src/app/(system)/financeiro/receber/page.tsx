"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { ArrowLeft, Barcode, CalendarClock, CheckCircle2, CircleDollarSign, Copy, Printer, ReceiptText, X } from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { HORIZONS, agendaDays, horizonTotals, type HorizonKey } from "@/lib/receivable-agenda";
import { formatDigitableLine, itfBars } from "@/lib/boleto-barcode";

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

type Boleto = {
  id: string;
  accountsReceivableId: string;
  mode: "teste" | "sandbox" | "producao";
  status: "ISSUED" | "PAID" | "CANCELLED";
  ourNumber: string;
  digitableLine: string;
  barcode: string;
  pixCopyPaste: string | null;
  amount: string;
  dueDate: string;
  issuedByName: string | null;
  paidAt: string | null;
};
type BoletoMode = Boleto["mode"];

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
  const [boletos, setBoletos] = React.useState<Boleto[]>([]);
  const [boletoMode, setBoletoMode] = React.useState<BoletoMode>("teste");
  const [boletoFor, setBoletoFor] = React.useState<Receivable | null>(null);

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
      // Boletos are optional: the page works the same if this call fails.
      request<{ mode: BoletoMode; boletos: Boleto[] }>(`${API}/boletos`)
        .then((result) => { setBoletos(result.boletos ?? []); setBoletoMode(result.mode ?? "teste"); })
        .catch(() => setBoletos([]));
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

      {status === "ready" && (
        <DueAgenda rows={rows} onReceive={(row) => { setNotice(""); setSelected(row); }} />
      )}

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
          const boleto = boletos.find((item) => item.accountsReceivableId === row.id && item.status !== "CANCELLED");
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
                  <div className="flex flex-wrap gap-1.5">
                    <button data-bbos-write-action onClick={() => { setNotice(""); setSelected(row); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 font-bold text-emerald-800 transition hover:bg-emerald-100">
                      <CircleDollarSign size={15} /> Marcar como pago
                    </button>
                    <button data-bbos-write-action onClick={() => { setNotice(""); setBoletoFor(row); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 font-bold text-stone-700 transition hover:bg-stone-50">
                      <Barcode size={15} /> {boleto ? (boleto.status === "PAID" ? "Boleto pago" : "Ver boleto") : "Gerar boleto"}
                    </button>
                  </div>
                ) : row.payments?.length ? (
                  <span className="text-[10px] font-semibold text-stone-500">{row.payments.length} baixa{row.payments.length === 1 ? "" : "s"} registrada{row.payments.length === 1 ? "" : "s"}</span>
                ) : <span className="text-stone-400">—</span>}
              </div>
            </div>
          );
        })}
      </Card>
      {status === "ready" && <p className="mt-4 flex items-center gap-2 text-xs text-emerald-700"><CheckCircle2 size={14} />Somente registros persistidos no PostgreSQL.</p>}

      {boletoFor && (
        <BoletoDialog
          receivable={boletoFor}
          mode={boletoMode}
          boleto={boletos.find((item) => item.accountsReceivableId === boletoFor.id && item.status !== "CANCELLED") ?? null}
          onClose={() => setBoletoFor(null)}
          onChanged={(next, message) => {
            setBoletos((list) => [next, ...list.filter((item) => item.id !== next.id)]);
            if (message) setNotice(message);
          }}
          onCancelled={(id) => { setBoletos((list) => list.filter((item) => item.id !== id)); setBoletoFor(null); setNotice("Boleto de teste cancelado."); }}
        />
      )}

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

const HORIZON_TONE: Record<HorizonKey, { bar: string; text: string; ring: string }> = {
  overdue: { bar: "bg-red-600", text: "text-red-700", ring: "ring-red-300" },
  week: { bar: "bg-amber-500", text: "text-amber-800", ring: "ring-amber-300" },
  fortnight: { bar: "bg-teal-700", text: "text-teal-800", ring: "ring-teal-300" },
  month: { bar: "bg-emerald-500", text: "text-emerald-800", ring: "ring-emerald-300" },
  later: { bar: "bg-stone-400", text: "text-stone-700", ring: "ring-stone-300" },
};

/** Future due dates at a glance: horizons on one bar, then a day-by-day agenda. */
function DueAgenda({ rows, onReceive }: { rows: Receivable[]; onReceive: (row: Receivable) => void }) {
  const [horizon, setHorizon] = React.useState<HorizonKey | "next30">("next30");
  const totals = horizonTotals(rows);
  const grand = HORIZONS.reduce((sum, h) => sum + totals[h.key].amount, 0);
  const days = agendaDays(rows, horizon);
  if (!grand) return null;
  return (
    <section className="mt-6 rounded-2xl border border-stone-200 bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarClock size={18} className="text-teal-700" /> Próximos vencimentos</h2>
        <span className="text-sm text-stone-500">Em aberto: <b className="text-stone-900">{money.format(grand)}</b></span>
      </div>
      <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-stone-100" aria-hidden>
        {HORIZONS.map((h) => totals[h.key].amount > 0 && (
          <span key={h.key} className={HORIZON_TONE[h.key].bar} style={{ width: `${(totals[h.key].amount / grand) * 100}%` }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {HORIZONS.map((h) => {
          const active = horizon === h.key;
          const t = totals[h.key];
          return (
            <button
              key={h.key}
              type="button"
              aria-pressed={active}
              onClick={() => setHorizon(active ? "next30" : h.key)}
              className={`rounded-xl border border-stone-200 p-3 text-left transition hover:bg-stone-50 ${active ? `ring-2 ${HORIZON_TONE[h.key].ring}` : ""} ${t.count ? "" : "opacity-50"}`}
            >
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-stone-500"><i className={`inline-block size-2.5 rounded-sm ${HORIZON_TONE[h.key].bar}`} />{h.label}</span>
              <span className={`mt-1 block text-lg font-bold tabular-nums ${HORIZON_TONE[h.key].text}`}>{money.format(t.amount)}</span>
              <span className="text-xs text-stone-500">{t.count} título{t.count === 1 ? "" : "s"}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-4 text-xs font-semibold text-stone-500">
        {horizon === "next30" ? "Vencidos e próximos 30 dias, dia a dia" : `${HORIZONS.find((h) => h.key === horizon)!.label}, dia a dia`}
        {horizon !== "next30" && <button type="button" className="ml-2 font-bold text-forest-700 underline" onClick={() => setHorizon("next30")}>ver próximos 30 dias</button>}
      </p>
      <ol className="mt-2 divide-y divide-stone-100">
        {days.map((day) => (
          <li key={day.key} className="py-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className={`text-sm font-bold ${day.days < 0 ? "text-red-700" : day.days <= 1 ? "text-amber-800" : "text-stone-900"}`}>
                {day.label}{day.days < 0 ? ` · vencido há ${-day.days} dia${day.days === -1 ? "" : "s"}` : day.days > 1 ? ` · em ${day.days} dias` : ""}
              </span>
              <span className="text-sm font-bold tabular-nums">{money.format(day.total)}</span>
            </div>
            <ul className="mt-1.5 space-y-1.5">
              {day.rows.map((row) => (
                <li key={row.id} className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 rounded-xl bg-stone-50 px-3 py-2 sm:grid-cols-[1fr_auto_auto]">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{row.customer?.name ?? "Cliente não identificado"}</span>
                    <span className="text-xs text-stone-500">{row.salesOrder?.orderNumber ?? row.salesOrder?.code ?? row.invoiceId ?? "—"}{row.status === "PARTIALLY_PAID" ? " · parcial" : ""}</span>
                  </span>
                  <span className="text-sm font-bold tabular-nums">{money.format(Number(row.openAmount))}</span>
                  <button data-bbos-write-action type="button" onClick={() => onReceive(row)} className="col-span-2 inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50 sm:col-span-1">
                    <CircleDollarSign size={14} /> Recebido
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {!days.length && <li className="py-6 text-center text-sm text-stone-500">Nenhum vencimento neste período.</li>}
      </ol>
    </section>
  );
}

function ReceiptDialog({ receivable, accounts, onClose, onDone }: { receivable: Receivable; accounts: FinancialAccount[]; onClose: () => void; onDone: (message: string) => Promise<void> }) {
  // Conta do banco primeiro (a ordem alfabética punha uma conta digital como padrão).
  const [accountId, setAccountId] = React.useState(
    (accounts.find((a) => /ita[uú]|banco|bank/i.test(`${a.name} ${a.financialInstitution?.name ?? ""}`)) ??
      accounts.find((a) => !/frete|melhor envio|mercado pago/i.test(a.name)) ??
      accounts[0])?.id ?? "",
  );
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

const MODE_TEXT: Record<BoletoMode, string> = {
  teste: "Modo teste: nada é enviado ao Itaú e nenhuma conta é baixada.",
  sandbox: "Ambiente de testes do Itaú (sandbox): o boleto não vale para pagamento.",
  producao: "Boleto real, registrado no Itaú.",
};

function dateInput(value: string) {
  const due = new Date(value);
  const today = localDate();
  const iso = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(due.getDate()).padStart(2, "0")}`;
  return iso < today ? today : iso;
}

function BarcodeSvg({ digits }: { digits: string }) {
  const { bars, width } = itfBars(digits);
  return (
    <svg viewBox={`0 0 ${width} 50`} preserveAspectRatio="none" className="h-14 w-full max-w-[520px]" role="img" aria-label="Código de barras do boleto">
      {bars.map(([x, w], index) => <rect key={index} x={x} y={0} width={w} height={50} fill="#111" />)}
    </svg>
  );
}

/** Gera, mostra e imprime o boleto com Pix de uma conta a receber. */
function BoletoDialog({ receivable, mode, boleto, onClose, onChanged, onCancelled }: {
  receivable: Receivable;
  mode: BoletoMode;
  boleto: Boleto | null;
  onClose: () => void;
  onChanged: (boleto: Boleto, message?: string) => void;
  onCancelled: (id: string) => void;
}) {
  const [dueDate, setDueDate] = React.useState(dateInput(receivable.dueDate));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState("");
  const shown = boleto;
  const isTest = (shown?.mode ?? mode) !== "producao";
  const customer = receivable.customer?.name ?? "Cliente";

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await action(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível concluir."); } finally { setBusy(false); }
  };
  const issue = () => run(async () => {
    const result = await request<{ boleto: Boleto }>(`${API}/boletos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ receivableId: receivable.id, dueDate }) });
    onChanged(result.boleto, `Boleto ${result.boleto.mode === "producao" ? "emitido" : "de teste gerado"} para ${customer}.`);
  });
  const simulate = () => run(async () => {
    if (!shown) return;
    const result = await request<{ boleto: Boleto; message: string }>(`${API}/boletos/${shown.id}/simulate-payment`, { method: "POST" });
    onChanged(result.boleto, result.message);
  });
  const cancel = () => run(async () => {
    if (!shown) return;
    await request(`${API}/boletos/${shown.id}/cancel`, { method: "POST" });
    onCancelled(shown.id);
  });
  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(what); } catch { setCopied(""); }
  };

  if (typeof document === "undefined") return null;
  // Portal: the page sits in a stacking context below the mobile dock.
  return createPortal(
    <div className="fixed inset-0 z-[90] grid place-items-end bg-stone-950/40 p-0 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="boleto-dialog-title">
      <style>{"@media print{body *{visibility:hidden}.boleto-print,.boleto-print *{visibility:visible}.boleto-print{position:absolute;inset:0 auto auto 0;max-height:none!important;overflow:visible!important;box-shadow:none!important}}"}</style>
      <div className="boleto-print max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 print:hidden">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">{customer}</p>
            <h2 id="boleto-dialog-title" className="mt-1 text-lg font-bold">{shown ? "Boleto com Pix" : "Gerar boleto com Pix"}</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={busy} className="grid size-11 place-items-center rounded-xl border text-stone-500"><X size={17} /></button>
        </div>

        {isTest && <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">{MODE_TEXT[shown?.mode ?? mode]}</p>}

        {!shown ? (
          <div className="mt-4 space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-xs text-stone-500">Valor em aberto</dt><dd className="text-lg font-bold">{money.format(Number(receivable.openAmount))}</dd></div>
              <div><dt className="text-xs text-stone-500">Pedido / NF</dt><dd className="font-semibold">{receivable.salesOrder?.orderNumber ?? receivable.salesOrder?.code ?? receivable.invoiceId ?? "—"}</dd></div>
            </dl>
            <label className="block text-xs font-bold text-stone-600">Vencimento do boleto
              <input type="date" min={localDate()} value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={field} />
            </label>
            <p className="text-sm text-stone-700">Emitir boleto de <b>{money.format(Number(receivable.openAmount))}</b> para <b>{customer}</b>, vencimento <b>{date.format(new Date(`${dueDate}T12:00:00`))}</b>?</p>
            <p className="text-xs text-stone-500">O cliente precisa ter CPF/CNPJ, endereço, cidade, UF e CEP no cadastro.</p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-stone-200 p-4 text-sm">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-stone-100 pb-3">
              <span className="text-base font-bold">Itaú <span className="font-mono text-stone-500">341-7</span></span>
              <span className="font-mono text-[13px] font-semibold tracking-tight">{formatDigitableLine(shown.digitableLine)}</span>
            </div>
            {isTest && <p className="mt-2 text-center text-xs font-black uppercase tracking-[.3em] text-amber-700">Boleto de teste · não pagar</p>}
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><dt className="text-[11px] text-stone-500">Beneficiário</dt><dd className="font-semibold">Bispo Coffees Ltda</dd></div>
              <div><dt className="text-[11px] text-stone-500">Pagador</dt><dd className="font-semibold">{customer}</dd></div>
              <div><dt className="text-[11px] text-stone-500">Vencimento</dt><dd className="font-semibold">{date.format(new Date(shown.dueDate))}</dd></div>
              <div><dt className="text-[11px] text-stone-500">Valor</dt><dd className="font-bold">{money.format(Number(shown.amount))}</dd></div>
              <div><dt className="text-[11px] text-stone-500">{receivable.invoiceId ? "NF-e" : "Pedido"}</dt><dd className="font-semibold">{receivable.invoiceId ? `nº ${receivable.invoiceId.replace(/^0+(?=\d)/, "")}` : receivable.salesOrder?.orderNumber ?? receivable.salesOrder?.code ?? "—"}</dd></div>
              <div><dt className="text-[11px] text-stone-500">Nosso número</dt><dd className="font-mono">109/{shown.ourNumber}</dd></div>
              <div><dt className="text-[11px] text-stone-500">Situação</dt><dd>{shown.status === "PAID" ? <Badge tone="success">Pago{shown.paidAt ? ` em ${date.format(new Date(shown.paidAt))}` : ""}</Badge> : <Badge tone="neutral">Em aberto</Badge>}</dd></div>
            </dl>
            <div className="mt-4"><BarcodeSvg digits={shown.barcode} /></div>
            {shown.pixCopyPaste && (
              <div className="mt-3 rounded-lg bg-stone-50 p-3">
                <p className="text-[11px] font-bold text-stone-500">Pix copia e cola</p>
                <p className="mt-1 break-all font-mono text-[11px]">{shown.pixCopyPaste}</p>
              </div>
            )}
          </div>
        )}

        {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-800" role="alert">{error}</p>}
        {copied && <p className="mt-3 text-xs font-semibold text-emerald-700" role="status">{copied} copiada.</p>}

        <div className="mt-5 flex flex-wrap justify-end gap-2 print:hidden">
          {!shown ? (
            <>
              <button type="button" onClick={onClose} disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-bold text-stone-700">Cancelar</button>
              <button data-bbos-write-action type="button" onClick={issue} disabled={busy || !dueDate} className="min-h-11 rounded-xl bg-forest-900 px-5 text-sm font-bold text-white disabled:bg-stone-200 disabled:text-stone-500">{busy ? "Gerando…" : mode === "producao" ? "Emitir boleto" : "Gerar boleto de teste"}</button>
            </>
          ) : (
            <>
              {shown.status === "ISSUED" && shown.mode === "teste" && (
                <>
                  <button data-bbos-write-action type="button" onClick={cancel} disabled={busy} className="min-h-11 rounded-xl border px-4 text-sm font-bold text-stone-700">Cancelar boleto</button>
                  <button data-bbos-write-action type="button" onClick={simulate} disabled={busy} className="min-h-11 rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-bold text-amber-900">Simular pagamento</button>
                </>
              )}
              {shown.pixCopyPaste && <button type="button" onClick={() => copy(shown.pixCopyPaste!, "Chave Pix")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold text-stone-700"><Copy size={15} /> Copiar Pix</button>}
              <button type="button" onClick={() => copy(shown.digitableLine, "Linha digitável")} className="inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold text-stone-700"><Copy size={15} /> Copiar linha</button>
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-bold text-white"><Printer size={15} /> Imprimir / PDF</button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
