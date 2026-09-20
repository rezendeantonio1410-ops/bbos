"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Pencil, Plus, X } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();
type Partner = {
  id: string;
  name: string;
  taxId?: string;
  contactName?: string;
  phone?: string;
  email?: string;
  pixKey?: string;
  active: boolean;
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message || "Não foi possível concluir a operação.");
  return body as T;
}

export default function StorefrontPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [selected, setSelected] = useState<Partner | null>(null);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const load = async () =>
    setPartners(await api<Partner[]>("/storefront/partners"));
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api(
        selected
          ? `/storefront/partners/${selected.id}`
          : "/storefront/partners",
        {
          method: selected ? "PATCH" : "POST",
          body: JSON.stringify({
            name: data.get("name"),
            taxId: data.get("taxId"),
            contactName: data.get("contactName"),
            phone: data.get("phone"),
            email: data.get("email"),
            pixKey: data.get("pixKey"),
            active: data.get("active") === "true",
          }),
        },
      );
      setOpen(false);
      setSelected(null);
      setMessage(selected ? "Parceiro atualizado." : "Parceiro cadastrado.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível salvar o parceiro.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-[1400px] space-y-5 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/commerce"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#087568]"
          >
            <ArrowLeft size={14} /> Commerce
          </Link>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-[#087568]">
            Café torrado · loja
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[#14201d]">
            Parceiros de venda
          </h1>
          <p className="mt-2 text-sm text-stone-500">
            Proprietários de cupons e beneficiários de comissões da loja. Este
            cadastro é separado dos corretores de café verde.
          </p>
        </div>
        <button
          onClick={() => {
            setSelected(null);
            setOpen(true);
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-3 text-xs font-bold text-white"
        >
          <Plus size={15} /> Novo parceiro
        </button>
      </header>
      {message && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          {message}
        </p>
      )}
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {partners.map((partner) => (
          <Card key={partner.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-bold text-[#14201d]">{partner.name}</h2>
                <p className="mt-1 text-xs text-stone-500">
                  {partner.contactName || "Sem contato informado"}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold ${partner.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
              >
                {partner.active ? "Ativo" : "Inativo"}
              </span>
            </div>
            <p className="mt-4 text-xs text-stone-500">
              {partner.email || partner.phone || "Dados de contato pendentes"}
            </p>
            <button
              onClick={() => {
                setSelected(partner);
                setOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-[#087568]"
            >
              <Pencil size={13} /> Editar
            </button>
          </Card>
        ))}
      </section>
      {partners.length === 0 && (
        <Card className="p-8 text-center text-sm text-stone-500">
          Nenhum parceiro de venda cadastrado.
        </Card>
      )}
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
            <header className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="font-bold">
                {selected ? "Editar parceiro" : "Novo parceiro de venda"}
              </h2>
              <button aria-label="Fechar" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </header>
            <form onSubmit={save} className="grid gap-4 p-6 md:grid-cols-2">
              <Field label="Nome completo">
                <input name="name" required defaultValue={selected?.name} />
              </Field>
              <Field label="CPF/CNPJ">
                <input name="taxId" defaultValue={selected?.taxId} />
              </Field>
              <Field label="Contato principal">
                <input
                  name="contactName"
                  defaultValue={selected?.contactName}
                />
              </Field>
              <Field label="Telefone/WhatsApp internacional">
                <input
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  placeholder="+5543991820201"
                  pattern="\+[1-9][0-9]{7,14}"
                  title="Use +, código do país, DDD e número. Ex.: +5543991820201"
                  defaultValue={selected?.phone}
                />
              </Field>
              <Field label="E-mail">
                <input
                  name="email"
                  type="email"
                  defaultValue={selected?.email}
                />
              </Field>
              <Field label="Chave Pix">
                <input name="pixKey" defaultValue={selected?.pixKey} />
              </Field>
              <Field label="Status">
                <select
                  name="active"
                  defaultValue={String(selected?.active ?? true)}
                >
                  <option value="true">Ativo</option>
                  <option value="false">Inativo</option>
                </select>
              </Field>
              <div className="flex items-end justify-end gap-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl border px-4 py-2.5 text-xs font-bold"
                >
                  Cancelar
                </button>
                <button className="rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white">
                  Salvar parceiro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-xs font-bold text-stone-700">
      {label}
      <div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:px-3 [&_input]:py-2.5 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5">
        {children}
      </div>
    </label>
  );
}
