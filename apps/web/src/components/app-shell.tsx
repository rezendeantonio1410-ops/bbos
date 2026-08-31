"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
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
  Globe2,
  House,
  LayoutDashboard,
  Menu,
  PackageCheck,
  PackageOpen,
  PanelLeftClose,
  Search,
  ShoppingBag,
  Sparkles,
  UsersRound,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";
import { fetchSessionIdentity, getApiRoot, type SessionIdentity, SessionError } from "@/lib/auth-session";
import { SYSTEM_CREATOR_CREDIT_PT } from "@bbos/shared";

const nav = [
  { href: "/home", label: "Início", icon: House },
  { href: "/dashboard", label: "Dashboard Executivo", icon: LayoutDashboard },
  { href: "/dashboard-industrial", label: "Dashboard Industrial", icon: Gauge },
  { href: "/cafe-verde", label: "Café Verde", icon: PackageOpen },
  { href: "/producao", label: "Produção", icon: Factory },
  { href: "/blends", label: "Blends", icon: Boxes },
  { href: "/produtos", label: "Produtos", icon: PackageCheck },
  { href: "/clientes", label: "Clientes", icon: UsersRound },
  { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/vendas", label: "Vendas", icon: BarChart3 },
  { href: "/commerce", label: "Commerce", icon: Globe2 },
  { href: "/bi", label: "BI Executivo", icon: BrainCircuit },
  { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
  { href: "/custos", label: "Custos", icon: Calculator },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<(SessionIdentity & { initials: string; corporateTitle: string }) | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "authenticated" | "unauthenticated" | "unavailable">("checking");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setSessionState("checking");
    void fetchSessionIdentity(getApiRoot()).then((identity) => {
      if (cancelled) return;
      setSessionUser({
        ...identity,
        initials: identity.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
        corporateTitle: identity.role === "ADMIN" ? "Sócio Administrador" : identity.role === "EXECUTIVE" ? "Diretor" : identity.role === "SALES" ? "Comercial" : identity.role,
      });
      setSessionState("authenticated");
    }).catch((cause) => {
      if (cancelled) return;
      setSessionUser(null);
      setSessionState(cause instanceof SessionError && cause.kind === "unavailable" ? "unavailable" : "unauthenticated");
    });
    return () => { cancelled = true; };
  }, [sessionAttempt]);
  useEffect(() => {
    const onAvatarUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SessionIdentity>).detail;
      if (detail?.id) setSessionUser((current) => current ? { ...current, ...detail } : current);
    };
    window.addEventListener("bbos:avatar-updated", onAvatarUpdated);
    return () => window.removeEventListener("bbos:avatar-updated", onAvatarUpdated);
  }, []);
  useEffect(() => {
    if (sessionState !== "unauthenticated" || pathname === "/login") return;
    const returnTo = `${pathname}${window.location.search}`;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [pathname, router, sessionState]);
  if (sessionState !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-6">
        <div className="text-center">
          <p className="text-sm text-stone-500">
            {sessionState === "checking" ? "Conectando ao BBOS…" : sessionState === "unavailable" ? "Não conseguimos conectar ao BBOS." : "Redirecionando para o login…"}
          </p>
          {sessionState === "checking" && <p className="mt-2 text-xs text-stone-400">Retomando a conexão com segurança…</p>}
          {sessionState === "unavailable" && <><p className="mt-2 text-xs text-stone-500">O sistema está retomando a conexão. Isso pode levar alguns segundos.</p><button type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-900">Tentar novamente</button></>}
        </div>
      </div>
    );
  }
  const user = sessionUser;
  const logout = async () => { await fetch(`${getApiRoot()}/auth/logout`, { method: "POST", credentials: "include" }); window.location.href = "/login"; };
  return (
    <div className="min-h-screen bg-[var(--surface-page)] lg:grid lg:grid-cols-[264px_1fr]">
      <aside className="hidden border-r border-[var(--surface-border)] bg-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:overflow-y-auto">
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
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-[#F0F0ED] text-stone-950" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"}`}
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
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-[var(--surface-border)] bg-white px-4 shadow-[0_1px_8px_rgba(15,30,28,.025)] backdrop-blur md:px-8">
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
                <UserAvatar name={user?.name ?? "Usuário"} avatarUrl={user?.avatarUrl} size="medium" />
              <div>
                <Link href="/perfil" className="text-xs font-semibold hover:text-forest-800">{user?.name ?? "Sessão não autenticada"}</Link>
                <p className="text-[11px] text-stone-500">{user?.corporateTitle ?? "Acesse o login"}</p>
              </div>
            </div>
            {user && <button type="button" onClick={() => void logout()} className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900">Sair</button>}
          </div>
        </header>
        <main className="p-4 md:p-8 xl:p-10">{children}<footer className="mx-auto mt-10 max-w-7xl border-t border-[var(--surface-border)] pt-4 text-center text-[10px] text-stone-400"><Link href="/sobre" className="transition hover:text-stone-600">{SYSTEM_CREATOR_CREDIT_PT}</Link></footer></main>
      </div>
    </div>
  );
}
