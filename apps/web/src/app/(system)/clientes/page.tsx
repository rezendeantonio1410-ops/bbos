"use client";

import { useEffect, useMemo, useState } from "react";
import { BadgeDollarSign, Building2, Plus, Search, X } from "lucide-react";

type Customer = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  segment?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  state?: string | null;
  paymentTerms?: string | null;
  active: boolean;
  creditStatus: "NOT_ANALYZED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";
  creditLimit: string | number;
  creditNotes?: string | null;
  creditReviewedAt?: string | null;
  creditReviewedBy?: string | null;
};

const emptyCustomer = {
  name: "",
  legalName: "",
  tradeName: "",
  taxId: "",
  segment: "",
  email: "",
  phone: "",
  postalCode: "",
  address: "",
  district: "",
  city: "",
  state: "",
  paymentTerms: "",
};

const statusLabel: Record<Customer["creditStatus"], string> = {
  NOT_ANALYZED: "Não analisado",
  UNDER_REVIEW: "Em análise",
  APPROVED: "Aprovado",
  REJECTED: "Reprovado",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState(emptyCustomer);
  const [saving, setSaving] = useState(false);
  const [creditCustomer, setCreditCustomer] = useState<Customer | null>(null);
  const [creditStatus, setCreditStatus] = useState<Customer["creditStatus"]>("UNDER_REVIEW");
  const [creditLimit, setCreditLimit] = useState("0");
  const [creditNotes, setCreditNotes] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/customers", { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => ({})))?.message ?? "Não foi possível carregar clientes.");
      setCustomers(await response.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar clientes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return customers;
    return customers.filter((customer) =>
      [customer.name, customer.legalName, customer.tradeName, customer.taxId, customer.city, customer.state]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term)),
    );
  }, [customers, search]);

  const createCustomer = async () => {
    if (!form.name.trim()) return setError("Informe o nome do cliente.");
    setSaving(true);
    setError("");
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível cadastrar o cliente.");
      setForm(emptyCustomer);
      setShowNew(false);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível cadastrar o cliente.");
    } finally {
      setSaving(false);
    }
  };

  const openCredit = (customer: Customer) => {
    setCreditCustomer(customer);
    setCreditStatus(customer.creditStatus === "NOT_ANALYZED" ? "UNDER_REVIEW" : customer.creditStatus);
    setCreditLimit(String(customer.creditLimit ?? 0));
    setCreditNotes(customer.creditNotes ?? "");
  };

  const saveCredit = async () => {
    if (!creditCustomer) return;
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/customers/${creditCustomer.id}/credit`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: creditStatus, creditLimit: Number(creditLimit || 0), notes: creditNotes }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível salvar a análise de crédito.");
      setCreditCustomer(null);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a análise de crédito.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-forest-700">Operação comercial</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-stone-950">Clientes</h1>
          <p className="mt-1 text-sm text-stone-500">Cadastro simples e análise de crédito quando necessário.</p>
        </div>
        <button onClick={() => setShowNew(true)} className="inline-flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white hover:bg-stone-800">
          <Plus size={17} /> Novo cliente
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs text-stone-500">Clientes ativos</p><p className="mt-2 text-2xl font-semibold">{customers.filter((item) => item.active).length}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs text-stone-500">Crédito aprovado</p><p className="mt-2 text-2xl font-semibold">{customers.filter((item) => item.creditStatus === "APPROVED").length}</p></div>
        <div className="rounded-2xl border bg-white p-5 shadow-sm"><p className="text-xs text-stone-500">Aguardando análise</p><p className="mt-2 text-2xl font-semibold">{customers.filter((item) => item.creditStatus === "UNDER_REVIEW").length}</p></div>
      </div>

      <div className="rounded-2xl border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
          <div className="flex min-w-[260px] flex-1 items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente, CNPJ, cidade..." className="w-full bg-transparent text-sm outline-none" />
          </div>
          <span className="text-xs text-stone-500">{filtered.length} cliente(s)</span>
        </div>
        {error && <div className="m-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {loading ? (
          <div className="p-10 text-center text-sm text-stone-500">Carregando clientes...</div>
        ) : filtered.length === 0 ? (
          <div className="p-14 text-center"><Building2 className="mx-auto text-stone-300" /><p className="mt-3 font-semibold">Nenhum cliente cadastrado</p><p className="mt-1 text-sm text-stone-500">Cadastre o primeiro cliente para começar a lançar pedidos.</p></div>
        ) : (
          <div className="divide-y">
            {filtered.map((customer) => (
              <div key={customer.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                <div className="min-w-[260px]">
                  <div className="flex items-center gap-2"><p className="font-semibold text-stone-950">{customer.tradeName || customer.name}</p>{!customer.active && <span className="rounded-full bg-stone-100 px-2 py-1 text-[10px] text-stone-500">Inativo</span>}</div>
                  <p className="mt-1 text-xs text-stone-500">{customer.taxId || "CPF/CNPJ não informado"}{customer.city ? ` · ${customer.city}${customer.state ? `/${customer.state}` : ""}` : ""}</p>
                  <p className="mt-1 text-xs text-stone-400">{customer.segment || "Segmento não informado"}</p>
                </div>
                <div className="flex items-center gap-5">
                  <div className="text-right">
                    <p className="text-[10px] uppercase tracking-wider text-stone-400">Crédito</p>
                    <p className="text-sm font-semibold">{statusLabel[customer.creditStatus]}</p>
                    {customer.creditStatus === "APPROVED" && <p className="text-xs text-stone-500">Limite R$ {Number(customer.creditLimit || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>}
                  </div>
                  <button onClick={() => openCredit(customer)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold hover:bg-stone-50"><BadgeDollarSign size={16} /> Análise de crédito</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30">
          <div className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Cadastro</p><h2 className="mt-1 text-2xl font-semibold">Novo cliente</h2><p className="mt-1 text-sm text-stone-500">Cadastre primeiro. A análise de crédito é opcional.</p></div><button onClick={() => setShowNew(false)} className="rounded-lg p-2 hover:bg-stone-100"><X /></button></div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <Field label="Nome / nome fantasia" value={form.name} onChange={(value) => setForm({ ...form, name: value })} wide />
              <Field label="Razão social" value={form.legalName} onChange={(value) => setForm({ ...form, legalName: value })} wide />
              <Field label="CPF / CNPJ" value={form.taxId} onChange={(value) => setForm({ ...form, taxId: value })} />
              <Field label="Segmento" value={form.segment} onChange={(value) => setForm({ ...form, segment: value })} />
              <Field label="E-mail" value={form.email} onChange={(value) => setForm({ ...form, email: value })} />
              <Field label="Telefone / WhatsApp" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
              <Field label="CEP" value={form.postalCode} onChange={(value) => setForm({ ...form, postalCode: value })} />
              <Field label="UF" value={form.state} onChange={(value) => setForm({ ...form, state: value.toUpperCase().slice(0, 2) })} />
              <Field label="Cidade" value={form.city} onChange={(value) => setForm({ ...form, city: value })} />
              <Field label="Bairro" value={form.district} onChange={(value) => setForm({ ...form, district: value })} />
              <Field label="Endereço" value={form.address} onChange={(value) => setForm({ ...form, address: value })} wide />
              <Field label="Condição de pagamento" value={form.paymentTerms} onChange={(value) => setForm({ ...form, paymentTerms: value })} wide placeholder="Ex.: à vista, 14 dias, 28 dias" />
            </div>
            <button disabled={saving} onClick={() => void createCustomer()} className="mt-6 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Cadastrar cliente"}</button>
          </div>
        </div>
      )}

      {creditCustomer && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between"><div><p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-500">Crédito</p><h2 className="mt-1 text-2xl font-semibold">Análise de crédito</h2><p className="mt-1 text-sm text-stone-500">{creditCustomer.tradeName || creditCustomer.name}</p></div><button onClick={() => setCreditCustomer(null)} className="rounded-lg p-2 hover:bg-stone-100"><X /></button></div>
            <div className="mt-6 space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Situação</span><select value={creditStatus} onChange={(event) => setCreditStatus(event.target.value as Customer["creditStatus"])} className="w-full rounded-xl border px-3 py-3 text-sm"><option value="NOT_ANALYZED">Não analisado</option><option value="UNDER_REVIEW">Em análise</option><option value="APPROVED">Aprovado</option><option value="REJECTED">Reprovado</option></select></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Limite aprovado (R$)</span><input type="number" min="0" step="0.01" value={creditLimit} onChange={(event) => setCreditLimit(event.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Observação da análise</span><textarea rows={4} value={creditNotes} onChange={(event) => setCreditNotes(event.target.value)} className="w-full rounded-xl border px-3 py-3 text-sm" placeholder="Documentos analisados, condição, justificativa..." /></label>
              <p className="text-xs text-stone-500">A análise de crédito é administrativa. O vendedor não precisa visualizar informações internas além da situação necessária para o pedido.</p>
            </div>
            <button disabled={saving} onClick={() => void saveCredit()} className="mt-6 w-full rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Salvando..." : "Salvar análise"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, wide = false, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; wide?: boolean; placeholder?: string }) {
  return <label className={wide ? "sm:col-span-2" : ""}><span className="mb-1.5 block text-sm font-semibold">{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border px-3 py-3 text-sm outline-none focus:border-stone-500" /></label>;
}
