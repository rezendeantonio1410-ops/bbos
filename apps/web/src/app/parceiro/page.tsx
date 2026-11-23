"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeDollarSign,
  Bell,
  CheckCircle2,
  ChevronRight,
  LogOut,
  ReceiptText,
  RefreshCw,
  ShoppingBag,
  ShoppingCart,
  TicketPercent,
} from "lucide-react";
import { Logo } from "@/components/logo";
import type { SessionIdentity } from "@/lib/auth-session";
import { PartnerOrderWorkspace } from "./PartnerOrderWorkspace";
import { SignaEnterpriseDashboard } from "./SignaEnterpriseDashboard";

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
    <main className={`min-h-screen bg-[var(--bbos-surface-page)] text-[var(--bbos-text-primary)] ${data?.partner.portalAccessLevel === "DISTRIBUTOR" ? "lg:pl-52" : ""}`}>
      <header className={`sticky top-0 z-40 border-b border-[var(--bbos-surface-border)] backdrop-blur ${data?.partner.portalAccessLevel === "DISTRIBUTOR" ? "bg-white/95 text-[#102338] shadow-sm" : "bg-[var(--bbos-surface)]/95 sm:static"}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8 sm:py-3">
          <div className="flex min-w-0 items-center gap-3 sm:gap-5">
            <div
              className={
                data?.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "hidden sm:block"
                  : "block"
              }
            >
              <Logo compact={data?.partner.portalAccessLevel === "DISTRIBUTOR"} />
            </div>
            {data?.partner.portalAccessLevel === "DISTRIBUTOR" && (
              <div className="flex items-center gap-3 sm:hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://signacoffee.com.br/assets/logo-signa-coffee-Ds-PlOe8.svg"
                  alt="Signa Coffee"
                  className="h-7 w-auto"
                />
                <div className="border-l border-[var(--bbos-surface-border)] pl-3">
                  <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">
                    Portal de pedidos
                  </p>
                  <p className="mt-0.5 text-[9px] text-[var(--bbos-text-muted)]">
                    Operado pelo BBOS
                  </p>
                </div>
              </div>
            )}
            <div className="hidden min-w-0 border-l border-slate-200 pl-4 sm:block">
              <p className="text-[11px] font-bold uppercase tracking-[.12em] text-teal-800">
                {data?.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "Portal comercial | Signa"
                  : "Portal do representante"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data?.partner.portalAccessLevel === "DISTRIBUTOR"
                  ? "Pedidos · Faturamento · Pagamentos"
                  : "Clientes, visitas e pedidos"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {data?.partner.portalAccessLevel === "DISTRIBUTOR" && (
              <a
                href="#historico-pedidos"
                aria-label="Documentos e histórico"
                className="grid size-10 place-items-center rounded-xl text-[var(--bbos-coffee-green)] hover:bg-[var(--bbos-nav-active)] sm:hidden"
              >
                <ReceiptText size={18} />
              </a>
            )}
            <button
              type="button"
              onClick={() => void logout()}
              aria-label="Sair do portal"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              <LogOut size={16} />{" "}
              <span className="hidden sm:inline">Sair</span>
            </button>
          </div>
        </div>
      </header>

      <div
        className={`mx-auto max-w-7xl px-4 py-5 sm:px-8 sm:py-7 ${
          data?.partner.portalAccessLevel === "DISTRIBUTOR"
            ? "space-y-4 pb-24 sm:pb-7"
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
            {data.partner.portalAccessLevel === "DISTRIBUTOR" && <SignaEnterpriseDashboard orders={data.partnerOrders} partnerName={data.partner.name} events={data.notifications} />}
            {data.partner.portalAccessLevel !== "DISTRIBUTOR" && <section
              id="inicio"
              className={`flex flex-wrap items-end justify-between gap-4 ${
                false
                  ? "scroll-mt-20 overflow-hidden rounded-2xl border border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)] px-4 py-4 text-[var(--bbos-text-primary)] shadow-sm sm:scroll-mt-4 sm:px-6"
                  : ""
              }`}
            >
              <div className="min-w-0 max-w-3xl">
                {false && (
                  <div className="mb-3 flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://signacoffee.com.br/assets/logo-signa-coffee-Ds-PlOe8.svg"
                      alt="Signa Coffee"
                      className="h-8 w-auto sm:h-10"
                    />
                  </div>
                )}
                {true && (
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-[var(--bbos-coffee-green)]">
                    Visão exclusiva
                  </p>
                )}
                <h1
                  className={`mt-1 font-semibold ${
                    false
                      ? "text-2xl sm:text-3xl"
                      : "text-3xl sm:mt-2 sm:text-4xl"
                  }`}
                >
                  {false ? (
                    <>Gestão de pedidos</>
                  ) : (
                    <>Olá, {data.partner.contactName || data.partner.name}.</>
                  )}
                </h1>
                <p className="mt-1.5 max-w-3xl text-sm text-stone-500">
                  {data.partner.portalAccessLevel === "VIEWER"
                    ? "Aqui aparecem somente negócios atribuídos aos seus cupons."
                    : false
                      ? "Consulte pedidos, acompanhe o faturamento e confira os pagamentos em um só lugar."
                      : data.partner.portalAccessLevel === "SALES_MANAGER"
                        ? "Acompanhe toda a carteira, as visitas da equipe e os pedidos comerciais."
                        : "Acompanhe seus negócios e monte pedidos somente para os clientes da sua carteira."}
                </p>
                {false && (
                  <button
                    type="button"
                    onClick={() =>
                      window.dispatchEvent(new Event("bbos:partner-order:new"))
                    }
                    className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--bbos-action-primary)] px-4 text-sm font-bold text-white shadow-sm sm:hidden"
                  >
                    <ShoppingCart size={18} /> Novo pedido
                  </button>
                )}
              </div>
              {true && (
                <p className="text-xs text-stone-400">
                  Atualizado em{" "}
                  {new Date(data.updatedAt).toLocaleString("pt-BR")}
                </p>
              )}
            </section>}

            {data.partner.portalAccessLevel === "DISTRIBUTOR" ? (
              <>
                <></>
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

            {data.partner.portalAccessLevel === "DISTRIBUTOR" && (
              <DistributorOrderHistory
                orders={data.partnerOrders}
                items={data.notifications ?? []}
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
    <>
      <section className="grid grid-cols-2 gap-2 sm:hidden">
        <DistributorMetric
          icon={ShoppingBag}
          label="Pedidos"
          value={String(orders.length)}
          tone="green"
        />
        <DistributorMetric
          icon={overdue.length ? BadgeDollarSign : CheckCircle2}
          label={overdue.length ? "Vencidos" : "Situação"}
          value={overdue.length ? String(overdue.length) : "Tudo em dia"}
          tone={overdue.length ? "red" : "lilac"}
        />
      </section>
      <section className="hidden gap-2 sm:grid sm:grid-cols-4">
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
    </>
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
    green:
      "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)] text-[var(--bbos-coffee-green)]",
    sand: "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)] text-[var(--bbos-coffee-green)]",
    blue: "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)] text-[var(--bbos-coffee-green)]",
    lilac:
      "border-[var(--bbos-surface-border)] bg-[var(--bbos-surface)] text-[var(--bbos-coffee-green)]",
    red: "border-[var(--bbos-danger-border)] bg-[var(--bbos-danger-soft)] text-[var(--bbos-danger)]",
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

const distributorStatusLabels: Record<string, string> = {
  DRAFT: "Em conferência",
  CONFIRMED: "Aprovado",
  RESERVED: "Reservado",
  PICKING: "Em preparação",
  READY_TO_SHIP: "Pronto para NF-e",
  IN_PRODUCTION: "Em produção",
  INVOICED: "Faturado",
  SHIPPED: "Em transporte",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};

function distributorPaymentLabel(order: PortalData["partnerOrders"][number]) {
  if (order.receivableStatus === "PAID" || order.paymentDate) return "Pago";
  if (order.receivableStatus === "OVERDUE") return "Vencido";
  if (order.openAmount && Number(order.openAmount) > 0) return "A pagar";
  if (order.paymentType === "TERM") return "Após a NF-e";
  return "À vista";
}

function distributorStatusTone(status: string, overdue = false) {
  if (overdue) {
    return "bg-[var(--bbos-danger-soft)] text-[var(--bbos-danger)]";
  }
  if (status === "DELIVERED") {
    return "bg-[var(--bbos-success-soft)] text-[var(--bbos-success)]";
  }
  if (["SHIPPED", "INVOICED", "READY_TO_SHIP"].includes(status)) {
    return "bg-[var(--bbos-info-soft)] text-[var(--bbos-info)]";
  }
  if (["IN_PRODUCTION", "PICKING"].includes(status)) {
    return "bg-[var(--bbos-warning-soft)] text-[var(--bbos-warning)]";
  }
  if (status === "CANCELLED") {
    return "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-muted)]";
  }
  return "bg-[var(--bbos-nav-active)] text-[var(--bbos-coffee-green)]";
}

const distributorOrderProgress: Record<string, number> = {
  DRAFT: 10,
  CONFIRMED: 20,
  RESERVED: 35,
  PICKING: 50,
  IN_PRODUCTION: 55,
  READY_TO_SHIP: 70,
  INVOICED: 80,
  SHIPPED: 90,
  DELIVERED: 100,
  CANCELLED: 100,
};

const distributorNextStep: Record<string, string> = {
  DRAFT: "Aguardando conferência da Bispo",
  CONFIRMED: "Pedido aprovado para preparação",
  RESERVED: "Café reservado para o pedido",
  PICKING: "Em preparação",
  IN_PRODUCTION: "Produção sob encomenda",
  READY_TO_SHIP: "Pronto para emissão da NF-e",
  INVOICED: "NF-e emitida; preparando a entrega",
  SHIPPED: "Acompanhe a entrega",
  DELIVERED: "Pedido concluído",
  CANCELLED: "Pedido cancelado",
};

function DistributorOrderQueue({
  orders,
}: {
  orders: PortalData["partnerOrders"];
}) {
  const activeOrders = [...orders]
    .filter((order) => !["DELIVERED", "CANCELLED"].includes(order.status))
    .sort(
      (a, b) =>
        new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
    );

  return (
    <section
      id="pedidos-em-andamento"
      className="scroll-mt-4 overflow-hidden rounded-2xl border border-emerald-900/10 bg-white shadow-sm"
    >
      <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-4 py-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.14em] text-[#087568]">
            Pedidos em andamento
          </p>
          <p className="mt-0.5 text-xs text-stone-500">
            Acompanhe o status atual de cada pedido.
          </p>
        </div>
        <span className="rounded-full bg-[#eaf2ec] px-3 py-1 text-[10px] font-bold text-[#087568]">
          {activeOrders.length}
        </span>
      </div>

      {activeOrders.length ? (
        <div className="divide-y divide-[var(--bbos-surface-border)] sm:hidden">
          {activeOrders.map((order) => {
            const overdue = order.receivableStatus === "OVERDUE";
            const progress = distributorOrderProgress[order.status] ?? 15;
            return (
              <article key={order.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--bbos-text-primary)]">
                      {order.code}
                    </p>
                    <p className="mt-1 text-[10px] text-[var(--bbos-text-muted)]">
                      {new Date(order.orderedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-[var(--bbos-text-primary)]">
                    {money.format(Number(order.totalAmount || 0))}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${distributorStatusTone(order.status, overdue)}`}
                  >
                    {distributorStatusLabels[order.status] || order.status}
                  </span>
                  <span
                    className={`text-[10px] font-bold ${overdue ? "text-[var(--bbos-danger)]" : "text-[var(--bbos-text-secondary)]"}`}
                  >
                    {distributorPaymentLabel(order)}
                  </span>
                </div>
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bbos-surface-subtle)]">
                    <div
                      className="h-full rounded-full bg-[var(--bbos-coffee-green)] transition-all"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <p className="text-[10px] text-[var(--bbos-text-muted)]">
                      {distributorNextStep[order.status] ||
                        "Pedido em andamento"}
                    </p>
                    <span className="text-[10px] font-bold text-[var(--bbos-coffee-green)]">
                      {progress}%
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href="#historico-pedidos"
                    className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border border-[var(--bbos-control-border)] bg-white px-3 text-xs font-bold text-[var(--bbos-text-primary)]"
                  >
                    Ver pedido <ChevronRight size={14} />
                  </a>
                  {order.invoicePdfAvailable ? (
                    <a
                      href={`/api/partner-portal/orders/${order.id}/invoice/pdf`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex min-h-11 items-center justify-center gap-1 rounded-xl bg-[var(--bbos-action-primary)] px-3 text-xs font-bold text-white"
                    >
                      <ReceiptText size={14} /> NF-e
                    </a>
                  ) : (
                    <span className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[var(--bbos-surface-subtle)] px-3 text-center text-[10px] font-bold text-[var(--bbos-text-muted)]">
                      NF-e após faturamento
                    </span>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {activeOrders.length ? (
        <div className="hidden overflow-x-auto sm:block">
          <div className="min-w-[720px] divide-y divide-stone-100">
            {activeOrders.map((order) => {
              const overdue = order.receivableStatus === "OVERDUE";
              return (
                <article
                  key={order.id}
                  className="grid grid-cols-[minmax(180px,1.2fr)_minmax(150px,.9fr)_minmax(130px,.75fr)_minmax(120px,.65fr)] items-center gap-4 px-4 py-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#14201d]">
                      {order.code}
                    </p>
                    <p className="mt-0.5 text-[10px] text-stone-400">
                      {new Date(order.orderedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${distributorStatusTone(order.status)}`}
                    >
                      {distributorStatusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <div>
                    <p
                      className={`font-bold ${overdue ? "text-[#9d3f35]" : "text-stone-700"}`}
                    >
                      {distributorPaymentLabel(order)}
                    </p>
                    {order.dueDate && !order.paymentDate ? (
                      <p className="mt-0.5 text-[10px] text-stone-400">
                        {new Date(order.dueDate).toLocaleDateString("pt-BR")}
                      </p>
                    ) : null}
                  </div>
                  <p className="text-right font-bold text-[#14201d]">
                    {money.format(Number(order.totalAmount || 0))}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}

      {!activeOrders.length ? (
        <p className="px-4 py-5 text-center text-xs text-stone-500">
          Nenhum pedido em andamento.
        </p>
      ) : null}
    </section>
  );
}

function DistributorOrderHistory({
  orders,
  items,
}: {
  orders: PortalData["partnerOrders"];
  items: PortalData["notifications"];
}) {
  const eventsByOrder = new Map<string, PortalData["notifications"]>();
  [...items]
    .sort(
      (a, b) =>
        new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
    )
    .forEach((item) => {
      const current = eventsByOrder.get(item.orderId) ?? [];
      current.push(item);
      eventsByOrder.set(item.orderId, current);
    });

  const history = [...orders].sort(
    (a, b) => new Date(b.orderedAt).getTime() - new Date(a.orderedAt).getTime(),
  );

  return (
    <>
      <details
        id="historico-pedidos"
        className="group scroll-mt-20 rounded-2xl border border-[var(--bbos-surface-border)] bg-white shadow-sm sm:hidden"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 marker:hidden">
          <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.13em] text-[var(--bbos-coffee-green)]">
            <Bell size={16} /> Histórico e documentos
          </span>
          <span className="rounded-full bg-[var(--bbos-nav-active)] px-2.5 py-1 text-[10px] font-bold text-[var(--bbos-coffee-green)]">
            {history.length}
          </span>
        </summary>
        <div className="border-t border-[var(--bbos-surface-border)] p-2.5">
          <DistributorOrderHistoryList
            history={history}
            eventsByOrder={eventsByOrder}
          />
        </div>
      </details>

      <section
        id="historico-pedidos-desktop"
        className="hidden rounded-2xl border border-[var(--bbos-surface-border)] bg-white p-4 shadow-sm sm:block"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">
              Histórico dos pedidos
            </p>
            <p className="mt-0.5 text-xs text-[var(--bbos-text-muted)]">
              Consulte as etapas concluídas de cada pedido.
            </p>
          </div>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--bbos-nav-active)] text-[var(--bbos-coffee-green)]">
            <Bell size={16} />
          </span>
        </div>
        <DistributorOrderHistoryList
          history={history}
          eventsByOrder={eventsByOrder}
        />
      </section>
    </>
  );
}

function DistributorOrderHistoryList({
  history,
  eventsByOrder,
}: {
  history: PortalData["partnerOrders"];
  eventsByOrder: Map<string, PortalData["notifications"]>;
}) {
  if (!history.length) {
    return (
      <p className="rounded-xl border border-dashed border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)] p-4 text-center text-xs text-[var(--bbos-text-muted)] sm:mt-3">
        O histórico aparecerá aqui depois do primeiro pedido.
      </p>
    );
  }

  return (
    <div className="divide-y divide-[var(--bbos-surface-border)] overflow-hidden rounded-xl border border-[var(--bbos-surface-border)] sm:mt-3">
      {history.map((order) => {
        const events = eventsByOrder.get(order.id) ?? [];
        const latest = events[0];
        return (
          <details key={order.id} className="group bg-white">
            <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3 py-3 marker:hidden sm:grid-cols-[minmax(140px,.75fr)_minmax(0,1.4fr)_auto_auto]">
              <div>
                <p className="truncate text-xs font-bold text-[var(--bbos-text-primary)]">
                  {order.code}
                </p>
                <p className="mt-0.5 text-[9px] text-[var(--bbos-text-muted)]">
                  {new Date(order.orderedAt).toLocaleDateString("pt-BR")}
                </p>
              </div>
              <p className="hidden truncate text-[10px] text-[var(--bbos-text-muted)] sm:block">
                {latest?.title || "Pedido registrado"}
              </p>
              <span
                className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${distributorStatusTone(order.status, order.receivableStatus === "OVERDUE")}`}
              >
                {distributorStatusLabels[order.status] || order.status}
              </span>
              <span className="hidden text-[9px] font-bold text-[var(--bbos-coffee-green)] sm:inline">
                {events.length} {events.length === 1 ? "etapa" : "etapas"} · ver
              </span>
            </summary>
            <div className="border-t border-[var(--bbos-surface-border)] bg-[var(--bbos-surface-subtle)] px-3 py-2.5">
              {events.length ? (
                <div className="space-y-2">
                  {events.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-1 rounded-lg bg-white px-3 py-2 sm:grid-cols-[110px_minmax(0,1fr)]"
                    >
                      <time className="text-[9px] text-[var(--bbos-text-muted)]">
                        {new Date(item.occurredAt).toLocaleDateString("pt-BR")}
                      </time>
                      <div>
                        <p className="text-[10px] font-bold text-[var(--bbos-text-primary)]">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-4 text-[var(--bbos-text-muted)]">
                          {item.detail}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] text-[var(--bbos-text-muted)]">
                  Ainda não há atualizações detalhadas para este pedido.
                </p>
              )}
            </div>
          </details>
        );
      })}
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
