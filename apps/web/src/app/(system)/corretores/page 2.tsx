"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Pencil, Plus, Search, X } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/brokers`;
const input =
  "w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-sm outline-none focus:border-forest-700 focus:ring-2 focus:ring-forest-100";

type Broker = {
  id: string;
  name: string;
  legalName?: string | null;
  tradeName?: string | null;
  taxId?: string | null;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  active: boolean;
  bankDetails?: unknown;
};

const digitsOnly = (value: string) => value.replace(/\D/g, "");
const formatTaxId = (value: string) => {
  const digits = digitsOnly(value).slice(0, 14);
  if (digits.length <= 11)
    return digits
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  return digits
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
};
const validCpf = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = Array.from({ length }, (_, index) => Number(digits[index]) * (length + 1 - index)).reduce((total, item) => total + item, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
};
const validCnpj = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const weights = length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce((total, weight, index) => total + Number(digits[index]) * weight, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
};
const taxIdError = (value: string) => {
  const digits = digitsOnly(value);
  if (!digits) return "";
  if (digits.length < 11) return "CPF/CNPJ incompleto";
  if (digits.length === 11) return validCpf(digits) ? "" : "CPF inválido";
  if (digits.length < 14) return "CNPJ incompleto";
  return validCnpj(digits) ? "" : "CNPJ inválido";
};

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(data.message) ? data.message.join(" ") : data.message;
    throw new Error(message ?? "Não foi possível concluir a operação.");
  }
  return data as T;
}

