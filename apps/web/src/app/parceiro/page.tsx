"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeDollarSign,
  CheckCircle2,
  LogOut,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TicketPercent,
} from "lucide-react";
import { Logo } from "@/components/logo";

type PortalData = {
  partner: {
    name: string;
    contactName?: string | null;
    email?: string | null;
  };
  metrics: {
    businessCount: number;
    salesCents: number;
    commissionEarnedCents: number;
    commissionPaidCents: number;
    commissionOpenCents: number;
  };
  coupons: Array<{
    id: string;
    code: string;
    description?: string | null;
    discountType: string;
    discountValue: number | string;
    commissionType: string;
    commissionValue: number | string;
    usageLimit?: number | null;
    confirmedUses: number;
    commissionCents: number;
    validUntil?: string | null;
    active: boolean;
  }>;
  businesses: Array<{
    id: string;
    orderCode: string;
    couponCode: string;
    netSubtotalCents: number;
    discountCents: number;
    commissionCents: number;
    commissionOpenCents: number;
    payableStatus?: string | null;
    commissionPaidAt?: string | null;
    createdAt: string;
  }>;
  updatedAt: string;
};

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const cents = (value: number) => money.format(Number(value || 0) / 100);

export default function PartnerPortalPage() {
  const router = useRouter();
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/partner-portal/summary", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (response.status === 401) {
        router.replace("/login?returnTo=%2Fparceiro");
        return;
      }
      if (!response.ok)
        throw new Error(
          payload.message || "Não foi possível carregar o portal.",
        );
      setData(payload as PortalData);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o portal.",
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  const logout = async () => {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => undefined);
    router.replace("/login?returnTo=%2Fparceiro");
  };

  return (
    <main className="min-h-screen bg-[#f5f3ed] text-[#14201d]">
      <header className="border-b border-black/10 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <div className="flex items-center gap-5">
            <Logo />
            <div className="hidden border-l border-stone-200 pl-5 sm:block">
              <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087568]">
                Portal do parceiro
              </p>
              <p className="mt-1 text-xs text-stone-500">
                Negócios e comissões da loja Bispo
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-2 rounded-xl border border-stone-200 px-3 py-2 text-xs font-bold text-stone-600"
          >
            <LogOut size={15} /> Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-7 px-5 py-7 sm:px-8 sm:py-10">
        {loading && !data && (
          <div className="rounded-3xl border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">
            Carregando seus negócios…
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800">
            <p className="font-bold">Não foi possível abrir o portal.</p>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex items-center gap-2 font-bold"
            >
              <RefreshCw size={14} /> Tentar novamente
            </button>
          </div>
        )}

        {data && (
          <>
            <section className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087568]">
                  Visão exclusiva
                </p>
                <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">
                  Olá, {data.partner.contactName || data.partner.name}.
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                  Aqui aparecem somente negócios atribuídos aos seus cupons.
                </p>
              </div>
              <p className="text-xs text-stone-400">
                Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
              </p>
            </section>

            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <Metric
                icon={ShoppingBag}
                label="Negócios confirmados"
                value={String(data.metrics.businessCount)}
              />
              <Metric
                icon={ReceiptText}
                label="Vendas atribuídas"
                value={cents(data.metrics.salesCents)}
              />
              <Metric
                icon={BadgeDollarSign}
                label="Comissão gerada"
                value={cents(data.metrics.commissionEarnedCents)}
              />
              <Metric
                icon={CheckCircle2}
                label="Comissão paga"
                value={cents(data.metrics.commissionPaidCents)}
              />
              <Metric
                icon={BadgeDollarSign}
                label="Comissão a receber"
                value={cents(data.metrics.commissionOpenCents)}
              />
            </section>

            <section>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087568]">
                  Conversão
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Meus cupons</h2>
              </div>
              {data.coupons.length ? (
                <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                  {data.coupons.map((coupon) => (
                    <article
                      key={coupon.id}
                      className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-2xl font-bold tracking-tight">
                            {coupon.code}
                          </p>
                          <p className="mt-1 text-xs text-stone-500">
                            {coupon.description || "Cupom de parceria"}
                          </p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${coupon.active ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}
                        >
                          {coupon.active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                        <Mini
                          label="Benefício"
                          value={`${Number(coupon.discountValue).toFixed(2)}${coupon.discountType === "PERCENT" ? "%" : " R$"}`}
                        />
                        <Mini
                          label="Comissão"
                          value={`${Number(coupon.commissionValue).toFixed(2)}${coupon.commissionType === "PERCENT" ? "%" : " R$"}`}
                        />
                        <Mini
                          label="Usos"
                          value={`${coupon.confirmedUses}${coupon.usageLimit ? ` / ${coupon.usageLimit}` : ""}`}
                        />
                      </div>
                      <p className="mt-4 border-t pt-4 text-xs text-stone-500">
                        Comissão acumulada:{" "}
                        <strong className="text-[#14201d]">
                          {cents(coupon.commissionCents)}
                        </strong>
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <Empty text="Nenhum cupom foi vinculado ao seu cadastro." />
              )}
            </section>

            <section>
              <div className="mb-4">
                <p className="text-xs font-bold uppercase tracking-[.16em] text-[#087568]">
                  Histórico
                </p>
                <h2 className="mt-1 text-2xl font-semibold">Meus negócios</h2>
              </div>
              {data.businesses.length ? (
                <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-xs">
                      <thead className="border-b bg-stone-50 text-[10px] uppercase tracking-wider text-stone-500">
                        <tr>
                          <th className="px-5 py-4">Data</th>
                          <th className="px-5 py-4">Negócio</th>
                          <th className="px-5 py-4">Cupom</th>
                          <th className="px-5 py-4">Venda líquida</th>
                          <th className="px-5 py-4">Comissão</th>
                          <th className="px-5 py-4">Situação</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {data.businesses.map((business) => (
                          <tr key={business.id}>
                            <td className="px-5 py-4 text-stone-500">
                              {new Date(business.createdAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </td>
                            <td className="px-5 py-4 font-bold">
                              {business.orderCode}
                            </td>
                            <td className="px-5 py-4">{business.couponCode}</td>
                            <td className="px-5 py-4">
                              {cents(business.netSubtotalCents)}
                            </td>
                            <td className="px-5 py-4 font-bold">
                              {cents(business.commissionCents)}
                            </td>
                            <td className="px-5 py-4">
                              <CommissionStatus
                                status={business.payableStatus}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <Empty text="Os negócios aparecerão aqui após a confirmação do pagamento de uma compra com seu cupom." />
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof TicketPercent;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
      <Icon size={18} className="text-[#087568]" />
      <p className="mt-5 text-[10px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-stone-50 p-3">
      <p className="text-[9px] font-bold uppercase tracking-wider text-stone-400">
        {label}
      </p>
      <p className="mt-1 font-bold">{value}</p>
    </div>
  );
}

function CommissionStatus({ status }: { status?: string | null }) {
  const paid = status === "PAID";
  const partial = status === "PARTIALLY_PAID";
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${paid ? "bg-emerald-50 text-emerald-700" : partial ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}
    >
      {paid ? "Paga" : partial ? "Parcial" : "A receber"}
    </span>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-500">
      <TicketPercent size={22} className="mx-auto text-stone-300" />
      <p className="mt-3">{text}</p>
    </div>
  );
}
