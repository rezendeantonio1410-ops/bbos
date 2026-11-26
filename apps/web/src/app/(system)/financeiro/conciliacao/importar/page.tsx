"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FileUp, Loader2, AlertTriangle } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

/**
 * Importar extrato (PDF "Entradas e Saídas" do Itaú ou OFX): o BBOS liga
 * cada lançamento ao que já existe e sugere o resto. Nada é gravado antes de
 * "Aplicar selecionados" (rascunho aprovado em 26/11).
 */

type Allocation = { kind: "PAYABLE" | "INSTALLMENT"; id: string; label: string; amount: number; open: number };
type Settlement = { lines: string[]; allocations: Allocation[]; extra: number; extraCategory: string };
type Line = { externalId: string; date: string; description: string; counterparty: string; taxId: string; amount: number };
type Plan = {
  line: Line;
  group: "ALREADY" | "SETTLE" | "EXPENSE" | "INCOME";
  matchedPayment?: { id: string; name: string; differentPayer: boolean };
  settlement?: Settlement;
  suggestion?: { category: string; sure: boolean; note?: string };
  alreadyApplied: boolean;
};
type Preview = {
  account: { id: string; name: string; bank: string };
  statement: { bank: string; agency: string | null; account: string | null; from: string | null; to: string | null; openingBalance: number | null; closingBalance: number | null };
  balance: { inflow: number; outflow: number; computed: number | null; ok: boolean | null; difference: number | null };
  categories: { expense: string[]; income: string[] };
  cashStart?: { date: string | null; balance: number | null };
  canSetBalance?: boolean;
  lines: Plan[];
};
type Account = { id: string; name: string; financialInstitution?: { name?: string | null } | null };
type Choice = { on: boolean; category: string; extraCategory?: string };
type Result = { balanceUpdated?: { date: string; balance: number } | null; learnedRecurring?: number; applied: number; skipped: number; errors: number; results: Array<{ externalId: string; status: string; message: string }> };

const API = `${getApiBaseUrl()}/finance`;
const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const day = (iso: string | null) => (iso ? iso.split("-").reverse().slice(0, 2).join("/") : "—");
const fullDay = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");
const card = "rounded-[14px] border border-[var(--bbos-border)] bg-white";
const select = "max-w-full rounded-lg border border-[var(--bbos-border)] bg-white px-2 py-1.5 text-[13px]";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível concluir.");
  return body;
}

function toBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export default function ImportStatementPage() {
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [accountId, setAccountId] = React.useState("");
  const [file, setFile] = React.useState<{ name: string; content: string } | null>(null);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [choices, setChoices] = React.useState<Record<string, Choice>>({});
  const [busy, setBusy] = React.useState<"" | "reading" | "applying">("");
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<Result | null>(null);
  const [useBalance, setUseBalance] = React.useState(true);

  React.useEffect(() => {
    void request<Account[]>(`${API}/accounts`).then((list) => {
      setAccounts(list);
      setAccountId((list.find((a) => /ita[uú]/i.test(`${a.name} ${a.financialInstitution?.name ?? ""}`)) ?? list[0])?.id ?? "");
    }).catch(() => setAccounts([]));
  }, []);

  const read = async (picked: File) => {
    setError("");
    setResult(null);
    setBusy("reading");
    try {
      const content = await toBase64(picked);
      const data = await request<Preview>(`${API}/statement-import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialAccountId: accountId, fileName: picked.name, contentBase64: content }),
      });
      setFile({ name: picked.name, content });
      setPreview(data);
      const next: Record<string, Choice> = {};
      for (const plan of data.lines) {
        const category = plan.suggestion?.category ?? "";
        next[plan.line.externalId] = {
          on: !plan.alreadyApplied && (plan.group === "ALREADY" || plan.group === "SETTLE" || Boolean(plan.suggestion?.sure)),
          category,
          extraCategory: plan.settlement?.extraCategory,
        };
      }
      setChoices(next);
    } catch (reason) {
      setPreview(null);
      setError(reason instanceof Error ? reason.message : "Não foi possível ler o extrato.");
    } finally {
      setBusy("");
    }
  };

  const groups = React.useMemo(() => {
    const lines = preview?.lines ?? [];
    return {
      ALREADY: lines.filter((p) => p.group === "ALREADY"),
      SETTLE: lines.filter((p) => p.group === "SETTLE"),
      EXPENSE: lines.filter((p) => p.group === "EXPENSE"),
      INCOME: lines.filter((p) => p.group === "INCOME"),
    };
  }, [preview]);

  const set = (id: string, patch: Partial<Choice>) => setChoices((current) => ({ ...current, [id]: { ...current[id]!, ...patch } }));
  const selected = (preview?.lines ?? []).filter((p) => choices[p.line.externalId]?.on && !p.alreadyApplied);
  const missingCategory = selected.filter((p) => (p.group === "EXPENSE" || p.group === "INCOME") && !choices[p.line.externalId]?.category);
  const settleTotal = Array.from(new Set(selected.filter((p) => p.group === "SETTLE").map((p) => p.settlement!))).reduce((sum, s) => sum + s.allocations.reduce((t, a) => t + a.amount, 0) + s.extra, 0);
  const expenseTotal = selected.filter((p) => p.group === "EXPENSE").reduce((sum, p) => sum - p.line.amount, 0);

  const apply = async () => {
    if (!preview || !file) return;
    if (missingCategory.length) return setError(`Escolha a categoria de ${missingCategory.length} ${missingCategory.length === 1 ? "lançamento" : "lançamentos"} marcados.`);
    setError("");
    setBusy("applying");
    try {
      const decisions = selected.map((plan) => {
        const choice = choices[plan.line.externalId]!;
        if (plan.group === "ALREADY") return { externalId: plan.line.externalId, action: "ALREADY", paymentId: plan.matchedPayment!.id };
        if (plan.group === "SETTLE") return { externalId: plan.line.externalId, action: "SETTLE", extraCategory: choice.extraCategory };
        return { externalId: plan.line.externalId, action: plan.group, category: choice.category };
      });
      const data = await request<Result>(`${API}/statement-import/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialAccountId: accountId, fileName: file.name, contentBase64: file.content, decisions, useClosingBalance: balanceOffer && useBalance }),
      });
      setResult(data);
      // Recarrega a prévia: o que foi aplicado aparece como feito.
      const again = await request<Preview>(`${API}/statement-import/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financialAccountId: accountId, fileName: file.name, contentBase64: file.content }),
      });
      setPreview(again);
      setChoices((current) => Object.fromEntries(again.lines.map((p) => [p.line.externalId, { ...current[p.line.externalId]!, on: Boolean(current[p.line.externalId]?.on) && !p.alreadyApplied }])));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível aplicar.");
    } finally {
      setBusy("");
    }
  };

  const total = preview?.lines.length ?? 0;
  // O saldo final do extrato vira o saldo do caixa (só se for mais novo que o atual).
  const balanceOffer = Boolean(preview?.canSetBalance && preview.statement.closingBalance !== null && preview.statement.to &&
    (!preview.cashStart?.date || preview.cashStart.date <= preview.statement.to));
  const bar = [
    ["ALREADY", "var(--bbos-success, #1f6b4f)", "já conciliado"],
    ["SETTLE", "#3f8f6c", "dar baixa em conta aberta"],
    ["EXPENSE", "#c99a3b", "lançar despesa"],
    ["INCOME", "#b9c4bf", "entradas a classificar"],
  ] as const;

  return (
    <div className="mx-auto max-w-[1180px] pb-16">
      <Link href="/financeiro/conciliacao" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14} /> Conciliação</Link>
      <h1 className="mt-2 text-3xl font-bold">Importar extrato do banco</h1>
      <p className="mt-1 text-sm text-[var(--bbos-text-secondary)]">Envie o extrato e o BBOS liga cada lançamento ao que já existe. Nada é baixado sem o seu OK.</p>

      <div className={`${card} mt-4 grid gap-3 p-4 sm:grid-cols-[1fr_auto] sm:items-center`}>
        <div className="grid gap-3 sm:grid-cols-[260px_1fr] sm:items-center">
          <label className="text-xs font-bold text-[var(--bbos-text-secondary)]">Conta
            <select className={`${select} mt-1 block w-full`} value={accountId} onChange={(e) => { setAccountId(e.target.value); setPreview(null); }}>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </label>
          <div className="text-sm">
            {preview ? (
              <>
                <b>{file?.name}</b>
                <div className="text-xs text-[var(--bbos-text-secondary)]">{preview.statement.bank}{preview.statement.agency ? ` · ag. ${preview.statement.agency}` : ""}{preview.statement.account ? ` · cc ${preview.statement.account}` : ""} · {fullDay(preview.statement.from)} a {fullDay(preview.statement.to)} · {total} lançamentos</div>
                {preview.balance.ok === true && <div className="mt-1 text-xs font-bold text-emerald-700">✓ Saldo confere: {brl.format(preview.statement.openingBalance ?? 0)} + {brl.format(preview.balance.inflow)} − {brl.format(preview.balance.outflow)} = {brl.format(preview.balance.computed ?? 0)}{preview.balance.difference ? ` (banco: ${brl.format(preview.statement.closingBalance ?? 0)})` : ""}</div>}
                {preview.balance.ok === false && <div className="mt-1 text-xs font-bold text-red-700">⚠ O saldo não fecha: faltam {brl.format(preview.balance.difference ?? 0)}. Confira se o arquivo está completo.</div>}
              </>
            ) : <span className="text-[var(--bbos-text-secondary)]">PDF “Entradas e Saídas” do Itaú ou arquivo OFX do banco.</span>}
          </div>
        </div>
        <label className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold ${preview ? "border bg-white" : "bg-forest-900 text-white"} ${!accountId ? "pointer-events-none opacity-50" : ""}`}>
          {busy === "reading" ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
          {busy === "reading" ? "Lendo extrato…" : preview ? "Trocar arquivo" : "Escolher extrato"}
          <input type="file" accept=".pdf,.ofx,application/pdf" className="sr-only" disabled={!accountId || busy !== ""} onChange={(e) => { const f = e.target.files?.[0]; if (f) void read(f); e.target.value = ""; }} />
        </label>
      </div>

      {error && <p className="mt-3 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800" role="alert"><AlertTriangle size={15} />{error}</p>}
      {result && (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800" role="status">
          <CheckCircle2 size={15} /> {result.applied} aplicado(s){result.skipped ? ` · ${result.skipped} já estavam feitos` : ""}{result.errors ? ` · ${result.errors} com erro (veja abaixo)` : ""}.
          {result.balanceUpdated ? ` Saldo do caixa: ${brl.format(result.balanceUpdated.balance)} em ${fullDay(result.balanceUpdated.date)}.` : ""}
          {result.learnedRecurring ? ` ${result.learnedRecurring} despesa(s) fixa(s) entraram na previsão do caixa.` : ""}
        </p>
      )}
      {result?.errors ? (
        <ul className="mt-2 space-y-1 text-xs text-red-800">{result.results.filter((r) => r.status === "ERROR").map((r) => {
          const line = preview?.lines.find((p) => p.line.externalId === r.externalId)?.line;
          return <li key={r.externalId}>{line ? `${day(line.date)} · ${line.counterparty || line.description} · ${brl.format(line.amount)}: ` : ""}{r.message}</li>;
        })}</ul>
      ) : null}

      {preview && (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Entradas" value={`+${brl.format(preview.balance.inflow)}`} tone="text-emerald-700" />
            <Kpi label="Saídas" value={`−${brl.format(preview.balance.outflow)}`} />
            <Kpi label="Já no BBOS" value={`${groups.ALREADY.length}`} sub={`de ${total}`} />
            <Kpi label="Para você decidir" value={`${total - groups.ALREADY.length}`} tone="text-amber-700" />
          </div>
          <div className="mt-3 flex h-2.5 overflow-hidden rounded-full bg-stone-100" aria-hidden>
            {bar.map(([key, color]) => <span key={key} style={{ width: `${(groups[key].length / Math.max(1, total)) * 100}%`, background: color }} />)}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-xs text-[var(--bbos-text-secondary)]">
            {bar.map(([key, color, label]) => <span key={key}><i className="mr-1 inline-block size-2 rounded-sm" style={{ background: color }} />{label} ({groups[key].length})</span>)}
          </div>

          <Group title="1 · Já está no BBOS" hint="Mesmo valor e data de um recebimento ou pagamento já registrado" plans={groups.ALREADY} choices={choices} onToggle={(id, on) => set(id, { on })}
            render={(p) => <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${p.matchedPayment?.differentPayer ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>= {p.matchedPayment?.name}{p.matchedPayment?.differentPayer ? " · pagador diferente" : ""}</span>} />

          <Group title="2 · Dar baixa em contas que estão abertas" hint="O banco mostra que foi pago; no BBOS ainda está em aberto" plans={groups.SETTLE} choices={choices} onToggle={(id, on) => {
            // Pix somados para a mesma conta andam juntos.
            const plan = groups.SETTLE.find((p) => p.line.externalId === id);
            for (const other of plan?.settlement?.lines ?? [id]) set(other, { on });
          }}
            render={(p) => (
              <div>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-800">→ {p.settlement!.allocations.map((a) => `${a.label} · ${brl.format(a.amount)}${a.amount < a.open ? ` de ${brl.format(a.open)} (parcial)` : ""}`).join(" + ")}</span>
                {p.settlement!.lines.length > 1 && p.settlement!.lines[0] === p.line.externalId && <div className="mt-1 text-xs text-[var(--bbos-text-secondary)]">{p.settlement!.lines.length} lançamentos somados</div>}
                {p.settlement!.extra > 0 && p.settlement!.lines[0] === p.line.externalId && (
                  <div className="mt-1 text-xs font-bold text-amber-800">Diferença de {brl.format(p.settlement!.extra)} · <select className={select} value={choices[p.line.externalId]?.extraCategory ?? ""} onChange={(e) => { for (const id of p.settlement!.lines) set(id, { extraCategory: e.target.value }); }}>{preview.categories.expense.map((c) => <option key={c}>{c}</option>)}</select></div>
                )}
              </div>
            )} />

          <Group title="3 · Lançar como despesa paga" hint="Categoria sugerida pelo nome; mude se precisar. O BBOS lembra a escolha no próximo mês." plans={groups.EXPENSE} choices={choices} onToggle={(id, on) => set(id, { on })}
            render={(p) => <CategorySelect options={preview.categories.expense} value={choices[p.line.externalId]?.category ?? ""} note={p.suggestion?.note} onChange={(category) => set(p.line.externalId, { category, on: Boolean(category) })} />} />

          <Group title="4 · Entradas sem conta a receber" hint="Não viraram venda no BBOS. Diga o que são." plans={groups.INCOME} choices={choices} onToggle={(id, on) => set(id, { on })}
            render={(p) => <CategorySelect options={preview.categories.income} value={choices[p.line.externalId]?.category ?? ""} note={p.suggestion?.note} onChange={(category) => set(p.line.externalId, { category, on: Boolean(category) })} />} />

          <div className={`${card} sticky bottom-3 mt-4 flex flex-wrap items-center justify-between gap-3 p-3 pr-3 shadow-lg sm:mr-24`}>
            <div className="grid gap-1">
            {balanceOffer && (
              <label className="flex items-center gap-2 text-[13px]">
                <input type="checkbox" className="size-4 accent-[var(--bbos-coffee-green,#1f6b4f)]" checked={useBalance} onChange={(e) => setUseBalance(e.target.checked)} />
                Usar o saldo do extrato como saldo do caixa: <b>{brl.format(preview.statement.closingBalance ?? 0)}</b> em {fullDay(preview.statement.to)}
              </label>
            )}
            <span className="text-sm"><b>{selected.length} selecionados</b>{settleTotal ? ` · baixas ${brl.format(settleTotal)}` : ""}{expenseTotal ? ` · despesas ${brl.format(expenseTotal)}` : ""}{missingCategory.length ? <span className="text-amber-800"> · {missingCategory.length} sem categoria</span> : null}</span>
            </div>
            <button data-bbos-write-action type="button" onClick={apply} disabled={(!selected.length && !(balanceOffer && useBalance)) || busy !== ""} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-900 px-5 text-sm font-bold text-white disabled:bg-stone-200 disabled:text-stone-500">
              {busy === "applying" && <Loader2 size={15} className="animate-spin" />}{busy === "applying" ? "Aplicando…" : "Aplicar selecionados"}
            </button>
          </div>
        </>
      )}
      <p className="mt-4 text-xs text-[var(--bbos-text-secondary)]">O arquivo <b>OFX</b> do Itaú (Extrato → Salvar como → OFX) é o formato mais confiável. Enviar o mesmo extrato de novo não duplica nada: o que já foi aplicado aparece como feito.</p>
    </div>
  );
}

