"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileText,
  Package,
  Plus,
  Search,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { currentUser } from "@/lib/current-user";
import { salesDesktopRoutes as routes } from "@/lib/sales-routes";
import { Logo } from "@/components/logo";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
type Dashboard = {
  user: { name: string; role: string };
  territory?: string | null;
  region?: string | null;
  customerCount: number;
  revenue: number;
  target: number;
  achievement: number;
  commissionEstimated: number;
  openOrders: number;
  attention: any[];
  customers: any[];
  visits: any[];
  recentOrders: any[];
  activities: any[];
  nextActions: Array<{
    id: string;
    type: string;
    priority: "URGENT" | "HIGH" | "NORMAL" | "INFORMATIVE";
    title: string;
    description: string;
    ctaLabel: string;
    ctaHref: string;
    dueAt?: string;
  }>;
  canAccessManager: boolean;
};
const empty: Dashboard = {
  user: { name: currentUser.name, role: "SALES_REPRESENTATIVE" },
  customerCount: 0,
  revenue: 0,
  target: 0,
  achievement: 0,
  commissionEstimated: 0,
  openOrders: 0,
  attention: [],
  customers: [],
  visits: [],
  recentOrders: [],
  activities: [],
  nextActions: [],
  canAccessManager: false,
};
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const day = (value: string | Date) =>
  new Date(value).toLocaleDateString("pt-BR");
const hour = (value: string | Date) =>
  new Date(value).toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
