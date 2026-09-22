"use client";

import Link from "next/link";
import { FormEvent, ReactNode, useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgePercent,
  Plus,
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
  code: string;
  description?: string;
  ownerName: string;
  discountType: string;
  discountValue: string | number;
  commissionType: string;
  commissionValue: string | number;
  commissionBasis: string;
  usageCount: number;
  usageLimit?: number;
  active: boolean;
  commissionTotalCents: number;
  redemptionCount: number;
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
  const [message, setMessage] = useState("");
  const load = async () => {
    const [couponRows, partnerRows] = await Promise.all([
      api<Coupon[]>("/storefront/coupons"),
      api<Partner[]>("/storefront/partners"),
    ]);
    setCoupons(couponRows);
    setPartners(partnerRows.filter((item) => item.active));
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
            Cada uso confirmado gera o desconto do cliente e reserva
            automaticamente a comissão do proprietário no financeiro.
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
            <Field label="Desconto">
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
            <Field label="Comissão">
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
      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {coupons.map((coupon) => (
          <Card key={coupon.id} className="p-5">
            <div className="flex items-start justify-between">
              <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-[#087568]">
                <BadgePercent size={18} />
              </span>
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
            <h2 className="mt-4 text-xl font-bold tracking-wide">
              {coupon.code}
            </h2>
            <p className="text-xs text-stone-500">
              {coupon.ownerName} · {coupon.description || "Sem descrição"}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
              <Metric
                label="Desconto"
                value={`${Number(coupon.discountValue).toFixed(2)}${coupon.discountType === "PERCENT" ? "%" : " R$"}`}
              />
              <Metric
                label="Comissão"
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
