"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  Pencil,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
type Partner = { id: string; name: string; active: boolean };
type Coupon = {
  id: string;
  partnerId: string;
  code: string;
  description?: string;
  ownerName: string;
  discountType: string;
  discountValue: string | number;
  commissionType: string;
  commissionValue: string | number;
  commissionBasis: string;
  minimumSubtotalCents: number;
  usageCount: number;
  usageLimit?: number;
  active: boolean;
  commissionTotalCents: number;
  redemptionCount: number;
  linkedOrderCount: number;
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

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    const [couponRows, partnerRows] = await Promise.all([
      api<Coupon[]>("/storefront/coupons"),
      api<Partner[]>("/storefront/partners"),
    ]);
    setCoupons(couponRows);
    setPartners(partnerRows.filter((item) => item.active));
    setLoaded(true);
  };
  useEffect(() => {
    void load().catch((error) => setMessage(error.message));
  }, []);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      await api("/storefront/coupons", {
        method: "POST",
        body: JSON.stringify({
          code: data.get("code"),
          description: data.get("description"),
          partnerId: data.get("partnerId"),
          discountType: data.get("discountType"),
          discountValue: Number(data.get("discountValue")),
          commissionType: data.get("commissionType"),
          commissionValue: Number(data.get("commissionValue")),
          commissionBasis: data.get("commissionBasis"),
          minimumSubtotalCents: Math.round(
            Number(data.get("minimumSubtotal")) * 100,
          ),
          usageLimit: data.get("usageLimit")
            ? Number(data.get("usageLimit"))
            : null,
        }),
      });
      form.reset();
      setOpen(false);
      setMessage("Cupom criado e pronto para uso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível criar o cupom.",
      );
    }
  }

  async function toggle(coupon: Coupon) {
    await api(`/storefront/coupons/${coupon.id}`, {
      method: "PATCH",
      body: JSON.stringify({ active: !coupon.active }),
    });
    await load();
  }

  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setMessage("");
    const data = new FormData(event.currentTarget);
    try {
      await api(`/storefront/coupons/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          code: data.get("code"),
          description: data.get("description"),
          partnerId: data.get("partnerId"),
          discountType: data.get("discountType"),
          discountValue: Number(data.get("discountValue")),
          commissionType: data.get("commissionType"),
          commissionValue: Number(data.get("commissionValue")),
          commissionBasis: data.get("commissionBasis"),
          minimumSubtotalCents: Math.round(
            Number(data.get("minimumSubtotal")) * 100,
          ),
          usageLimit: data.get("usageLimit")
            ? Number(data.get("usageLimit"))
            : null,
        }),
      });
      setEditing(null);
      setMessage("Cupom atualizado com sucesso.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o cupom.",
      );
    }
  }

  async function remove(coupon: Coupon) {
    if (confirmDelete !== coupon.id) {
      setConfirmDelete(coupon.id);
      return;
    }
    setMessage("");
    try {
      await api(`/storefront/coupons/${coupon.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      setMessage(`Cupom ${coupon.code} excluído.`);
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o cupom.",
      );
    }
  }

  return (
    <main className="mx-auto max-w-[1500px] space-y-5 p-5 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/commerce"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#087568]"
          >
            <ArrowLeft size={14} /> Commerce
          </Link>
          <p className="mt-5 text-[10px] font-bold uppercase tracking-[.16em] text-[#087568]">
            Parcerias e conversão
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-[#14201d]">
            Cupons e comissões
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            Configure separadamente o benefício do comprador e a remuneração do
            parceiro. Cada uso confirmado aplica o desconto ao cliente e reserva
            automaticamente a comissão no financeiro.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/commerce/parceiros"
            className="inline-flex items-center rounded-xl border border-[#087568] px-4 py-3 text-xs font-bold text-[#087568]"
          >
            Parceiros de venda
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-3 text-xs font-bold text-white"
          >
            <Plus size={15} /> Novo cupom
          </button>
        </div>
      </header>
      {message && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900">
          {message}
        </p>
      )}
      {open && (
        <Card className="p-5">
          <form
            onSubmit={create}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <Field label="Código">
              <input name="code" required placeholder="CUPOM10" />
            </Field>
            <Field label="Parceiro proprietário">
              <select name="partnerId" required>
                <option value="">Selecione</option>
                {partners.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              {partners.length === 0 && (
                <Link
                  href="/commerce/parceiros"
                  className="mt-2 inline-block text-[11px] font-bold text-[#087568]"
                >
                  Cadastrar parceiro de venda
                </Link>
              )}
            </Field>
            <Field label="Descrição">
              <input name="description" placeholder="Parceria Felipe" />
            </Field>
            <Field label="Subtotal mínimo (R$)">
              <input
                name="minimumSubtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
              />
            </Field>
            <Field label="Desconto ao cliente">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  name="discountValue"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                />
                <select name="discountType">
                  <option value="PERCENT">%</option>
                  <option value="FIXED">R$</option>
                </select>
              </div>
            </Field>
            <Field label="Comissão do parceiro">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  name="commissionValue"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                />
                <select name="commissionType">
                  <option value="PERCENT">%</option>
                  <option value="FIXED">R$</option>
                </select>
              </div>
            </Field>
            <Field label="Base da comissão">
              <select name="commissionBasis">
                <option value="NET_SUBTOTAL">Após desconto</option>
                <option value="GROSS_SUBTOTAL">Antes do desconto</option>
              </select>
              <p className="mt-2 text-[10px] font-normal leading-relaxed text-stone-500">
                Exemplo: em R$ 100,00, desconto de 3% e comissão de 10% geram R$
                3,00 para o cliente e R$ 9,70 de comissão após o desconto — ou
                R$ 10,00 antes do desconto.
              </p>
            </Field>
            <Field label="Limite de usos">
              <input
                name="usageLimit"
                type="number"
                min="1"
                placeholder="Sem limite"
              />
            </Field>
            <div className="md:col-span-2 xl:col-span-4 flex justify-end">
              <button className="rounded-xl bg-[#087568] px-5 py-3 text-xs font-bold text-white">
                Criar cupom
              </button>
            </div>
          </form>
        </Card>
      )}
      {editing && (
        <Card className="border-[#087568] p-5">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-[.16em] text-[#087568]">
              Ajuste permitido — nenhum negócio vinculado
            </p>
            <h2 className="mt-1 text-lg font-bold text-[#14201d]">
              Editar cupom {editing.code}
            </h2>
          </div>
          <form
            onSubmit={update}
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <Field label="Código/nome do cupom">
              <input name="code" required defaultValue={editing.code} />
            </Field>
            <Field label="Parceiro proprietário">
              <select
                name="partnerId"
                required
                defaultValue={editing.partnerId}
              >
                {partners.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descrição">
              <input
                name="description"
                defaultValue={editing.description || ""}
              />
            </Field>
            <Field label="Subtotal mínimo (R$)">
              <input
                name="minimumSubtotal"
                type="number"
                min="0"
                step="0.01"
                defaultValue={Number(editing.minimumSubtotalCents || 0) / 100}
              />
            </Field>
            <Field label="Desconto ao cliente">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  name="discountValue"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={Number(editing.discountValue)}
                />
                <select name="discountType" defaultValue={editing.discountType}>
                  <option value="PERCENT">%</option>
                  <option value="FIXED">R$</option>
                </select>
              </div>
            </Field>
            <Field label="Comissão do parceiro">
              <div className="grid grid-cols-[1fr_110px] gap-2">
                <input
                  name="commissionValue"
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={Number(editing.commissionValue)}
                />
                <select
                  name="commissionType"
                  defaultValue={editing.commissionType}
                >
                  <option value="PERCENT">%</option>
                  <option value="FIXED">R$</option>
                </select>
              </div>
            </Field>
            <Field label="Base da comissão">
              <select
                name="commissionBasis"
                defaultValue={editing.commissionBasis}
              >
                <option value="NET_SUBTOTAL">Após desconto</option>
                <option value="GROSS_SUBTOTAL">Antes do desconto</option>
              </select>
            </Field>
            <Field label="Limite de usos">
              <input
                name="usageLimit"
                type="number"
                min="1"
                placeholder="Sem limite"
                defaultValue={editing.usageLimit || ""}
              />
            </Field>
            <div className="flex justify-end gap-2 md:col-span-2 xl:col-span-4">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-stone-200 px-5 py-3 text-xs font-bold text-stone-600"
              >
                Cancelar
              </button>
              <button className="rounded-xl bg-[#087568] px-5 py-3 text-xs font-bold text-white">
                Salvar alterações
              </button>
            </div>
          </form>
        </Card>
      )}
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {loaded && coupons.length === 0 && (
          <Card className="p-8 text-center lg:col-span-2 xl:col-span-3">
            <BadgePercent size={28} className="mx-auto text-stone-300" />
            <h2 className="mt-3 text-base font-bold text-[#14201d]">
              Nenhum cupom cadastrado
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              A base está pronta para começar com os parceiros e as regras
              corretas.
            </p>
          </Card>
        )}
        {coupons.map((coupon) => (
          <Card key={coupon.id} className="p-5">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-[#087568]">
                <BadgePercent size={18} />
              </span>
              <div className="flex items-center gap-2">
                {coupon.linkedOrderCount === 0 &&
                  coupon.redemptionCount === 0 && (
                    <>
                      <button
                        onClick={() => {
                          setEditing(coupon);
                          setOpen(false);
                          setConfirmDelete(null);
                        }}
                        className="rounded-lg p-1.5 text-stone-500 hover:bg-stone-100"
                        aria-label={`Editar ${coupon.code}`}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        onClick={() => void remove(coupon)}
                        className={`rounded-lg p-1.5 text-xs font-bold ${
                          confirmDelete === coupon.id
                            ? "bg-red-600 px-2 text-white"
                            : "text-red-600 hover:bg-red-50"
                        }`}
                        aria-label={
                          confirmDelete === coupon.id
                            ? `Confirmar exclusão de ${coupon.code}`
                            : `Excluir ${coupon.code}`
                        }
                      >
                        {confirmDelete === coupon.id ? (
                          "Confirmar exclusão"
                        ) : (
                          <Trash2 size={18} />
                        )}
                      </button>
                    </>
                  )}
                <button
                  onClick={() => void toggle(coupon)}
                  className="text-stone-500"
                  aria-label={coupon.active ? "Desativar" : "Ativar"}
                >
                  {coupon.active ? (
                    <ToggleRight size={28} className="text-[#087568]" />
                  ) : (
                    <ToggleLeft size={28} />
                  )}
                </button>
              </div>
            </div>
            <h2 className="mt-4 text-xl font-bold tracking-wide">
              {coupon.code}
            </h2>
            <p className="text-xs text-stone-500">
              {coupon.ownerName} · {coupon.description || "Sem descrição"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Metric
                label="Desconto cliente"
                value={`${Number(coupon.discountValue).toFixed(2)}${coupon.discountType === "PERCENT" ? "%" : " R$"}`}
              />
              <Metric
                label="Comissão parceiro"
                value={`${Number(coupon.commissionValue).toFixed(2)}${coupon.commissionType === "PERCENT" ? "%" : " R$"}`}
              />
              <Metric
                label="Usos"
                value={`${coupon.usageCount}${coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}`}
              />
              <Metric
                label="Reservado"
                value={money.format(
                  Number(coupon.commissionTotalCents || 0) / 100,
                )}
              />
            </div>
            {(coupon.linkedOrderCount > 0 || coupon.redemptionCount > 0) && (
              <p className="mt-3 text-[10px] leading-relaxed text-stone-500">
                Este cupom possui negócio vinculado. O histórico financeiro foi
                protegido; ainda é possível ativar ou desativar o cupom.
              </p>
            )}
          </Card>
        ))}
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="text-xs font-bold text-stone-700">
      {label}
      <div className="mt-1 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:px-3 [&_input]:py-2.5 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2.5">
        {children}
      </div>
    </label>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-stone-50 p-3">
      <small className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </small>
      <p className="mt-1 font-bold text-[#14201d]">{value}</p>
    </div>
  );
}
