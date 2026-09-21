"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, Landmark, Plus, RefreshCw, ShieldCheck } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/finance`;

type Institution = {
  id: string;
  name: string;
  code?: string | null;
  country: string;
};

type Account = {
  id: string;
  name: string;
  type: string;
  currency: string;
  bankCode?: string | null;
  branch?: string | null;
  accountNumberMasked?: string | null;
  country: string;
  openingBalance: string | number;
  financialInstitution?: Institution | null;
};

const money = (value: number, currency = "BRL") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value);

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", cache: "no-store", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message ?? "Não foi possível concluir a operação.");
  return body;
}

export default function BankAccountsPage() {
  const [institutions, setInstitutions] = React.useState<Institution[]>([]);
  const [accounts, setAccounts] = React.useState<Account[]>([]);
  const [open, setOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [notice, setNotice] = React.useState("");

  const load = React.useCallback(async () => {
    setError("");
    try {
      const [nextInstitutions, nextAccounts] = await Promise.all([
        request<Institution[]>(`${API}/institutions`),
        request<Account[]>(`${API}/accounts`),
      ]);
      setInstitutions(nextInstitutions);
      setAccounts(nextAccounts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao carregar bancos e contas.");
    }
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  return (
    <div className="mx-auto max-w-[1500px] pb-12">
      <Link href="/financeiro" className="inline-flex min-h-11 items-center gap-2 text-xs font-bold text-forest-700">
        <ArrowLeft size={14} /> Financeiro
      </Link>

      <header className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">Financeiro · Estrutura bancária</p>
          <h1 className="mt-2 text-3xl font-bold">Bancos e Contas</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            Cadastre as contas permanentes da Bispo. Extratos, conciliação e saldo passam a usar esta estrutura.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => void load()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-3 text-xs font-bold">
            <RefreshCw size={14} /> Atualizar
          </button>
          <button onClick={() => setOpen(true)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-forest-900 px-4 text-xs font-bold text-white">
            <Plus size={15} /> Nova conta
          </button>
        </div>
      </header>

      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
      {notice && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}

      <section className="mt-6 grid gap-3 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Contas ativas</p>
          <p className="mt-2 text-2xl font-bold">{accounts.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Instituições</p>
          <p className="mt-2 text-2xl font-bold">{institutions.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[10px] font-bold uppercase tracking-wide text-stone-500">Modelo</p>
          <p className="mt-2 text-sm font-bold text-emerald-800">Multibanco · multimoeda</p>
        </Card>
      </section>

      <section className="mt-6">
        {accounts.length === 0 ? (
          <Card className="border-dashed p-10 text-center">
            <Landmark className="mx-auto text-stone-300" size={28} />
            <p className="mt-3 text-sm font-bold">Nenhuma conta bancária cadastrada.</p>
            <p className="mt-1 text-xs text-stone-500">Comece pela conta principal do Itaú.</p>
            <button onClick={() => setOpen(true)} className="mt-5 rounded-xl bg-forest-900 px-4 py-3 text-xs font-bold text-white">
              Cadastrar conta principal
            </button>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            {accounts.map((account) => (
              <Card key={account.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-10 place-items-center rounded-xl bg-stone-100"><Building2 size={18} /></span>
                    <div>
                      <p className="text-sm font-bold">{account.financialInstitution?.name ?? "Instituição não informada"}</p>
                      <p className="text-xs text-stone-500">{account.name}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-800">ATIVA</span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                  <Value label="Banco" value={account.bankCode || account.financialInstitution?.code || "—"} />
                  <Value label="Moeda" value={account.currency} />
                  <Value label="Agência" value={account.branch || "—"} />
                  <Value label="Conta" value={account.accountNumberMasked || "—"} />
                </div>
                <div className="mt-4 rounded-xl bg-stone-50 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">Saldo inicial</p>
                  <p className="mt-1 text-lg font-bold">{money(Number(account.openingBalance), account.currency)}</p>
                </div>
                <Link href="/financeiro/conciliacao" className="mt-4 inline-flex text-xs font-bold text-forest-700">
                  Abrir conciliação →
                </Link>
              </Card>
            ))}
          </div>
        )}
      </section>

      {open && (
        <AccountDialog
          institutions={institutions}
          onClose={() => setOpen(false)}
          onDone={async (message) => {
            setOpen(false);
            setNotice(message);
            await load();
          }}
        />
      )}
    </div>
  );
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 font-semibold text-stone-800">{value}</p></div>;
}

function AccountDialog({
  institutions,
  onClose,
  onDone,
}: {
  institutions: Institution[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
}) {
  const itau = institutions.find((item) => item.code === "341" || item.name.toLowerCase().includes("itaú") || item.name.toLowerCase().includes("itau"));
  const [institutionId, setInstitutionId] = React.useState(itau?.id ?? "");
  const [institutionName, setInstitutionName] = React.useState(itau ? "" : "Itaú Unibanco");
  const [bankCode, setBankCode] = React.useState("341");
  const [name, setName] = React.useState("Itaú — Conta Principal Bispo");
  const [branch, setBranch] = React.useState("");
  const [accountLastDigits, setAccountLastDigits] = React.useState("");
  const [openingBalance, setOpeningBalance] = React.useState("");
  const [currency, setCurrency] = React.useState("BRL");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const submit = async () => {
    if (!name.trim() || !branch.trim() || !accountLastDigits.trim()) {
      setError("Preencha nome da conta, agência e os dígitos finais da conta.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      let selectedInstitutionId = institutionId;
      if (!selectedInstitutionId) {
        const institution = await request<Institution>(`${API}/institutions`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            name: institutionName.trim() || "Itaú Unibanco",
            code: bankCode.trim() || "341",
            country: "BR",
          }),
        });
        selectedInstitutionId = institution.id;
      }
      const digits = accountLastDigits.replace(/\D/g, "");
      await request<Account>(`${API}/accounts`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          financialInstitutionId: selectedInstitutionId,
          name: name.trim(),
          type: "BANK",
          currency,
          bankCode: bankCode.trim() || "341",
          branch: branch.trim(),
          accountNumberMasked: digits ? `•••• ${digits.slice(-6)}` : "",
          country: "BR",
          openingBalance: openingBalance === "" ? 0 : Number(openingBalance.replace(",", ".")),
        }),
      });
      await onDone("Conta bancária cadastrada. Ela já está disponível para importação de extratos e conciliação.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar a conta.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/35 p-4" role="dialog" aria-modal="true">
      <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-forest-700">Cadastro bancário</p>
            <h2 className="mt-1 text-lg font-bold">Nova conta</h2>
          </div>
          <button onClick={onClose} className="grid size-11 place-items-center rounded-xl border">×</button>
        </div>

        <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-xs text-emerald-900">
          <ShieldCheck size={14} className="mr-1 inline" /> O BBOS não armazena senha, token ou credenciais do internet banking neste cadastro.
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Field label="Instituição">
            <select value={institutionId} onChange={(e) => setInstitutionId(e.target.value)}>
              <option value="">Cadastrar nova instituição</option>
              {institutions.map((institution) => <option key={institution.id} value={institution.id}>{institution.name}</option>)}
            </select>
          </Field>
          {!institutionId && <Field label="Nome da instituição"><input value={institutionName} onChange={(e) => setInstitutionName(e.target.value)} /></Field>}
          <Field label="Código do banco"><input value={bankCode} onChange={(e) => setBankCode(e.target.value)} /></Field>
          <Field label="Nome interno da conta"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Agência"><input value={branch} onChange={(e) => setBranch(e.target.value)} placeholder="Ex.: 1234" /></Field>
          <Field label="Últimos dígitos da conta"><input value={accountLastDigits} onChange={(e) => setAccountLastDigits(e.target.value)} placeholder="Somente para identificação" /></Field>
          <Field label="Moeda">
            <select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="BRL">BRL — Real</option><option value="EUR">EUR — Euro</option><option value="USD">USD — Dólar</option><option value="GBP">GBP — Libra</option></select>
          </Field>
          <Field label="Saldo inicial">
            <input type="number" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="0,00" />
          </Field>
        </div>

        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onClose} className="min-h-11 rounded-xl border px-4 text-xs font-bold">Cancelar</button>
          <button disabled={busy} onClick={() => void submit()} className="min-h-11 rounded-xl bg-forest-900 px-5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? "Salvando…" : "Cadastrar conta"}
          </button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-stone-700">{label}<div className="mt-2 [&>*]:min-h-11 [&>*]:w-full [&>*]:rounded-xl [&>*]:border [&>*]:border-stone-200 [&>*]:bg-white [&>*]:px-3 [&>*]:text-sm">{children}</div></label>;
}