export default function BrokersPage() {
  const [brokers, setBrokers] = useState<Broker[]>([]);
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [modal, setModal] = useState<"create" | "edit" | "details" | null>(null);
  const [selected, setSelected] = useState<Broker | null>(null);
  const [taxId, setTaxId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setBrokers(await request<Broker[]>(API));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar os corretores.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => brokers.filter((broker) => {
    const text = `${broker.name} ${broker.legalName ?? ""} ${broker.tradeName ?? ""} ${broker.taxId ?? ""} ${broker.phone ?? ""} ${broker.email ?? ""}`.toLowerCase();
    return text.includes(query.toLowerCase()) && (activeFilter === "all" || String(broker.active) === activeFilter);
  }), [activeFilter, brokers, query]);

  const openForm = (broker?: Broker) => {
    setSelected(broker ?? null);
    setTaxId(broker?.taxId ?? "");
    setError("");
    setModal(broker ? "edit" : "create");
  };
  const closeModal = () => { if (!saving) { setModal(null); setSelected(null); } };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const documentError = taxIdError(taxId);
    if (!name) { setError("Informe o nome ou razão social."); return; }
    if (documentError && !documentError.endsWith("incompleto")) { setError(documentError); return; }
    if (taxId && documentError) { setError(documentError); return; }
    const body = {
      name,
      legalName: String(form.get("legalName") ?? "").trim() || undefined,
      tradeName: String(form.get("tradeName") ?? "").trim() || undefined,
      taxId: digitsOnly(taxId) || undefined,
      contactName: String(form.get("contactName") ?? "").trim() || undefined,
      phone: String(form.get("phone") ?? "").trim() || undefined,
      email: String(form.get("email") ?? "").trim() || undefined,
      active: form.get("active") === "true",
    };
    setSaving(true);
    try {
      await request(selected ? `${API}/${selected.id}` : API, { method: selected ? "PATCH" : "POST", body: JSON.stringify(body) });
      setModal(null);
      setSelected(null);
      setMessage(selected ? "Corretor atualizado." : "Corretor cadastrado.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error && /CPF|CNPJ|documento/i.test(cause.message) ? "Já existe um corretor com este documento." : cause instanceof Error ? cause.message : "Não foi possível salvar. Confira os dados destacados.");
    } finally { setSaving(false); }
  };

  return (
    <div className="mx-auto max-w-[1480px]">
      <Link href="/cafe-verde" className="inline-flex items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14} /> Café Verde</Link>
      <header className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Cadastros-base</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Corretores</h1><p className="mt-2 text-sm text-stone-500">Intermediadores cadastrados para negociações de café verde.</p></div>
        <button type="button" onClick={() => openForm()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white"><Plus size={16} /> Novo corretor</button>
      </header>
      {(message || error) && <p className={`mt-4 rounded-xl p-3 text-sm font-semibold ${error ? "bg-red-50 text-red-800" : "bg-emerald-50 text-emerald-800"}`}>{error || message}</p>}
      <div className="mt-7 flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3"><Search size={15} className="text-stone-400" /><input aria-label="Buscar corretor" className="w-full py-3 text-sm outline-none" placeholder="Buscar nome, CPF/CNPJ..." value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select aria-label="Filtrar status" className={`${input} md:max-w-44`} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="all">Todos</option><option value="true">Ativos</option><option value="false">Inativos</option></select>
      </div>
      <div className="mt-6 space-y-4">
        {loading && <Card className="p-6 text-sm text-stone-500">Carregando corretores...</Card>}
        {!loading && filtered.map((broker) => <Card key={broker.id} className="p-5"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{broker.tradeName || broker.name}</h2><span className={`rounded-full px-2 py-1 text-[11px] font-bold ${broker.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600"}`}>{broker.active ? "Ativo" : "Inativo"}</span></div><p className="mt-1 text-sm text-stone-500">{broker.legalName || broker.name} · {broker.taxId || "Documento não informado"}</p><p className="mt-1 text-xs text-stone-500">{broker.contactName || "Sem contato principal"}{broker.phone ? ` · ${broker.phone}` : ""}{broker.email ? ` · ${broker.email}` : ""}</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => { setSelected(broker); setModal("details"); }} className="min-h-10 rounded-xl border border-stone-200 px-3 text-xs font-bold">Ver detalhes</button><button type="button" onClick={() => openForm(broker)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 px-3 text-xs font-bold"><Pencil size={14} /> Editar</button></div></div></Card>)}
        {!loading && filtered.length === 0 && <Card className="p-8 text-center"><p className="text-sm font-semibold">Nenhum corretor encontrado.</p><p className="mt-1 text-xs text-stone-500">Cadastre o primeiro intermediador para usar nas negociações.</p><button type="button" onClick={() => openForm()} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-bold text-white"><Plus size={15} /> Novo corretor</button></Card>}
      </div>

      {(modal === "create" || modal === "edit") && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="broker-dialog-title"><div className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-center justify-between border-b px-6 py-4"><h2 id="broker-dialog-title" className="text-lg font-bold">{selected ? "Editar corretor" : "Novo corretor"}</h2><button type="button" aria-label="Fechar" onClick={closeModal} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={18} /></button></header><form id="broker-form" onSubmit={save} className="min-h-0 flex-1 overflow-y-auto p-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs font-semibold text-stone-700 md:col-span-2">Nome/Razão Social<input name="name" required defaultValue={selected?.name ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">Nome fantasia<input name="tradeName" defaultValue={selected?.tradeName ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">CPF/CNPJ<input name="taxId" value={taxId} onChange={(event) => setTaxId(formatTaxId(event.target.value))} placeholder="CPF ou CNPJ" className={`${input} mt-1.5`} />{taxId && taxIdError(taxId) && <span className="mt-1 block text-xs font-normal text-red-700">{taxIdError(taxId)}</span>}</label><label className="text-xs font-semibold text-stone-700 md:col-span-2">Razão social (opcional)<input name="legalName" defaultValue={selected?.legalName ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">Contato principal<input name="contactName" defaultValue={selected?.contactName ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">Telefone/WhatsApp<input name="phone" defaultValue={selected?.phone ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">E-mail<input name="email" type="email" defaultValue={selected?.email ?? ""} className={`${input} mt-1.5`} /></label><label className="text-xs font-semibold text-stone-700">Status<select name="active" defaultValue={String(selected?.active ?? true)} className={`${input} mt-1.5`}><option value="true">Ativo</option><option value="false">Inativo</option></select></label></div>{error && <p className="mt-4 text-sm text-red-700">{error}</p>}</form><footer className="flex shrink-0 justify-end gap-2 border-t bg-white px-6 py-4"><button type="button" onClick={closeModal} className="min-h-10 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700">Cancelar</button><button type="submit" form="broker-form" disabled={saving} className="min-h-10 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? "Salvando..." : "Salvar corretor"}</button></footer></div></div>}

      {modal === "details" && selected && <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-labelledby="broker-details-title"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Cadastro de corretor</p><h2 id="broker-details-title" className="mt-1 text-xl font-bold">{selected.tradeName || selected.name}</h2></div><button type="button" aria-label="Fechar" onClick={closeModal} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={18} /></button></div><dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs text-stone-500">Razão social</dt><dd className="font-semibold">{selected.legalName || selected.name}</dd></div><div><dt className="text-xs text-stone-500">CPF/CNPJ</dt><dd className="font-semibold">{selected.taxId || "Não informado"}</dd></div><div><dt className="text-xs text-stone-500">Contato</dt><dd className="font-semibold">{selected.contactName || "Não informado"}</dd></div><div><dt className="text-xs text-stone-500">Telefone</dt><dd className="font-semibold">{selected.phone || "Não informado"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-stone-500">E-mail</dt><dd className="font-semibold">{selected.email || "Não informado"}</dd></div><div className="sm:col-span-2"><dt className="text-xs text-stone-500">Dados bancários</dt><dd className="font-semibold text-stone-600">Disponíveis somente na edição autorizada.</dd></div></dl><div className="mt-6 flex justify-end gap-2"><button type="button" onClick={closeModal} className="rounded-xl border border-stone-200 px-4 py-2.5 text-sm font-bold">Fechar</button><button type="button" onClick={() => openForm(selected)} className="rounded-xl bg-forest-900 px-4 py-2.5 text-sm font-bold text-white">Editar</button></div></div></div>}
    </div>
  );
}
