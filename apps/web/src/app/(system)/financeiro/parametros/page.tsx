"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CheckCircle2, Landmark, Percent, Target } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Rates = {
  pis: number;
  cofins: number;
  pisCofinsCredit: boolean;
  icms: number | null;
  icmsDueDay: number;
  irpjBase: number;
  irpj: number;
  irpjSurcharge: number;
  irpjSurchargeMonthlyThreshold: number;
  csllBase: number;
  csll: number;
  simples: number | null;
};
type Settings = {
  configured: boolean;
  minimumCashBalance: number;
  monthlyRevenueTarget: number | null;
  taxRegime: "LUCRO_REAL" | "LUCRO_PRESUMIDO" | "SIMPLES_NACIONAL";
  taxRates: Rates;
  defaultTaxRates: Rates;
  taxRatesConfirmedAt: string | null;
  updatedByName: string | null;
  updatedAt: string | null;
};

const REGIMES = [
  ["LUCRO_REAL", "Lucro Real"],
  ["LUCRO_PRESUMIDO", "Lucro Presumido"],
  ["SIMPLES_NACIONAL", "Simples Nacional"],
] as const;

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const toText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value).replace(".", ","));
const toNumber = (value: string) => {
  const clean = value.replace(/\./g, "").replace(",", ".").trim();
  return clean === "" ? null : Number(clean);
};

