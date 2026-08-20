"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, Search, X } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { lookupBrazilianCep } from "@/lib/brazil-address";

const API = `${getApiBaseUrl()}/green-coffee-purchases`;
const input =
  "w-full rounded-xl border bg-stone-50 px-3 py-2.5 text-sm outline-none focus:border-forest-700";
const states = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];
const stateNames: Record<string, string> = {
  PR: "Paraná",
  AC: "Acre",
  AL: "Alagoas",
  AP: "Amapá",
  AM: "Amazonas",
  CE: "Ceará",
  DF: "Distrito Federal",
  MA: "Maranhão",
  MT: "Mato Grosso",
  MS: "Mato Grosso do Sul",
  PA: "Pará",
  PB: "Paraíba",
  PE: "Pernambuco",
  PI: "Piauí",
  RN: "Rio Grande do Norte",
  RS: "Rio Grande do Sul",
  RR: "Roraima",
  SC: "Santa Catarina",
  SE: "Sergipe",
  TO: "Tocantins",
  SP: "São Paulo",
  MG: "Minas Gerais",
  ES: "Espírito Santo",
  BA: "Bahia",
  RJ: "Rio de Janeiro",
  RO: "Rondônia",
  GO: "Goiás",
};
const types = [
  ["RURAL_PERSON", "Produtor Rural"],
  ["COMPANY", "Empresa"],
  ["COOPERATIVE", "Cooperativa"],
  ["ASSOCIATION", "Associação"],
  ["EXPORTER", "Exportador"],
  ["OTHER", "Outro"],
];
type Region = { id: string; state: string; name: string };
type Municipality = { ibgeCode: string; name: string; state: string };
type Species = {
  id: string;
  code: string;
  name: string;
  varieties: { id: string; name: string }[];
};
type Unit = {
  id: string;
  name: string;
  state: string;
  municipality?: string | null;
  ibgeCityCode?: string | null;
  postalCode?: string | null;
  district?: string | null;
  address?: string | null;
  addressComplement?: string | null;
  active: boolean;
  coffeeRegion?: Region | null;
  productions?: {
    species: Species;
    cultivar?: { name: string } | null;
    harvest?: string | null;
  }[];
};
type Supplier = {
  id: string;
  name: string;
  tradeName?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  supplierType: string;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postalCode?: string | null;
  district?: string | null;
  address?: string | null;
  addressComplement?: string | null;
  ibgeCityCode?: string | null;
  taxIdVerificationStatus?: VerificationStatus;
  taxIdVerifiedAt?: string | null;
  stateRegistration?: string | null;
  stateRegistrationType?: "NUMBER" | "EXEMPT" | "NON_TAXPAYER";
  stateRegistrationVerificationStatus?: VerificationStatus;
  stateRegistrationVerifiedAt?: string | null;
  active: boolean;
  originUnits: Unit[];
};
type VerificationStatus =
  | "VERIFIED_ACTIVE"
  | "VERIFIED_INACTIVE"
  | "INVALID"
  | "NOT_VERIFIED"
  | "SERVICE_UNAVAILABLE";