function Kpi({ label, value, sub, tone = "" }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className={`${card} p-4`}>
      <p className="text-[11px] font-bold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone}`}>{value}{sub && <span className="ml-1 text-xs font-semibold text-[var(--bbos-text-secondary)]">{sub}</span>}</p>
    </div>
  );
}

function CategorySelect({ options, value, note, onChange }: { options: string[]; value: string; note?: string; onChange: (value: string) => void }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <select className={select} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Escolha…</option>
        {options.map((c) => <option key={c}>{c}</option>)}
      </select>
      {note && <span className="text-xs text-[var(--bbos-text-secondary)]">{note}</span>}
    </span>
  );
}

function Group({ title, hint, plans, choices, onToggle, render }: {
  title: string; hint: string; plans: Plan[]; choices: Record<string, Choice>;
  onToggle: (id: string, on: boolean) => void; render: (plan: Plan) => React.ReactNode;
}) {
  if (!plans.length) return null;
  return (
    <section className={`${card} mt-4 p-4`}>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[16px] font-semibold">{title} <span className="ml-1 rounded-full bg-stone-100 px-2 text-xs">{plans.length}</span></h2>
        <span className="text-xs text-[var(--bbos-text-secondary)]">{hint}</span>
      </div>
      <ul className="divide-y divide-stone-100">
        {plans.map((plan) => (
          <li key={plan.line.externalId} className={`grid grid-cols-[22px_1fr_auto] items-center gap-x-3 gap-y-1.5 py-2.5 lg:grid-cols-[22px_minmax(0,1.3fr)_minmax(0,1.2fr)_auto] ${plan.alreadyApplied ? "opacity-60" : ""}`}>
            {plan.alreadyApplied
              ? <CheckCircle2 size={18} className="text-emerald-700" aria-label="Já aplicado" />
              : <input type="checkbox" className="size-[18px] accent-[var(--bbos-coffee-green,#1f6b4f)]" checked={Boolean(choices[plan.line.externalId]?.on)} onChange={(e) => onToggle(plan.line.externalId, e.target.checked)} aria-label="Selecionar" />}
            <div className="min-w-0 text-sm">
              <span className="text-[var(--bbos-text-secondary)]">{day(plan.line.date)} · </span><b>{plan.line.counterparty || plan.line.description}</b>
              {plan.line.counterparty && <div className="truncate text-xs text-[var(--bbos-text-secondary)]">{plan.line.description}</div>}
            </div>
            <div className="col-span-2 col-start-2 min-w-0 lg:col-span-1 lg:col-start-3">{plan.alreadyApplied ? <span className="text-xs font-semibold text-emerald-700">já aplicado</span> : render(plan)}</div>
            <span className={`col-start-3 row-start-1 text-right text-sm font-bold tabular-nums lg:col-start-4 ${plan.line.amount > 0 ? "text-emerald-700" : ""}`}>{plan.line.amount > 0 ? "+" : "−"}{brl.format(Math.abs(plan.line.amount))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
