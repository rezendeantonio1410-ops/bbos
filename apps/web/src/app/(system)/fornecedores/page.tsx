"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/green-coffee-purchases`;
const input = "w-full rounded-xl border bg-stone-50 px-3 py-2.5 text-sm outline-none focus:border-forest-700";
const states = ["PR", "SP", "MG", "ES", "BA", "RJ", "RO", "GO"];
const types = [
  ["RURAL_PERSON", "Produtor Rural"], ["COMPANY", "Empresa"], ["COOPERATIVE", "Cooperativa"],
  ["ASSOCIATION", "Associação"], ["EXPORTER", "Exportador"], ["OTHER", "Outro"],
];
type Region = { id: string; state: string; name: string };
type Species = { id: string; code: string; name: string; varieties: { id: string; name: string }[] };
type Unit = { id: string; name: string; state: string; municipality?: string | null; active: boolean; coffeeRegion?: Region | null; productions?: { species: Species; cultivar?: { name: string } | null; harvest?: string | null }[] };
type Supplier = { id: string; name: string; tradeName?: string | null; legalName?: string | null; taxId?: string | null; supplierType: string; city?: string | null; state?: string | null; active: boolean; originUnits: Unit[] };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message ?? "Não foi possível concluir a operação.");
  return data as T;
}

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [unitSupplier, setUnitSupplier] = useState<Supplier | null>(null);
  const [unitState, setUnitState] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [suppliers, refs] = await Promise.all([
      request<Supplier[]>(`${API}/suppliers?active=${activeFilter}${stateFilter ? `&state=${stateFilter}` : ""}`),
      request<{ regions: Region[]; species: Species[] }>(`${API}/references`),
    ]);
    setItems(suppliers); setRegions(refs.regions); setSpecies(refs.species);
  };
  useEffect(() => { void load().catch((error) => setMessage(error instanceof Error ? error.message : "Falha ao carregar fornecedores.")); }, [activeFilter, stateFilter]);

  const filtered = useMemo(() => items.filter((item) => `${item.name} ${item.tradeName ?? ""} ${item.legalName ?? ""} ${item.taxId ?? ""}`.toLowerCase().includes(query.toLowerCase())), [items, query]);
  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await request(`${API}/suppliers`, { method: "POST", body: JSON.stringify(Object.fromEntries(form)) }); setSupplierOpen(false); setMessage("Fornecedor cadastrado."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cadastrar fornecedor."); }
  };
  const saveUnit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!unitSupplier) return; const form = new FormData(event.currentTarget); const data = Object.fromEntries(form); const cultivarIds = form.getAll("cultivarIds").map(String);
    try { const unit = await request<Unit>(`${API}/suppliers/${unitSupplier.id}/origin-units`, { method: "POST", body: JSON.stringify(data) }); const speciesId = String(form.get("productionSpeciesId") || ""); if (speciesId) await request(`${API}/suppliers/${unitSupplier.id}/origin-units/${unit.id}/production`, { method: "POST", body: JSON.stringify({ speciesId, cultivarIds, harvest: form.get("productionHarvest") || undefined }) }); setUnitSupplier(null); setMessage("Unidade/fazenda cadastrada."); await load(); } catch (error) { setMessage(error instanceof Error ? error.message : "Falha ao cadastrar unidade."); }
  };
  return <div className="mx-auto max-w-[1480px]">
    <Link href="/cafe-verde" className="inline-flex items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14} />Café Verde</Link>
    <header className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Cadastros-base</p><h1 className="mt-2 text-3xl font-semibold tracking-tight">Fornecedores</h1><p className="mt-2 text-sm text-stone-500">Fornecedores, unidades/fazendas e origem do café verde.</p></div><button onClick={() => setSupplierOpen(true)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white"><Plus size={16} />Novo fornecedor</button></header>
    {message && <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">{message}</p>}
    <div className="mt-7 flex flex-col gap-3 md:flex-row"><label className="flex flex-1 items-center gap-2 rounded-xl border bg-white px-3"><Search size={15} className="text-stone-400" /><input className="w-full py-3 text-sm outline-none" placeholder="Buscar nome, CPF/CNPJ..." value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className={input + " md:max-w-48"} value={stateFilter} onChange={(event) => setStateFilter(event.target.value)}><option value="">Todos os estados</option>{states.map((state) => <option key={state}>{state}</option>)}</select><select className={input + " md:max-w-44"} value={activeFilter} onChange={(event) => setActiveFilter(event.target.value)}><option value="true">Ativos</option><option value="false">Inativos</option><option value="">Todos</option></select></div>
    <div className="mt-6 space-y-4">{filtered.map((supplier) => <Card key={supplier.id} className="p-5"><div className="flex flex-col justify-between gap-4 md:flex-row"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{supplier.tradeName || supplier.name}</h2><span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold">{supplier.active ? "Ativo" : "Inativo"}</span></div><p className="mt-1 text-sm text-stone-500">{supplier.legalName || supplier.name} · {supplier.taxId || "Documento não informado"}</p><p className="mt-1 text-xs text-stone-500">{supplier.city || "—"}/{supplier.state || "—"}</p></div><button onClick={() => setUnitSupplier(supplier)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold"><Plus size={14} />Gerenciar unidades/fazendas</button></div><div className="mt-4 grid gap-2 md:grid-cols-2">{supplier.originUnits.map((unit) => <div key={unit.id} className="rounded-xl bg-stone-50 p-3 text-sm"><p className="font-semibold">{unit.name} <span className="text-xs font-normal text-stone-500">· {unit.active ? "Ativa" : "Inativa"}</span></p><p className="mt-1 text-xs text-stone-500">{unit.municipality || "—"}/{unit.state} · {unit.coffeeRegion?.name || "Região não informada"}</p></div>)}{supplier.originUnits.length === 0 && <p className="rounded-xl border border-dashed p-4 text-sm text-stone-500">Nenhuma unidade/fazenda cadastrada.</p>}</div></Card>)}{filtered.length === 0 && <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-stone-500">Nenhum fornecedor encontrado.</div>}</div>
    {supplierOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3"><form onSubmit={(event) => void saveSupplier(event)} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h2 className="text-xl font-bold">Novo fornecedor</h2><button type="button" onClick={() => setSupplierOpen(false)}><X /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Tipo<select name="supplierType" className={input} defaultValue="RURAL_PERSON">{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-sm font-semibold">Nome/Razão social<input name="name" required className={input} /></label><label className="text-sm font-semibold">Nome fantasia<input name="tradeName" className={input} /></label><label className="text-sm font-semibold">CPF/CNPJ<input name="taxId" className={input} /></label><label className="text-sm font-semibold">Inscrição Estadual<input name="stateRegistration" className={input} /></label><label className="text-sm font-semibold">Telefone<input name="contactPhone" className={input} /></label><label className="text-sm font-semibold">WhatsApp<input name="whatsapp" className={input} /></label><label className="text-sm font-semibold">E-mail<input name="contactEmail" type="email" className={input} /></label><label className="text-sm font-semibold">Contato principal<input name="contactName" className={input} /></label><label className="text-sm font-semibold sm:col-span-2">Endereço<input name="address" className={input} /></label><label className="text-sm font-semibold">Município<input name="city" className={input} /></label><label className="text-sm font-semibold">Estado<select name="state" className={input}><option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}</select></label><label className="text-sm font-semibold">País<input name="country" defaultValue="Brasil" className={input} /></label></div><button className="mt-5 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">Salvar fornecedor</button></form></div>}
    {unitSupplier && <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3"><form onSubmit={(event) => void saveUnit(event)} className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase text-forest-700">{unitSupplier.name}</p><h2 className="text-xl font-bold">Nova unidade/fazenda</h2></div><button type="button" onClick={() => setUnitSupplier(null)}><X /></button></div><div className="mt-5 grid gap-3 sm:grid-cols-2"><label className="text-sm font-semibold">Nome da Fazenda/Unidade<input required name="name" className={input} /></label><label className="text-sm font-semibold">CPF/CNPJ próprio<input name="taxId" className={input} /></label><label className="text-sm font-semibold">Inscrição Estadual<input name="stateRegistration" className={input} /></label><label className="text-sm font-semibold">Estado<select required name="state" className={input} value={unitState || unitSupplier.state || ""} onChange={(event) => setUnitState(event.target.value)}><option value="">Selecione</option>{states.map((state) => <option key={state}>{state}</option>)}</select></label><label className="text-sm font-semibold">Município<input required name="municipality" className={input} /></label><label className="text-sm font-semibold">Região cafeeira<select name="coffeeRegionId" className={input}><option value="">Selecione</option>{regions.filter((region) => region.state === (unitState || unitSupplier.state)).map((region) => <option key={region.id} value={region.id}>{region.name}</option>)}</select></label><label className="text-sm font-semibold sm:col-span-2">Endereço<input name="address" className={input} /></label><label className="text-sm font-semibold">Área de café (ha)<input name="coffeeAreaHa" type="number" step="0.01" className={input} /></label><label className="text-sm font-semibold">Altitude (m)<input name="altitudeMeters" type="number" step="0.01" className={input} /></label><label className="text-sm font-semibold">Espécie produzida<select name="productionSpeciesId" className={input}><option value="">Opcional</option>{species.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Safra da produção<input name="productionHarvest" placeholder="2026/27" className={input} /></label><div className="sm:col-span-2"><p className="text-sm font-semibold">Cultivares produzidas (opcional)</p><div className="mt-2 flex flex-wrap gap-2">{species.flatMap((item) => item.varieties).slice(0, 38).map((cultivar) => <label key={cultivar.id} className="rounded-lg bg-stone-50 px-2 py-1 text-xs"><input type="checkbox" name="cultivarIds" value={cultivar.id} className="mr-1" />{cultivar.name}</label>)}</div></div></div><button className="mt-5 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">Salvar unidade/fazenda</button></form></div>}
  </div>;
}
