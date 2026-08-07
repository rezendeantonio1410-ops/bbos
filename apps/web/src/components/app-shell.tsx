"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bell,
  BrainCircuit,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  Calculator,
  Factory,
  FlaskConical,
  Gauge,
  House,
  LayoutDashboard,
  Menu,
  PackageCheck,
  PackageOpen,
  PanelLeftClose,
  Search,
  ShoppingBag,
  Sparkles,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { currentUser } from "@/lib/current-user";

const nav = [
  { href: "/home", label: "Início", icon: House },
  { href: "/dashboard", label: "Dashboard Executivo", icon: LayoutDashboard },
  { href: "/dashboard-industrial", label: "Dashboard Industrial", icon: Gauge },
  { href: "/recebimento", label: "Recebimento", icon: PackageOpen },
  { href: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  { href: "/estoque", label: "Estoque", icon: Warehouse },
  { href: "/producao", label: "Produção", icon: Factory },
  { href: "/blends", label: "Blends", icon: Boxes },
  { href: "/produtos", label: "Produtos", icon: PackageCheck },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/vendas", label: "Vendas", icon: BarChart3 },
  { href: "/bi", label: "BI Executivo", icon: BrainCircuit },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
  { href: "/custos", label: "Custos", icon: Calculator },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isExecutiveDashboard = pathname === "/dashboard";
  const usesApprovedDashboardSurfaces = isExecutiveDashboard || pathname === "/dashboard-industrial" || pathname === "/home";
  return (
    <div className={`min-h-screen lg:grid lg:grid-cols-[264px_1fr] ${usesApprovedDashboardSurfaces ? "bg-[#F3FAF8]" : "bg-[#E0EAE9]"}`}>
      <aside className={`hidden border-r lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto ${usesApprovedDashboardSurfaces ? "border-[#E7ECEA] bg-white" : "border-stone-200 bg-white"}`}>
        <div className="flex items-center justify-between px-6 py-6">
          <Logo />
          <button
            title="Recolher menu — em breve"
            aria-label="Recolher menu"
            className="rounded-lg p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
          >
            <PanelLeftClose size={16} strokeWidth={1.6} />
          </button>
        </div>
        <div className="mx-4 mb-5 flex items-center gap-2 rounded-xl border bg-stone-50 px-3 py-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-coffee-100 text-coffee-600">
            <Factory size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">Bispo Coffees</p>
            <p className="text-[11px] text-stone-500">Operação Industrial</p>
          </div>
          <ChevronDown size={14} className="text-stone-400" />
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? (usesApprovedDashboardSurfaces ? "bg-[#EDF7F5] text-forest-900" : "bg-forest-50 text-forest-900") : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}
              >
                <Icon size={18} strokeWidth={active ? 2.1 : 1.7} />
                {label}
              </Link>
            );
          })}
        </nav>
        <Link
          href="/dashboard#bbos-ia"
          className="m-4 rounded-2xl border border-forest-100 bg-forest-50 p-4 transition hover:bg-forest-100"
        >
          <div className="flex items-center gap-2 text-forest-800">
            <Sparkles size={15} strokeWidth={1.7} />
            <p className="text-xs font-bold">BBOS IA</p>
          </div>
          <p className="mt-2 text-[11px] leading-4 text-stone-600">
            Insights gerenciais e pontos de atenção.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-[10px] font-bold text-forest-700">
            Abrir inteligência
          </span>
        </Link>
      </aside>
      <div className="min-w-0">
        <header className={`sticky top-0 z-20 flex h-[72px] items-center justify-between border-b px-4 backdrop-blur md:px-8 ${usesApprovedDashboardSurfaces ? "border-[#E7ECEA] bg-white shadow-[0_1px_8px_rgba(15,30,28,.025)]" : "bg-white/90"}`}>
          <div className="flex items-center gap-3 lg:hidden">
            <button
              aria-label="Abrir menu"
              className="rounded-lg p-2 hover:bg-stone-100"
            >
              <Menu size={20} />
            </button>
            <Logo compact />
          </div>
          <div className="hidden w-full max-w-sm items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500 lg:flex">
            <Search size={17} />
            <input
              aria-label="Buscar"
              className="w-full bg-transparent text-sm outline-none"
              placeholder="Buscar no BBOS..."
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              aria-label="Notificações"
              className="relative rounded-xl border bg-white p-2.5 text-stone-600"
            >
              <Bell size={18} />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" />
            </button>
            <div className="hidden h-8 w-px bg-stone-200 sm:block" />
            <div className="hidden items-center gap-2.5 sm:flex">
              <span className="grid size-9 place-items-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">
                {currentUser.initials}
              </span>
              <div>
                <p className="text-xs font-semibold">{currentUser.name}</p>
                <p className="text-[11px] text-stone-500">{currentUser.corporateTitle}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="p-4 md:p-8 xl:p-10">{children}</main>
      </div>
    </div>
  );
}
