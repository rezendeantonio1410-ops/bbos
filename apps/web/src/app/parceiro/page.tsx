"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  Factory,
  FileCheck2,
  LogOut,
  PackageCheck,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  TicketPercent,
} from "lucide-react";
import { Logo } from "@/components/logo";
import type { SessionIdentity } from "@/lib/auth-session";
import { PartnerOrderWorkspace } from "./PartnerOrderWorkspace";

type PortalData = {
  partner: {
    name: string;
    contactName?: string | null;
    email?: string | null;
    portalAccessLevel: "VIEWER" | "SELLER" | "SALES_MANAGER" | "DISTRIBUTOR";
  };
  capabilities: {
    canCreateCustomers: boolean;
    canCreateOrders: boolean;
    canManageCustomerPortfolio: boolean;
    canRequestCredit: boolean;
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
  partnerOrders: Array<{
    id: string;
    code: string;
    status: string;
    totalAmount: number | string;
    orderedAt: string;
    customerName: string;
    paymentType?: "CASH" | "TERM" | null;
    paymentTermsSnapshot?: string | null;
    receivableStatus?: string | null;
    dueDate?: string | null;
    receivableAmount?: number | string | null;
    openAmount?: number | string | null;
    paymentDate?: string | null;
    invoiceNumber?: string | null;
    invoiceStatus?: string | null;
    invoicePdfAvailable?: boolean;
    billingAvailable?: boolean;
  }>;
  notifications: Array<{
    id: string;
    orderId: string;
    orderCode: string;
    eventType: string;
    title: string;
    detail: string;
    source: string;
    occurredAt: string;
  }>;
  updatedAt: string;
};

type AccessIssue =
  | {
      kind: "INTERNAL_PROFILE";
      user: SessionIdentity;
    }
  | {
      kind: "PARTNER_ACCESS";
      user?: SessionIdentity;
    };

const internalRoleLabel: Record<string, string> = {
  ADMIN: "Administrador",
  EXECUTIVE: "Diretoria",
  SALES: "Comercial",
  FINANCE: "Financeiro",
  INDUSTRIAL: "Industrial",
  MARKETPLACE_OPERATOR: "Operador de marketplace",
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
  const [accessIssue, setAccessIssue] = useState<AccessIssue | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessIssue(null);
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
      if (response.status === 403) {
        const sessionResponse = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store",
        });
        const sessionPayload = await sessionResponse.json().catch(() => ({}));
        const user = sessionPayload?.user as SessionIdentity | undefined;
        setAccessIssue(
          user?.role && user.role !== "PARTNER"
            ? { kind: "INTERNAL_PROFILE", user }
            : { kind: "PARTNER_ACCESS", user },
        );
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
                {data?.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "Área do distribuidor"
                  : "Portal do representante"}
              </p>
              <p className="mt-1 text-xs text-stone-500">
                {data?.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "Compras, pagamentos e documentos"
                  : "Clientes, visitas e pedidos"}
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

      <div
        className={`mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7 ${
          data?.partner.portalAccessLevel === "DISTRIBUTOR"
            ? "space-y-4"
            : "space-y-7"
        }`}
      >
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

        {accessIssue?.kind === "INTERNAL_PROFILE" && (
          <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-950 shadow-sm">
            <p className="text-base font-bold">
              Você está conectado com um perfil interno do BBOS.
            </p>
            <p className="mt-2 max-w-3xl leading-6">
              A sessão atual pertence a {accessIssue.user.name} (
              {internalRoleLabel[accessIssue.user.role] ??
                accessIssue.user.role}
              ). Para proteger os dados de cada parceiro, este portal exige uma
              conta própria vinculada ao parceiro em Commerce.
            </p>
            <p className="mt-2 max-w-3xl leading-6 text-amber-900/80">
              Se o acesso ainda não foi criado, vá em Commerce → Parceiros de
              venda → Criar acesso. Se já existe, saia e entre com o e-mail do
              parceiro.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => router.push("/commerce/parceiros")}
                className="inline-flex items-center gap-2 rounded-xl bg-[#14201d] px-4 py-2.5 text-xs font-bold text-white"
              >
                <ArrowLeft size={15} /> Voltar à gestão de parceiros
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-xs font-bold text-amber-950"
              >
                <LogOut size={15} /> Sair e entrar como parceiro
              </button>
            </div>
          </div>
        )}

        {accessIssue?.kind === "PARTNER_ACCESS" && (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-6 text-sm text-red-900 shadow-sm">
            <p className="text-base font-bold">
              O acesso deste parceiro está inativo ou sem vínculo.
            </p>
            <p className="mt-2 max-w-3xl leading-6">
              Peça a um administrador para revisar o parceiro em Commerce →
              Parceiros de venda e reativar ou recriar o acesso ao portal.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void load()}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-xs font-bold"
              >
                <RefreshCw size={14} /> Tentar novamente
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                className="inline-flex items-center gap-2 rounded-xl bg-red-900 px-4 py-2.5 text-xs font-bold text-white"
              >
                <LogOut size={15} /> Entrar com outra conta
              </button>
            </div>
          </div>
        )}

        {data && (
          <>
            <section
              className={`flex flex-wrap items-end justify-between gap-4 ${
                data.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "overflow-hidden rounded-3xl border border-[#e0cca9] bg-gradient-to-br from-[#fbf9f4] via-[#faf7f2] to-[#efe7da] px-5 py-5 text-[#3b2a1f] shadow-sm sm:px-7"
                  : ""
              }`}
            >
              <div className="min-w-0 max-w-3xl">
                {data.partner.portalAccessLevel === "DISTRIBUTOR" && (
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://signacoffee.com.br/assets/logo-signa-coffee-Ds-PlOe8.svg"
                      alt="Signa Coffee"
                      className="h-8 w-auto sm:h-10"
                    />
                    <span className="h-8 w-px bg-[#e0cca9]" />
                    <span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#8a6020]">
                      Ambiente exclusivo · Operado pelo BBOS
                    </span>
                  </div>
                )}
                <p
                  className={`text-xs font-bold uppercase tracking-[.16em] ${
                    data.partner.portalAccessLevel === "DISTRIBUTOR"
                      ? "text-[#8a6020]"
                      : "text-[#087568]"
                  }`}
                >
                  {data.partner.portalAccessLevel === "DISTRIBUTOR"
                    ? "Curadoria · Personalização · Presença"
                    : "Visão exclusiva"}
                </p>
                <h1
                  className={`mt-1 font-semibold ${
                    data.partner.portalAccessLevel === "DISTRIBUTOR"
                      ? "font-serif text-2xl sm:text-3xl"
                      : "text-3xl sm:mt-2 sm:text-4xl"
                  }`}
                >
                  Olá,{" "}
                  {data.partner.portalAccessLevel === "DISTRIBUTOR"
                    ? data.partner.name
                    : data.partner.contactName || data.partner.name}
                  .
                </h1>
                <p
                  className={`mt-1.5 max-w-3xl text-sm ${
                    data.partner.portalAccessLevel === "DISTRIBUTOR"
                      ? "text-[#6b5747]"
                      : "text-stone-500"
                  }`}
                >
                  {data.partner.portalAccessLevel === "VIEWER"
                    ? "Aqui aparecem somente negócios atribuídos aos seus cupons."
                    : data.partner.portalAccessLevel === "DISTRIBUTOR"
                      ? "Compre da Bispo para sua empresa e acompanhe somente os próprios pedidos, vencimentos e documentos."
                      : data.partner.portalAccessLevel === "SALES_MANAGER"
                        ? "Acompanhe toda a carteira, as visitas da equipe e os pedidos comerciais."
                        : "Acompanhe seus negócios e monte pedidos somente para os clientes da sua carteira."}
                </p>
              </div>
              <p
                className={`text-xs ${
                  data.partner.portalAccessLevel === "DISTRIBUTOR"
                    ? "text-[#76695d]"
                    : "text-stone-400"
                }`}
              >
                Atualizado em {new Date(data.updatedAt).toLocaleString("pt-BR")}
              </p>
            </section>

            {data.partner.portalAccessLevel === "DISTRIBUTOR" ? (
              <>
                <DistributorMetrics orders={data.partnerOrders} />
                <DistributorJourney />
                <DistributorNotifications items={data.notifications ?? []} />
              </>
            ) : (
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
            )}

            {data.capabilities.canCreateOrders && (
              <PartnerOrderWorkspace
                accessLevel={data.partner.portalAccessLevel}
                orders={data.partnerOrders}
                onOrderCreated={load}
              />
            )}

            {data.partner.portalAccessLevel !== "DISTRIBUTOR" && (
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
            )}

            {data.partner.portalAccessLevel !== "DISTRIBUTOR" && (
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
                                {new Date(
                                  business.createdAt,
                                ).toLocaleDateString("pt-BR")}
                              </td>
                              <td className="px-5 py-4 font-bold">
                                {business.orderCode}
                              </td>
                              <td className="px-5 py-4">
                                {business.couponCode}
                              </td>
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
            )}
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

function DistributorMetrics({
  orders,
}: {
  orders: PortalData["partnerOrders"];
}) {
  const open = orders.reduce(
    (sum, order) => sum + Number(order.openAmount || 0),
    0,
  );
  const overdue = orders.filter(
    (order) => order.receivableStatus === "OVERDUE",
  );
  const total = orders.reduce(
    (sum, order) => sum + Number(order.totalAmount || 0),
    0,
  );
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <DistributorMetric
        icon={ShoppingBag}
        label="Pedidos"
        value={String(orders.length)}
        tone="green"
      />
      <DistributorMetric
        icon={ReceiptText}
        label="Total comprado"
        value={money.format(total)}
        tone="sand"
      />
      <DistributorMetric
        icon={BadgeDollarSign}
        label="A pagar"
        value={money.format(open)}
        tone="blue"
      />
      <DistributorMetric
        icon={CheckCircle2}
        label="Vencidos"
        value={String(overdue.length)}
        tone={overdue.length ? "red" : "lilac"}
      />
    </section>
  );
}

function DistributorMetric({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ShoppingBag;
  label: string;
  value: string;
  tone: "green" | "sand" | "blue" | "lilac" | "red";
}) {
  const tones = {
    green: "border-[#d8dacb] bg-[#f4f3ed] text-[#53593b]",
    sand: "border-[#e0cca9] bg-[#faf7f2] text-[#8a6020]",
    blue: "border-[#c7d4d8] bg-[#f1f5f6] text-[#063b4c]",
    lilac: "border-[#ded2e1] bg-[#f7f2f8] text-[#8d6598]",
    red: "border-[#f1d3cf] bg-[#fff1ef] text-[#9d3f35]",
  } as const;
  return (
    <article className={`rounded-2xl border p-3.5 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon size={16} />
        <p className="text-[10px] font-bold uppercase tracking-[.12em] opacity-75">
          {label}
        </p>
      </div>
      <p className="mt-2 truncate text-lg font-semibold sm:text-xl">{value}</p>
    </article>
  );
}

function DistributorJourney() {
  const steps = [
    { icon: ShoppingBag, label: "1. Pedido", text: "Você envia" },
    { icon: CheckCircle2, label: "2. Aprovação", text: "Bispo confirma" },
    { icon: Factory, label: "3. Produção", text: "Sob encomenda" },
    { icon: FileCheck2, label: "4. NF-e", text: "Documento liberado" },
    { icon: PackageCheck, label: "5. Entrega", text: "Pedido concluído" },
  ];
  return (
    <section className="rounded-2xl border border-[#e8dec9] bg-[#fbf9f4] px-3 py-3 shadow-sm">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {steps.map(({ icon: Icon, label, text }, index) => (
          <div
            key={label}
            className="relative flex items-center gap-2 rounded-xl bg-[#f4efe5] px-3 py-2.5"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[#8a6020] shadow-sm">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs">{label}</strong>
              <span className="block truncate text-[10px] text-stone-500">
                {text}
              </span>
            </span>
            {index < steps.length - 1 && (
              <span className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-[#c09853] sm:block">
                →
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function DistributorNotifications({
  items,
}: {
  items: PortalData["notifications"];
}) {
  return (
    <section className="rounded-2xl border border-[#e8dec9] bg-[#fbf9f4] p-3.5 shadow-sm sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#8a6020]">
            Atualizações da sua operação
          </p>
          <p className="mt-1 text-xs text-[#76695d]">
            Cada ação do pedido fica registrada aqui.
          </p>
        </div>
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#efe7da] text-[#8a6020]">
          <Bell size={16} />
        </span>
      </div>
      {items.length ? (
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          {items.slice(0, 6).map((item, index) => (
            <article
              key={item.id}
              className={`rounded-xl border px-3 py-2.5 ${
                index === 0
                  ? "border-[#c09853] bg-white"
                  : "border-[#e8dec9] bg-[#faf7f2]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[.12em] text-[#8a6020]">
                    {item.orderCode}
                  </p>
                  <p className="mt-0.5 text-xs font-bold text-[#3b2a1f]">
                    {item.title}
                  </p>
                </div>
                <time className="whitespace-nowrap text-[9px] text-[#76695d]">
                  {new Date(item.occurredAt).toLocaleDateString("pt-BR")}
                </time>
              </div>
              <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-[#6b5747]">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 rounded-xl border border-dashed border-[#e0cca9] bg-white/70 p-4 text-center text-xs text-[#76695d]">
          As ações dos seus pedidos aparecerão aqui.
        </p>
      )}
    </section>
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