const greeting = () => {
  const currentHour = new Date().getHours();
  return currentHour < 12 ? "bom dia" : currentHour < 18 ? "boa tarde" : "boa noite";
};
const statusLabel: Record<string, string> = {
  DRAFT: "Em análise",
  CONFIRMED: "Aprovado",
  RESERVED: "Em produção",
  PICKING: "Em produção",
  READY_TO_SHIP: "Em produção",
  INVOICED: "Faturado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELLED: "Cancelado",
};
const statusTone: Record<string, string> = {
  DRAFT: "bg-blue-50 text-blue-700",
  CONFIRMED: "bg-emerald-50 text-emerald-700",
  RESERVED: "bg-blue-50 text-blue-700",
  PICKING: "bg-blue-50 text-blue-700",
  READY_TO_SHIP: "bg-blue-50 text-blue-700",
  INVOICED: "bg-violet-50 text-violet-700",
  SHIPPED: "bg-blue-50 text-blue-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};
const attentionPriority: Record<string, number> = {
  "Pagamento vencido": 0,
  "Crédito em análise": 1,
  "Documentação pendente": 1,
  "Pedido bloqueado": 2,
  "Pedido atrasado": 2,
};

export default function SalesDesktop() {
  const [data, setData] = React.useState<Dashboard>(empty);
  const [query, setQuery] = React.useState("");
  React.useEffect(() => {
    fetch(`${API}/commercial/dashboard/representative`, {
      headers: { "x-user-id": currentUser.id },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => value && setData(value))
      .catch(() => undefined);
  }, []);
  const attention = data.attention
    .map((item) => ({
      ...item,
      level: item.financialStatus === "ATENÇÃO" ? "CRÍTICO" : "ATENÇÃO",
    }))
    .sort(
      (a, b) =>
        (attentionPriority[a.reason] ?? 3) - (attentionPriority[b.reason] ?? 3),
    );
  const priorityLabel: Record<string, string> = {
    URGENT: "URGENTE",
    HIGH: "ACOMPANHAR",
    NORMAL: "HOJE",
    INFORMATIVE: "INFORMATIVO",
  };
  const today = (data.nextActions ?? []).slice(0, 5).map((item) => ({
    ...item,
    label: priorityLabel[item.priority] ?? "ACOMPANHAR",
    when: item.type.includes("VISIT") ? item.dueAt : null,
    href: item.ctaHref,
    tone:
      item.priority === "URGENT"
        ? "red"
        : item.priority === "INFORMATIVE"
          ? "green"
          : item.priority === "NORMAL"
            ? "blue"
            : "amber",
    action: item.ctaLabel,
  }));
  const filtered = data.customers.filter((c) =>
    `${c.name} ${c.city}`.toLowerCase().includes(query.toLowerCase()),
  );
  const achievementTone =
    data.achievement >= 0.8
      ? "text-emerald-700"
      : data.achievement >= 0.5
        ? "text-blue-700"
        : "text-amber-700";
  const achievementBar =
    data.achievement >= 0.8
      ? "bg-emerald-600"
      : data.achievement >= 0.5
        ? "bg-blue-600"
        : "bg-amber-500";
  const Action = ({ title, description, href, icon: Icon, tone }: any) => (
    <Link
      href={href}
      className="flex min-h-[86px] items-center gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition hover:border-stone-300 hover:shadow-sm"
    >
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone}`}
      >
        <Icon size={19} />
      </span>
      <span>
        <strong className="block text-sm">{title}</strong>
        <span className="mt-1 block text-xs text-stone-500">{description}</span>
      </span>
    </Link>
  );
  return (
    <main className="min-h-screen bg-[#F7F7F5] text-stone-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 border-r border-stone-200 bg-white px-4 py-6 lg:flex lg:flex-col">
          <Link
            href={routes.home}
            className="flex items-center gap-2 px-1"
            aria-label="Bispo Coffees · Comercial"
          >
            <Logo compact />
            <span className="text-xs font-semibold text-stone-400">
              Comercial
            </span>
          </Link>
          <nav className="mt-8 space-y-1 text-sm">
            {[
              ["Início", "/sales/desktop", BarChart3],
              ["Clientes", routes.clients, Users],
              ["Pedidos", routes.orders, ClipboardList],
              ["Agenda / Visitas", routes.agenda, CalendarDays],
              ["Catálogo e preços", routes.catalog, Package],
              ["Comissões", routes.commissions, Wallet],
              ["Estoque", routes.stock, Warehouse],
              ["Relatórios", routes.reports, FileText],
            ].map(([label, href, Icon]) => (
              <Link
                key={String(href)}
                href={String(href)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${href === "/sales/desktop" ? "bg-blue-50 text-blue-800" : "text-stone-600 hover:bg-stone-50"}`}
              >
                {React.createElement(Icon as React.ElementType, { size: 17 })}
                {String(label)}
              </Link>
            ))}
          </nav>
          <div className="my-6 border-t border-stone-100" />
          <nav className="space-y-1 text-sm">
            <Link
              href={routes.notifications}
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-stone-600 hover:bg-stone-50"
            >
              <Bell size={17} />
              Notificações
            </Link>
            <Link
              href="/ajuda"
              className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-stone-600 hover:bg-stone-50"
            >
              <FileText size={17} />
              Ajuda
            </Link>
          </nav>
          <div className="mt-auto flex items-center justify-between gap-2 border-t border-stone-100 pt-4">
            <div className="flex min-w-0 items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                {currentUser.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">
                  {data.user.name}
                </p>
                <p className="mt-1 text-xs text-stone-500">Representante</p>
              </div>
            </div>
            <Link
              href="/login"
              className="shrink-0 text-xs font-semibold text-stone-500 hover:text-stone-800"
            >
              Sair
            </Link>
          </div>
        </aside>
        <div className="min-w-0 flex-1 px-5 py-6 lg:px-9">
          <div className="mx-auto max-w-7xl">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
                  Central diária de trabalho comercial
                </p>
                <h1 className="mt-2 text-3xl font-bold">
                  Olá {data.user.name.split(" ")[0]}, {greeting()}!{" "}
                  <span aria-hidden>👋</span>
                </h1>
                <p className="mt-2 text-sm text-stone-500">
                  {new Date().toLocaleDateString("pt-BR", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-stone-500">
                {(data.region || data.territory) && (
                  <span>
                    {[data.region, data.territory].filter(Boolean).join(" · ")}
                  </span>
                )}
                <span className="rounded-full bg-white px-3 py-2 shadow-sm">
                  {data.customerCount} clientes na carteira
                </span>
              </div>
            </header>
            <section
              className={`mt-6 rounded-2xl border border-stone-200 bg-white shadow-sm ${today.length ? "p-5" : "px-4 py-3"}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={17} className="text-amber-600" />
                  <h2 className="text-sm font-bold uppercase tracking-wider">
                    Seu dia
                  </h2>
                  <span
                    className={`rounded-full px-2 py-1 text-[10px] font-bold ${today.length ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    {today.length} ações
                  </span>
                </div>
                <Link
                  href="#atencao"
                  className="text-xs font-bold text-forest-700"
                >
                  Ver todas as ações →
                </Link>
              </div>
              {today.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {today.slice(0, 5).map((item, index) => (
                    <Link
                      key={`${item.title}-${index}`}
                      href={item.href}
                      className={`rounded-xl border p-4 ${item.tone === "red" ? "border-red-200 bg-red-50/40" : item.tone === "amber" ? "border-amber-200 bg-amber-50/40" : item.tone === "green" ? "border-emerald-200 bg-emerald-50/40" : "border-blue-200 bg-blue-50/30"}`}
                    >
                      <p className="text-[10px] font-bold uppercase tracking-widest">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold">{item.title}</p>
                      <p className="mt-1 text-xs opacity-75">
                        {item.description} · {item.action} →
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CheckCircle2 size={17} /> <strong>Tudo em dia.</strong>{" "}
                  Nenhuma pendência importante para hoje.
                </div>
              )}
            </section>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              {[
                [
                  "Vendas no mês",
                  money(data.revenue),
                  routes.reports,
                  "text-blue-700",
                ],
                ["Meta do mês", money(data.target), "#", "text-stone-900"],
                [
                  "Atingimento",
                  `${(data.achievement * 100).toFixed(0)}%`,
                  "#",
                  achievementTone,
                ],
                [
                  "Comissão prevista",
                  money(data.commissionEstimated),
                  routes.commissions,
                  "text-emerald-700",
                ],
                [
                  "Pedidos em aberto",
                  data.openOrders,
                  `${routes.orders}?status=open`,
                  "text-red-700",
                ],
              ].map(([label, value, href, color]) => (
                <Link
                  key={String(label)}
                  href={String(href)}
                  className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition hover:border-stone-300"
                >
                  <p className="text-xs text-stone-500">{label}</p>
                  <strong className={`mt-2 block text-xl ${color}`}>
                    {value}
                  </strong>
                  {label === "Meta do mês" && data.target > data.revenue && (
                    <p className="mt-1 text-[11px] text-stone-500">
                      Faltam {money(data.target - data.revenue)}
                    </p>
                  )}
                  {label === "Atingimento" && data.target > data.revenue && (
                    <p className="mt-1 text-[11px] text-stone-500">
                      Faltam {money(data.target - data.revenue)} para a meta
                    </p>
                  )}
                  {label === "Pedidos em aberto" &&
                    data.attention.length > 0 && (
                      <p className="mt-1 text-[11px] text-red-600">
                        {data.attention.length} precisam de atenção
                      </p>
                    )}
                  {label === "Atingimento" && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div
                        className={`h-full rounded-full ${achievementBar}`}
                        style={{
                          width: `${Math.min(100, data.achievement * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </Link>
              ))}
            </section>
            <div className="mt-6 flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-sm">
              <Search size={18} className="text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar cliente, CNPJ, cidade, produto ou pedido..."
                className="w-full bg-transparent text-sm outline-none"
              />
              <kbd className="hidden rounded border border-stone-200 px-2 py-1 text-[10px] text-stone-400 sm:block">
                ⌘K
              </kbd>
            </div>
            <div className="mt-6 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
              <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">Ações rápidas</h2>
                <p className="mt-1 text-xs text-stone-500">
                  Atalhos para o trabalho comercial do dia.
                </p>
                <div className="mt-5 space-y-5">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
                      Vender
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Action
                        title="Novo cliente"
                        description="Cadastrar cliente"
                        href={routes.newClient}
                        icon={Plus}
                        tone="bg-blue-50 text-blue-700"
                      />
                      <Action
                        title="Novo pedido"
                        description="Iniciar pedido"
                        href={routes.newOrder}
                        icon={ClipboardList}
                        tone="bg-blue-50 text-blue-700"
                      />
                      <Action
                        title="Catálogo e preços"
                        description="Ver produtos e preços"
                        href={routes.catalog}
                        icon={Package}
                        tone="bg-blue-50 text-blue-700"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-violet-700">
                      Gerenciar
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Action
                        title="Minha carteira"
                        description="Meus clientes"
                        href={routes.clients}
                        icon={Users}
                        tone="bg-violet-50 text-violet-700"
                      />
                      <Action
                        title="Meus pedidos"
                        description="Acompanhar status"
                        href={routes.orders}
                        icon={ClipboardList}
                        tone="bg-violet-50 text-violet-700"
                      />
                      <Action
                        title="Agenda / Visitas"
                        description="Ver agenda do dia"
                        href={routes.agenda}
                        icon={CalendarDays}
                        tone="bg-violet-50 text-violet-700"
                      />
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                      Acompanhar
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                      <Action
                        title="Comissões"
                        description="Ver comissões"
                        href={routes.commissions}
                        icon={Wallet}
                        tone="bg-emerald-50 text-emerald-700"
                      />
                      <Action
                        title="Estoque"
                        description="Consulta de estoque"
                        href={routes.stock}
                        icon={Warehouse}
                        tone="bg-emerald-50 text-emerald-700"
                      />
                      <Action
                        title="Relatórios"
                        description="Ver relatórios"
                        href={routes.reports}
                        icon={BarChart3}
                        tone="bg-emerald-50 text-emerald-700"
                      />
                      <Action
                        title="Notificações"
                        description="Ver atualizações"
                        href={routes.notifications}
                        icon={Bell}
                        tone="bg-emerald-50 text-emerald-700"
                      />
                    </div>
                  </div>
                </div>
              </section>
              <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-lg font-bold">Agenda e prioridades</h2>
                    <p className="mt-1 text-xs text-stone-500">Hoje</p>
                  </div>
                  <Link
                    href={routes.agenda}
                    className="text-xs font-bold text-forest-700"
                  >
                    Ver agenda completa →
                  </Link>
                </div>
                <div className="mt-5 space-y-4">
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-blue-700">
                      Hoje
                    </p>
                    {today
                      .filter((item) => item.when)
                      .slice(0, 5)
                      .map((item, index) => (
                        <Link
                          key={`${item.title}-agenda-${index}`}
                          href={item.href}
                          className="flex items-center gap-3 border-b border-stone-100 pb-3 text-sm"
                        >
                          <span className="w-12 text-xs font-bold text-blue-700">
                            {hour(item.when as string)}
                          </span>
                          <span>
                            <strong>{item.label}</strong>
                            <br />
                            <span className="text-xs text-stone-500">
                              {item.title} · {item.description}
                            </span>
                          </span>
                        </Link>
                      ))}
                    {!today.some((item) => item.when) && (
                      <p className="rounded-xl border border-dashed border-stone-200 px-3 py-4 text-sm text-stone-500">
                        Nenhum compromisso agendado para hoje.
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                      Pendências
                    </p>
                    {today
                      .filter((item) => !item.when)
                      .slice(0, 5)
                      .map((item, index) => (
                        <Link
                          key={`${item.title}-pending-${index}`}
                          href={item.href}
                          className="flex items-center gap-3 border-b border-stone-100 pb-3 pt-1 text-sm"
                        >
                          <span
                            className={`size-2 shrink-0 rounded-full ${item.tone === "red" ? "bg-red-500" : "bg-amber-500"}`}
                          />
                          <span>
                            <strong>{item.label}</strong>
                            <br />
                            <span className="text-xs text-stone-500">
                            {item.title} · {item.description} · {item.action} →
                            </span>
                          </span>
                        </Link>
                      ))}
                    {!today.some((item) => !item.when) && (
                      <p className="rounded-xl border border-dashed border-stone-200 px-3 py-4 text-sm text-stone-500">
                        Nenhuma pendência importante para hoje.
                      </p>
                    )}
                  </div>
                </div>
              </section>
            </div>
            <section
              id="atencao"
              className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-end justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    Minha carteira — atenção necessária
                  </h2>
                  <p className="mt-1 text-xs text-stone-500">
                    Somente clientes que exigem ação.
                  </p>
                </div>
                <Link
                  href={routes.clients}
                  className="text-xs font-bold text-forest-700"
                >
                  Ver carteira completa →
                </Link>
              </div>
              {attention.length ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {attention.map((item) => (
                    <Link
                      key={item.id}
                      href={`${routes.clients}/${item.id}`}
                      className="rounded-xl border border-stone-100 p-4 hover:border-forest-200"
                    >
                      <div className="flex justify-between gap-3">
                        <strong className="text-sm">{item.name}</strong>
                        <span className="text-xs font-semibold text-forest-700">
                          {item.nextAction} →
                        </span>
                      </div>
                    <p className="mt-1 text-xs text-stone-500">
                      {item.city} · {item.lastPurchase ? `última compra em ${day(item.lastPurchase)}` : "Ainda não realizou compras"}
                    </p>
                      <p className="mt-3 text-xs text-stone-600">
                        Situação: {item.reason}
                      </p>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-xl border border-dashed border-stone-200 p-6 text-center text-sm text-stone-500">
                  Sua carteira está em dia.
                </p>
              )}
            </section>
            <section className="mt-5 grid gap-5 xl:grid-cols-2">
              <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <div className="flex justify-between">
                  <h2 className="text-lg font-bold">Pedidos recentes</h2>
                  <Link
                    href={routes.orders}
                    className="text-xs font-bold text-forest-700"
                  >
                    Ver todos os pedidos →
                  </Link>
                </div>
                <div className="mt-4 space-y-2">
                  {data.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`${routes.orders}/${order.id}`}
                      className="flex items-center justify-between border-b border-stone-100 py-3 text-sm"
                    >
                      <span>
                        <strong>#{order.orderNumber ?? order.code}</strong>
                        <span className="ml-2 text-stone-500">
                          {order.customer?.name ?? "Cliente"}
                        </span>
                      </span>
                      <span className="text-right">
                        <strong>{money(order.totalAmount)}</strong>
                        <span
                          className={`ml-2 rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[order.status] ?? "bg-stone-100 text-stone-600"}`}
                        >
                          {statusLabel[order.status] ?? order.status}
                        </span>
                      </span>
                    </Link>
                  ))}
                  {!data.recentOrders.length && (
                    <p className="py-6 text-sm text-stone-500">
                      Nenhum pedido recente.
                    </p>
                  )}
                </div>
              </section>
              <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">Últimas atividades</h2>
                <div className="mt-4 space-y-3">
                  {data.activities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-start gap-3 border-b border-stone-100 pb-3 text-sm"
                    >
                      <span className="mt-1 size-2 rounded-full bg-blue-500" />
                      <span>
                        <strong>{activity.title}</strong>
                        <br />
                        <span className="text-xs text-stone-500">
                          {activity.customer?.name ?? "Cliente"} ·{" "}
                          {day(activity.occurredAt)}
                        </span>
                      </span>
                    </div>
                  ))}
                  {!data.activities.length && (
                    <p className="py-6 text-sm text-stone-500">
                      Nenhuma atividade recente.
                    </p>
                  )}
                </div>
              </section>
            </section>
            {query && (
              <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold">Resultados da busca</h2>
                <div className="mt-3 space-y-2">
                  {filtered.map((customer) => (
                    <Link
                      key={customer.id}
                      href={`${routes.clients}/${customer.id}`}
                      className="flex justify-between rounded-xl border border-stone-100 p-3 text-sm"
                    >
                      <span>
                        <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-700">
                          Cliente
                        </span>
                        <span className="font-semibold">{customer.name}</span>
                      </span>
                      <span className="text-stone-500">{customer.city}</span>
                    </Link>
                  ))}
                  {!filtered.length && (
                    <p className="py-3 text-sm text-stone-500">
                      Nenhum resultado na sua carteira.
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