export default function FinanceSettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [credit, setCredit] = useState(true);
  const [regime, setRegime] = useState<Settings["taxRegime"]>("LUCRO_REAL");
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const fill = (data: Settings) => {
    setSettings(data);
    setRegime(data.taxRegime);
    setCredit(data.taxRates.pisCofinsCredit);
    setConfirmed(Boolean(data.taxRatesConfirmedAt));
    setForm({
      minimumCashBalance: toText(data.minimumCashBalance),
      monthlyRevenueTarget: toText(data.monthlyRevenueTarget),
      pis: toText(data.taxRates.pis),
      cofins: toText(data.taxRates.cofins),
      icms: toText(data.taxRates.icms),
      icmsDueDay: String(data.taxRates.icmsDueDay),
      irpjBase: toText(data.taxRates.irpjBase),
      irpj: toText(data.taxRates.irpj),
      irpjSurcharge: toText(data.taxRates.irpjSurcharge),
      csllBase: toText(data.taxRates.csllBase),
      csll: toText(data.taxRates.csll),
      simples: toText(data.taxRates.simples),
    });
  };

  useEffect(() => {
    fetch(`${getApiBaseUrl()}/finance/settings`, { credentials: "include", cache: "no-store" })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "Não foi possível carregar os parâmetros.");
        fill(body as Settings);
      })
      .catch((error) => setMessage({ tone: "error", text: error instanceof Error ? error.message : "Erro ao carregar." }));
  }, []);

  const set = (field: string, value: string) => setForm((current) => ({ ...current, [field]: value }));

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const rate = (field: string) => toNumber(form[field] ?? "");
    try {
      const response = await fetch(`${getApiBaseUrl()}/finance/settings`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          minimumCashBalance: toNumber(form.minimumCashBalance ?? "") ?? 0,
          monthlyRevenueTarget: toNumber(form.monthlyRevenueTarget ?? ""),
          taxRegime: regime,
          taxRatesConfirmed: confirmed && !settings?.taxRatesConfirmedAt,
          taxRates:
            regime === settings?.taxRegime
              ? {
                  pis: rate("pis"), cofins: rate("cofins"), pisCofinsCredit: credit, icms: rate("icms"),
                  icmsDueDay: Number(form.icmsDueDay || 12), irpjBase: rate("irpjBase"), irpj: rate("irpj"),
                  irpjSurcharge: rate("irpjSurcharge"), csllBase: rate("csllBase"), csll: rate("csll"), simples: rate("simples"),
                }
              : {},
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join(" ") : body.message ?? "Não foi possível salvar.");
      fill(body as Settings);
      setMessage({ tone: "ok", text: "Parâmetros salvos. O fluxo de caixa já usa os novos valores." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível salvar." });
    } finally {
      setSaving(false);
    }
  };

  const target = toNumber(form.monthlyRevenueTarget ?? "");
  const minimum = toNumber(form.minimumCashBalance ?? "");
  const isSimples = regime === "SIMPLES_NACIONAL";

  return (
    <div className="mx-auto grid max-w-4xl gap-5 pb-16">
      <header>
        <h1 className="text-2xl font-bold">Parâmetros financeiros</h1>
        <p className="mt-1 text-sm text-stone-600">Usados no fluxo de caixa: alerta de saldo mínimo, meta de vendas e estimativa de impostos.</p>
      </header>

      {!settings && !message && <p className="text-sm text-stone-500">Carregando…</p>}

      {settings && (
        <>
          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-labelledby="cash-title">
            <h2 id="cash-title" className="flex items-center gap-2 font-semibold"><Target size={18} className="text-emerald-700" /> Caixa e metas</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="minimumCashBalance" label="Saldo mínimo em caixa (R$)" hint={minimum ? `Alerta quando a previsão ficar abaixo de ${money.format(minimum)}.` : "O sistema avisa quando a previsão cruzar este valor."}>
                <input id="minimumCashBalance" inputMode="decimal" value={form.minimumCashBalance ?? ""} onChange={(e) => set("minimumCashBalance", e.target.value)} placeholder="100.000" />
              </Field>
              <Field id="monthlyRevenueTarget" label="Meta de faturamento mensal (R$)" hint={target ? `Equivale a ${money.format(target / 22)} por dia útil.` : "Usada para comparar vendas e calcular o ponto de equilíbrio."}>
                <input id="monthlyRevenueTarget" inputMode="decimal" value={form.monthlyRevenueTarget ?? ""} onChange={(e) => set("monthlyRevenueTarget", e.target.value)} placeholder="600.000" />
              </Field>
            </div>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm" aria-labelledby="tax-title">
            <h2 id="tax-title" className="flex items-center gap-2 font-semibold"><Percent size={18} className="text-violet-700" /> Impostos</h2>
            <p className="mt-1 text-sm text-stone-600">
              Estimativa gerencial para o fluxo de caixa; o cálculo do contador prevalece. Valores em % das vendas do mês, pagos no mês seguinte.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field id="taxRegime" label="Regime tributário" hint={regime !== settings.taxRegime ? "Ao salvar, as alíquotas voltam ao padrão do novo regime." : undefined}>
                <select id="taxRegime" value={regime} onChange={(e) => setRegime(e.target.value as Settings["taxRegime"])}>
                  {REGIMES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </Field>
            </div>
            {regime === settings.taxRegime && !isSimples && (
              <div className="mt-4 grid gap-4">
                <fieldset className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-3">
                  <legend className="px-1 text-sm font-semibold">PIS e COFINS · vencem dia 25</legend>
                  <Field id="pis" label="PIS (%)"><input id="pis" inputMode="decimal" value={form.pis ?? ""} onChange={(e) => set("pis", e.target.value)} /></Field>
                  <Field id="cofins" label="COFINS (%)"><input id="cofins" inputMode="decimal" value={form.cofins ?? ""} onChange={(e) => set("cofins", e.target.value)} /></Field>
                  <label className="flex min-h-12 items-center gap-2 self-end text-sm">
                    <input type="checkbox" checked={credit} onChange={(e) => setCredit(e.target.checked)} className="size-5" />
                    Descontar créditos das notas de entrada
                  </label>
                </fieldset>
                <fieldset className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
                  <legend className="px-1 text-sm font-semibold">ICMS</legend>
                  <Field id="icms" label="ICMS efetivo a pagar (%)" hint="Depois dos créditos. Em branco: não estimar.">
                    <input id="icms" inputMode="decimal" value={form.icms ?? ""} onChange={(e) => set("icms", e.target.value)} placeholder="peça ao contador" />
                  </Field>
                  <Field id="icmsDueDay" label="Dia de vencimento do ICMS"><input id="icmsDueDay" inputMode="numeric" value={form.icmsDueDay ?? ""} onChange={(e) => set("icmsDueDay", e.target.value.replace(/\D/g, ""))} /></Field>
                </fieldset>
                <fieldset className="grid gap-3 rounded-xl bg-stone-50 p-4 sm:grid-cols-3">
                  <legend className="px-1 text-sm font-semibold">IRPJ e CSLL · estimativa mensal, último dia útil</legend>
                  <Field id="irpjBase" label="Base do IRPJ (% das vendas)"><input id="irpjBase" inputMode="decimal" value={form.irpjBase ?? ""} onChange={(e) => set("irpjBase", e.target.value)} /></Field>
                  <Field id="irpj" label="IRPJ (%)"><input id="irpj" inputMode="decimal" value={form.irpj ?? ""} onChange={(e) => set("irpj", e.target.value)} /></Field>
                  <Field id="irpjSurcharge" label="Adicional acima de R$ 20 mil (%)"><input id="irpjSurcharge" inputMode="decimal" value={form.irpjSurcharge ?? ""} onChange={(e) => set("irpjSurcharge", e.target.value)} /></Field>
                  <Field id="csllBase" label="Base da CSLL (% das vendas)"><input id="csllBase" inputMode="decimal" value={form.csllBase ?? ""} onChange={(e) => set("csllBase", e.target.value)} /></Field>
                  <Field id="csll" label="CSLL (%)"><input id="csll" inputMode="decimal" value={form.csll ?? ""} onChange={(e) => set("csll", e.target.value)} /></Field>
                </fieldset>
              </div>
            )}
            {regime === settings.taxRegime && isSimples && (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field id="simples" label="Alíquota efetiva do Simples (%)"><input id="simples" inputMode="decimal" value={form.simples ?? ""} onChange={(e) => set("simples", e.target.value)} /></Field>
              </div>
            )}
            <label className="mt-4 flex items-start gap-2 text-sm">
              <input type="checkbox" checked={confirmed} disabled={Boolean(settings.taxRatesConfirmedAt)} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 size-5" />
              <span>
                Alíquotas conferidas com o contador
                {settings.taxRatesConfirmedAt && <span className="block text-xs text-stone-500">Conferidas em {new Date(settings.taxRatesConfirmedAt).toLocaleDateString("pt-BR")}.</span>}
              </span>
            </label>
          </section>

          <section className="rounded-2xl border border-stone-200 bg-white p-5 text-sm text-stone-600 shadow-sm" aria-labelledby="bank-title">
            <h2 id="bank-title" className="flex items-center gap-2 font-semibold text-stone-900"><Landmark size={18} className="text-sky-700" /> Saldo real do banco</h2>
            <p className="mt-1">
              No internet banking do Itaú, abra o extrato da conta da empresa, escolha o período e exporte no formato <strong>OFX</strong>. Depois importe o arquivo em{" "}
              <Link href="/financeiro/conciliacao" className="font-semibold text-stone-900 underline">Conciliação</Link>. Lançamentos repetidos são ignorados.
            </p>
          </section>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-stone-500">
              {settings.updatedByName ? `Última alteração por ${settings.updatedByName} em ${new Date(settings.updatedAt ?? "").toLocaleString("pt-BR")}.` : "Ainda não configurado: usando os padrões do Lucro Real."}
            </p>
            <button type="button" onClick={() => void save()} disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-950 px-5 text-base font-semibold text-white disabled:opacity-60">
              <CheckCircle2 size={18} /> {saving ? "Salvando…" : "Salvar parâmetros"}
            </button>
          </div>
        </>
      )}

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={`rounded-2xl border p-3 text-sm ${message.tone === "error" ? "border-red-200 bg-red-50 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 text-sm">
      <label htmlFor={id} className="font-semibold text-stone-700">{label}</label>
      <div className="[&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:bg-white [&_input]:px-3 [&_input]:text-base [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-3 [&_select]:text-base sm:[&_input]:text-sm sm:[&_select]:text-sm">
        {children}
      </div>
      {hint && <p className="text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