const verificationText: Record<VerificationStatus, string> = {
  VERIFIED_ACTIVE: "✅ Ativo",
  VERIFIED_INACTIVE: "❌ Inativo",
  INVALID: "❌ Inválido",
  NOT_VERIFIED: "⚠ Não verificado",
  SERVICE_UNAVAILABLE: "⚠ Serviço indisponível",
};
const digitsOnly = (value: string) => value.replace(/\D/g, "");
const validCpf = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 11 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const sum = Array.from(
      { length },
      (_, index) => Number(digits[index]) * (length + 1 - index),
    ).reduce((total, item) => total + item, 0);
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
};
const validCnpj = (value: string) => {
  const digits = digitsOnly(value);
  if (digits.length !== 14 || /^(\d)\1+$/.test(digits)) return false;
  const check = (length: number) => {
    const weights =
      length === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const sum = weights.reduce(
      (total, weight, index) => total + Number(digits[index]) * weight,
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  return check(12) === Number(digits[12]) && check(13) === Number(digits[13]);
};
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
const taxIdMessage = (value: string) => {
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
  if (!response.ok)
    throw new Error(data.message ?? "Não foi possível concluir a operação.");
  return data as T;
}

export default function SuppliersPage() {
  const [items, setItems] = useState<Supplier[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [species, setSpecies] = useState<Species[]>([]);
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [unitMunicipalities, setUnitMunicipalities] = useState<Municipality[]>(
    [],
  );
  const [municipalityLoading, setMunicipalityLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [detailsSupplier, setDetailsSupplier] = useState<Supplier | null>(null);
  const [unitSupplier, setUnitSupplier] = useState<Supplier | null>(null);
  const [unitState, setUnitState] = useState("");
  const [supplierState, setSupplierState] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [supplierIbgeCityCode, setSupplierIbgeCityCode] = useState("");
  const [supplierTaxId, setSupplierTaxId] = useState("");
  const [taxIdError, setTaxIdError] = useState("");
  const [stateRegistrationType, setStateRegistrationType] = useState<
    "NUMBER" | "EXEMPT" | "NON_TAXPAYER"
  >("NUMBER");
  const [supplierCep, setSupplierCep] = useState("");
  const [supplierDistrict, setSupplierDistrict] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierComplement, setSupplierComplement] = useState("");
  const [supplierCountry, setSupplierCountry] = useState("Brasil");
  const [cepStatus, setCepStatus] = useState<
    "idle" | "loading" | "found" | "not-found" | "error"
  >("idle");
  const [unitCity, setUnitCity] = useState("");
  const [unitIbgeCityCode, setUnitIbgeCityCode] = useState("");
  const [productionSpeciesId, setProductionSpeciesId] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    const [suppliers, refs] = await Promise.all([
      request<Supplier[]>(
        `${API}/suppliers?active=${activeFilter}${stateFilter ? `&state=${stateFilter}` : ""}`,
      ),
      request<{ regions: Region[]; species: Species[] }>(`${API}/references`),
    ]);
    setItems(suppliers);
    setRegions(refs.regions);
    setSpecies(refs.species);
  };
  useEffect(() => {
    void load().catch((error) =>
      setMessage(
        error instanceof Error
          ? error.message
          : "Falha ao carregar fornecedores.",
      ),
    );
  }, [activeFilter, stateFilter]);
  useEffect(() => {
    if (!supplierState) {
      setMunicipalities([]);
      return;
    }
    setMunicipalityLoading(true);
    void request<Municipality[]>(
      `${API}/references/municipalities?state=${supplierState}`,
    )
      .then((items) =>
        setMunicipalities((current) =>
          current.find(
            (item) =>
              item.name === supplierCity && item.state === supplierState,
          )
            ? [...items, current.find((item) => item.name === supplierCity)!]
            : items,
        ),
      )
      .catch(() => setMunicipalities([]))
      .finally(() => setMunicipalityLoading(false));
  }, [supplierState]);
  useEffect(() => {
    if (!unitState) {
      setUnitMunicipalities([]);
      return;
    }
    void request<Municipality[]>(
      `${API}/references/municipalities?state=${unitState}`,
    )
      .then(setUnitMunicipalities)
      .catch(() => setUnitMunicipalities([]));
  }, [unitState]);
  useEffect(() => {
    if (editingSupplier && supplierOpen) {
      setSupplierState(editingSupplier.state ?? "");
      setSupplierCity(editingSupplier.city ?? "");
      setSupplierIbgeCityCode(editingSupplier.ibgeCityCode ?? "");
      setSupplierTaxId(editingSupplier.taxId ?? "");
      setStateRegistrationType(
        editingSupplier.stateRegistrationType ?? "NUMBER",
      );
      setSupplierCep(editingSupplier.postalCode ?? "");
      setSupplierDistrict(editingSupplier.district ?? "");
      setSupplierAddress(editingSupplier.address ?? "");
      setSupplierComplement(editingSupplier.addressComplement ?? "");
      setSupplierCountry(editingSupplier.country ?? "Brasil");
    }
  }, [editingSupplier, supplierOpen]);
  useEffect(() => {
    if (unitSupplier) {
      setUnitCity("");
      setUnitIbgeCityCode("");
      setProductionSpeciesId("");
    }
  }, [unitSupplier]);

  const filtered = useMemo(
    () =>
      items.filter((item) =>
        `${item.name} ${item.tradeName ?? ""} ${item.legalName ?? ""} ${item.taxId ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [items, query],
  );
  const saveSupplier = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values: Record<string, unknown> = Object.fromEntries(form);
    values.active = form.get("active") === "true";
    values.taxId = supplierTaxId.replace(/\D/g, "") || undefined;
    values.stateRegistration =
      stateRegistrationType === "NUMBER"
        ? form.get("stateRegistration") || undefined
        : undefined;
    values.stateRegistrationType = stateRegistrationType;
    if (taxIdError) {
      setMessage(taxIdError);
      return;
    }
    try {
      await request(
        `${API}${editingSupplier ? `/suppliers/${editingSupplier.id}` : "/suppliers"}`,
        {
          method: editingSupplier ? "PATCH" : "POST",
          body: JSON.stringify(values),
        },
      );
      setSupplierOpen(false);
      setEditingSupplier(null);
      setMessage(
        editingSupplier ? "Fornecedor atualizado." : "Fornecedor cadastrado.",
      );
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao salvar fornecedor.",
      );
    }
  };
  const handleCepLookup = async () => {
    if (supplierCountry !== "Brasil") return;
    const digits = supplierCep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepStatus("loading");
    try {
      const result = await lookupBrazilianCep(supplierCep);
      if (!result) {
        setCepStatus("not-found");
        return;
      }
      setCepStatus("found");
      setSupplierState(result.state);
      setSupplierCity(result.city);
      setSupplierIbgeCityCode(result.ibgeCityCode ?? "");
      setSupplierDistrict(result.district);
      setSupplierAddress(result.address);
      setMunicipalities((current) =>
        current.some((item) => item.name === result.city)
          ? current
          : [
              ...current,
              {
                ibgeCode: result.ibgeCityCode ?? `cep-${result.city}`,
                name: result.city,
                state: result.state,
              },
            ],
      );
    } catch {
      setCepStatus("error");
    }
  };
  const saveUnit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!unitSupplier) return;
    const form = new FormData(event.currentTarget);
    const data = Object.fromEntries(form);
    const cultivarIds = form.getAll("cultivarIds").map(String);
    try {
      const unit = await request<Unit>(
        `${API}/suppliers/${unitSupplier.id}/origin-units`,
        { method: "POST", body: JSON.stringify(data) },
      );
      const speciesId = String(form.get("productionSpeciesId") || "");
      if (speciesId)
        await request(
          `${API}/suppliers/${unitSupplier.id}/origin-units/${unit.id}/production`,
          {
            method: "POST",
            body: JSON.stringify({
              speciesId,
              cultivarIds,
              harvest: form.get("productionHarvest") || undefined,
            }),
          },
        );
      setUnitSupplier(null);
      setMessage("Unidade/fazenda cadastrada.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Falha ao cadastrar unidade.",
      );
    }
  };
  const verify = async (
    supplierId: string,
    kind: "tax-id" | "state-registration",
  ) => {
    try {
      await request(`${API}/suppliers/${supplierId}/${kind}/verify`, {
        method: "POST",
      });
      setMessage("Verificação cadastral atualizada.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível verificar o cadastro.",
      );
    }
  };
  return (
    <div className="mx-auto max-w-[1480px]">
      <Link
        href="/cafe-verde"
        className="inline-flex items-center gap-2 text-xs font-bold text-forest-700"
      >
        <ArrowLeft size={14} />
        Café Verde
      </Link>
      <header className="mt-5 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">
            Cadastros-base
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Fornecedores
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Fornecedores, unidades/fazendas e origem do café verde.
          </p>
        </div>
        <button
          onClick={() => {
            setEditingSupplier(null);
            setSupplierState("");
            setSupplierCity("");
            setSupplierIbgeCityCode("");
            setSupplierTaxId("");
            setTaxIdError("");
            setStateRegistrationType("NUMBER");
            setSupplierCep("");
            setSupplierDistrict("");
            setSupplierAddress("");
            setSupplierComplement("");
            setSupplierCountry("Brasil");
            setCepStatus("idle");
            setSupplierOpen(true);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white"
        >
          <Plus size={16} />
          Novo fornecedor
        </button>
      </header>
      {message && (
        <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
          {message}
        </p>
      )}
      <div className="mt-7 flex flex-col gap-3 md:flex-row">
        <label className="flex flex-1 items-center gap-2 rounded-xl border bg-white px-3">
          <Search size={15} className="text-stone-400" />
          <input
            className="w-full py-3 text-sm outline-none"
            placeholder="Buscar nome, CPF/CNPJ..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          className={input + " md:max-w-48"}
          value={stateFilter}
          onChange={(event) => setStateFilter(event.target.value)}
        >
          <option value="">Todos os estados</option>
          {states.map((state) => (
            <option key={state}>{state}</option>
          ))}
        </select>
        <select
          className={input + " md:max-w-44"}
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
        >
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="">Todos</option>
        </select>
      </div>
      <div className="mt-6 space-y-4">
        {filtered.map((supplier) => (
          <Card key={supplier.id} className="p-5">
            <div className="flex flex-col justify-between gap-4 md:flex-row">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-bold">
                    {supplier.tradeName || supplier.name}
                  </h2>
                  <span className="rounded-full bg-stone-100 px-2 py-1 text-[11px] font-bold">
                    {supplier.active ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="mt-1 text-sm text-stone-500">
                  {supplier.legalName || supplier.name} ·{" "}
                  {supplier.taxId || "Documento não informado"}
                </p>
                {supplier.taxIdVerificationStatus && (
                  <p className="mt-1 text-xs text-stone-500">
                    {verificationText[supplier.taxIdVerificationStatus]}
                    {supplier.taxIdVerifiedAt
                      ? ` · Consultado em ${new Date(supplier.taxIdVerifiedAt).toLocaleString("pt-BR")}`
                      : ""}
                  </p>
                )}
                <p className="mt-1 text-xs text-stone-500">
                  {supplier.city || "—"}/{supplier.state || "—"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => {
                    setEditingSupplier(supplier);
                    setSupplierState(supplier.state ?? "");
                    setSupplierTaxId(supplier.taxId ?? "");
                    setSupplierCountry(supplier.country ?? "Brasil");
                    setSupplierOpen(true);
                  }}
                  className="min-h-10 rounded-xl border px-3 text-xs font-bold"
                >
                  Editar
                </button>
                <button
                  onClick={() => setDetailsSupplier(supplier)}
                  className="min-h-10 rounded-xl border px-3 text-xs font-bold"
                >
                  Detalhes
                </button>
                <button
                  onClick={() => {
                    setUnitSupplier(supplier);
                    setUnitState(supplier.state ?? "");
                  }}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-bold"
                >
                  <Plus size={14} />
                  Unidades/fazendas
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {supplier.originUnits.map((unit) => (
                <div
                  key={unit.id}
                  className="rounded-xl bg-stone-50 p-3 text-sm"
                >
                  <p className="font-semibold">
                    {unit.name}{" "}
                    <span className="text-xs font-normal text-stone-500">
                      · {unit.active ? "Ativa" : "Inativa"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-stone-500">
                    {unit.municipality || "—"}/{unit.state} ·{" "}
                    {unit.coffeeRegion?.name || "Região não informada"}
                  </p>
                </div>
              ))}
              {supplier.originUnits.length === 0 && (
                <p className="rounded-xl border border-dashed p-4 text-sm text-stone-500">
                  Nenhuma unidade/fazenda cadastrada.
                </p>
              )}
            </div>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="rounded-2xl border border-dashed p-12 text-center text-sm text-stone-500">
            Nenhum fornecedor encontrado.
          </div>
        )}
      </div>
      {supplierOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3">
          <form
            key={editingSupplier?.id ?? "new"}
            onSubmit={(event) => void saveSupplier(event)}
            className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {editingSupplier ? "Editar fornecedor" : "Novo fornecedor"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  setSupplierOpen(false);
                  setEditingSupplier(null);
                }}
              >
                <X />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-semibold">
                  Tipo
                  <select
                    name="supplierType"
                    className={input}
                    defaultValue={
                      editingSupplier?.supplierType ?? "RURAL_PERSON"
                    }
                  >
                    {types.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Nome/Razão social
                  <input
                    name="name"
                    required
                    defaultValue={editingSupplier?.name ?? ""}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold">
                  Nome fantasia
                  <input
                    name="tradeName"
                    defaultValue={editingSupplier?.tradeName ?? ""}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold">
                  CPF/CNPJ
                  <input
                    name="taxId"
                    value={formatTaxId(supplierTaxId)}
                    onChange={(event) => {
                      const value = formatTaxId(event.target.value);
                      setSupplierTaxId(value);
                      setTaxIdError(taxIdMessage(value));
                    }}
                    className={input}
                  />
                  {taxIdError && (
                    <span className="mt-1 block text-xs font-medium text-red-700">
                      {taxIdError}
                    </span>
                  )}
                  {editingSupplier && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void verify(editingSupplier.id, "tax-id")
                        }
                        className="text-xs font-bold text-forest-700"
                      >
                        Consultar cadastro
                      </button>
                      {editingSupplier.taxIdVerificationStatus && (
                        <span className="text-xs font-medium text-stone-500">
                          {
                            verificationText[
                              editingSupplier.taxIdVerificationStatus
                            ]
                          }
                          {editingSupplier.taxIdVerifiedAt
                            ? ` · ${new Date(editingSupplier.taxIdVerifiedAt).toLocaleString("pt-BR")}`
                            : ""}
                        </span>
                      )}
                    </div>
                  )}
                </label>
                <label className="text-sm font-semibold">
                  Inscrição Estadual
                  <div className="flex gap-2">
                    <input
                      name="stateRegistration"
                      defaultValue={editingSupplier?.stateRegistration ?? ""}
                      className={input}
                      disabled={stateRegistrationType !== "NUMBER"}
                    />
                    <select
                      name="stateRegistrationType"
                      className={input + " max-w-44"}
                      value={stateRegistrationType}
                      onChange={(event) =>
                        setStateRegistrationType(
                          event.target.value as
                            "NUMBER" | "EXEMPT" | "NON_TAXPAYER",
                        )
                      }
                    >
                      <option value="NUMBER">Número</option>
                      <option value="EXEMPT">Isento</option>
                      <option value="NON_TAXPAYER">Não contribuinte</option>
                    </select>
                  </div>
                  {editingSupplier && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void verify(editingSupplier.id, "state-registration")
                        }
                        className="text-xs font-bold text-forest-700"
                      >
                        Consultar cadastro
                      </button>
                      {editingSupplier.stateRegistrationVerificationStatus && (
                        <span className="text-xs font-medium text-stone-500">
                          {
                            verificationText[
                              editingSupplier
                                .stateRegistrationVerificationStatus
                            ]
                          }
                          {editingSupplier.stateRegistrationVerifiedAt
                            ? ` · ${new Date(editingSupplier.stateRegistrationVerifiedAt).toLocaleString("pt-BR")}`
                            : ""}
                        </span>
                      )}
                    </div>
                  )}
                </label>
                <label className="text-sm font-semibold">
                  Telefone
                  <input name="contactPhone" className={input} />
                </label>
                <label className="text-sm font-semibold">
                  WhatsApp
                  <input name="whatsapp" className={input} />
                </label>
                <label className="text-sm font-semibold">
                  E-mail
                  <input name="contactEmail" type="email" className={input} />
                </label>
                <label className="text-sm font-semibold">
                  Contato principal
                  <input name="contactName" className={input} />
                </label>
                <label className="text-sm font-semibold">
                  País
                  <select
                    name="country"
                    className={input}
                    value={supplierCountry}
                    onChange={(event) => setSupplierCountry(event.target.value)}
                  >
                    <option value="Brasil">Brasil</option>
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Estado
                  <select
                    name="state"
                    className={input}
                    value={supplierState}
                    onChange={(event) => {
                      setSupplierState(event.target.value);
                      setSupplierCity("");
                      setSupplierIbgeCityCode("");
                    }}
                  >
                    <option value="">Selecione o estado</option>
                    {states.map((state) => (
                      <option key={state} value={state}>
                        {state} — {stateNames[state]}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-sm font-semibold">
                  Município
                  <select
                    name="city"
                    className={input}
                    value={supplierCity}
                    onChange={(event) => {
                      const city = municipalities.find(
                        (item) => item.name === event.target.value,
                      );
                      setSupplierCity(event.target.value);
                      setSupplierIbgeCityCode(city?.ibgeCode ?? "");
                    }}
                    disabled={!supplierState}
                  >
                    <option value="">Selecione o município</option>
                    {municipalities.map((city) => (
                      <option key={city.ibgeCode} value={city.name}>
                        {city.name}
                      </option>
                    ))}
                  </select>
                </label>
                <input
                  type="hidden"
                  name="ibgeCityCode"
                  value={supplierIbgeCityCode}
                />
                <label className="text-sm font-semibold">
                  CEP
                  <input
                    name="postalCode"
                    inputMode="numeric"
                    pattern="[0-9]{5}-?[0-9]{3}"
                    placeholder="00000-000"
                    value={supplierCep.replace(/(\d{5})(\d)/, "$1-$2")}
                    onChange={(event) =>
                      setSupplierCep(
                        event.target.value.replace(/\D/g, "").slice(0, 8),
                      )
                    }
                    onBlur={() => void handleCepLookup()}
                    className={input}
                  />
                  {cepStatus !== "idle" && (
                    <span className="mt-1 block text-xs text-stone-500">
                      {cepStatus === "loading"
                        ? "Consultando CEP..."
                        : cepStatus === "found"
                          ? "Endereço encontrado."
                          : cepStatus === "not-found"
                            ? "CEP não encontrado."
                            : "Serviço de CEP indisponível."}
                    </span>
                  )}
                </label>
                <label className="text-sm font-semibold">
                  Bairro / Distrito / Localidade
                  <input
                    name="district"
                    value={supplierDistrict}
                    onChange={(event) =>
                      setSupplierDistrict(event.target.value)
                    }
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Endereço
                  <input
                    name="address"
                    value={supplierAddress}
                    onChange={(event) => setSupplierAddress(event.target.value)}
                    className={input}
                  />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">
                  Complemento
                  <input
                    name="addressComplement"
                    value={supplierComplement}
                    onChange={(event) =>
                      setSupplierComplement(event.target.value)
                    }
                    className={input}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
                  <input
                    type="checkbox"
                    name="active"
                    value="true"
                    defaultChecked={editingSupplier?.active ?? true}
                  />{" "}
                  Ativo
                </label>
              </div>
            </div>
            <div className="sticky bottom-0 mt-4 flex justify-end gap-2 border-t border-stone-200 bg-white pt-4">
              <button
                type="button"
                onClick={() => {
                  setSupplierOpen(false);
                  setEditingSupplier(null);
                }}
                className="min-h-11 rounded-xl border border-stone-200 px-4 text-sm font-bold text-stone-700"
              >
                Cancelar
              </button>
              <button className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">
                Salvar fornecedor
              </button>
            </div>
          </form>
        </div>
      )}
      {detailsSupplier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3">
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Detalhes do fornecedor</h2>
              <button onClick={() => setDetailsSupplier(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
              <p>
                <span className="text-stone-500">Nome</span>
                <br />
                <b>{detailsSupplier.name}</b>
              </p>
              <p>
                <span className="text-stone-500">Fantasia</span>
                <br />
                <b>{detailsSupplier.tradeName || "—"}</b>
              </p>
              <p>
                <span className="text-stone-500">Documento</span>
                <br />
                <b>{detailsSupplier.taxId || "—"}</b>
              </p>
              <p>
                <span className="text-stone-500">Localização</span>
                <br />
                <b>
                  {detailsSupplier.city || "—"}/{detailsSupplier.state || "—"}
                </b>
              </p>
              <p>
                <span className="text-stone-500">Unidades ativas</span>
                <br />
                <b>
                  {
                    detailsSupplier.originUnits.filter((unit) => unit.active)
                      .length
                  }
                </b>
              </p>
            </div>
            <button
              onClick={() => setDetailsSupplier(null)}
              className="mt-6 min-h-10 rounded-xl border px-4 text-sm font-bold"
            >
              Fechar
            </button>
          </Card>
        </div>
      )}
      {unitSupplier && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-3">
          <form
            onSubmit={(event) => void saveUnit(event)}
            className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase text-forest-700">
                  {unitSupplier.name}
                </p>
                <h2 className="text-xl font-bold">Nova unidade/fazenda</h2>
              </div>
              <button type="button" onClick={() => setUnitSupplier(null)}>
                <X />
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-semibold">
                Nome da Fazenda/Unidade
                <input required name="name" className={input} />
              </label>
              <label className="text-sm font-semibold">
                CPF/CNPJ próprio
                <input name="taxId" className={input} />
              </label>
              <label className="text-sm font-semibold">
                Inscrição Estadual
                <input name="stateRegistration" className={input} />
              </label>
              <label className="text-sm font-semibold">
                País
                <select name="country" className={input} defaultValue="Brasil">
                  <option value="Brasil">Brasil</option>
                </select>
              </label>
              <label className="text-sm font-semibold">
                Estado
                <select
                  required
                  name="state"
                  className={input}
                  value={unitState}
                  onChange={(event) => {
                    setUnitState(event.target.value);
                    setUnitCity("");
                    setUnitIbgeCityCode("");
                  }}
                >
                  <option value="">Selecione o estado</option>
                  {states.map((state) => (
                    <option key={state} value={state}>
                      {state} — {stateNames[state]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Município
                <select
                  required
                  name="municipality"
                  className={input}
                  value={unitCity}
                  onChange={(event) => {
                    const city = unitMunicipalities.find(
                      (item) => item.name === event.target.value,
                    );
                    setUnitCity(event.target.value);
                    setUnitIbgeCityCode(city?.ibgeCode ?? "");
                  }}
                  disabled={!unitState}
                >
                  <option value="">
                    {municipalityLoading
                      ? "Carregando municípios..."
                      : "Selecione o município"}
                  </option>
                  {unitMunicipalities.map((city) => (
                    <option key={city.ibgeCode} value={city.name}>
                      {city.name}
                    </option>
                  ))}
                </select>
              </label>
              <input
                type="hidden"
                name="ibgeCityCode"
                value={unitIbgeCityCode}
              />
              <label className="text-sm font-semibold">
                CEP
                <input
                  name="postalCode"
                  inputMode="numeric"
                  pattern="[0-9]{5}-?[0-9]{3}"
                  placeholder="00000-000"
                  className={input}
                />
              </label>
              <label className="text-sm font-semibold">
                Bairro / Distrito / Localidade
                <input name="district" className={input} />
              </label>
              <label className="text-sm font-semibold">
                Região cafeeira
                <select name="coffeeRegionId" className={input}>
                  <option value="">Selecione</option>
                  {regions
                    .filter((region) => region.state === unitState)
                    .map((region) => (
                      <option key={region.id} value={region.id}>
                        {region.name}
                      </option>
                    ))}
                </select>
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Endereço
                <input name="address" className={input} />
              </label>
              <label className="text-sm font-semibold sm:col-span-2">
                Complemento
                <input name="addressComplement" className={input} />
              </label>
              <label className="text-sm font-semibold">
                Área de café (ha)
                <input
                  name="coffeeAreaHa"
                  type="number"
                  step="0.01"
                  className={input}
                />
              </label>
              <label className="text-sm font-semibold">
                Altitude (m)
                <input
                  name="altitudeMeters"
                  type="number"
                  step="0.01"
                  className={input}
                />
              </label>
              <label className="text-sm font-semibold">
                Espécie produzida
                <select
                  name="productionSpeciesId"
                  className={input}
                  value={productionSpeciesId}
                  onChange={(event) =>
                    setProductionSpeciesId(event.target.value)
                  }
                >
                  <option value="">Opcional</option>
                  {species.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold">
                Safra da produção
                <input
                  name="productionHarvest"
                  placeholder="2026/27"
                  className={input}
                />
              </label>
              <div className="sm:col-span-2">
                <p className="text-sm font-semibold">
                  Cultivares produzidas (opcional)
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(
                    species.find((item) => item.id === productionSpeciesId)
                      ?.varieties ?? []
                  ).map((cultivar) => (
                    <label
                      key={cultivar.id}
                      className="rounded-lg bg-stone-50 px-2 py-1 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="cultivarIds"
                        value={cultivar.id}
                        className="mr-1"
                      />
                      {cultivar.name}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button className="mt-5 min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">
              Salvar unidade/fazenda
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
