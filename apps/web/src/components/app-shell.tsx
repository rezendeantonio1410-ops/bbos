"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
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
  LogOut,
  Menu,
  PackageCheck,
  PackageOpen,
  Search,
  Settings,
  ShoppingBag,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";
import { fetchSessionIdentity, getApiRoot, type SessionIdentity, SessionError } from "@/lib/auth-session";
import { SYSTEM_CREATOR_CREDIT_PT } from "@bbos/shared";
import { dismissRouteHelp, recordRouteVisit, routeHelpDismissed } from "@/lib/intelligence-client";

type NavItem = { href: string; label: string; icon: typeof House };
type NavGroup = { label: string; items: NavItem[]; alwaysOpen?: boolean };

const navGroups: NavGroup[] = [
  { label: "Visão geral", alwaysOpen: true, items: [
    { href: "/home", label: "Central de comando", icon: House },
    { href: "/dashboard", label: "Executivo", icon: LayoutDashboard },
    { href: "/dashboard-industrial", label: "Industrial", icon: Gauge },
  ]},
  { label: "Comercial", items: [
    { href: "/clientes", label: "Clientes", icon: UsersRound },
    { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
    { href: "/vendas", label: "Vendas", icon: BarChart3 },
    { href: "/commerce", label: "Commerce", icon: Globe2 },
  ]},
  { label: "Operação", items: [
    { href: "/cafe-verde", label: "Café Verde", icon: PackageOpen },
    { href: "/producao", label: "Produção", icon: Factory },
    { href: "/blends", label: "Blends", icon: Boxes },
    { href: "/produtos", label: "Produtos", icon: PackageCheck },
    { href: "/laboratorio", label: "Laboratório", icon: FlaskConical },
  ]},
  { label: "Gestão", items: [
    { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
    { href: "/custos", label: "Custos", icon: Calculator },
    { href: "/usuarios", label: "Usuários e acessos", icon: UsersRound },
    { href: "/bi", label: "Inteligência", icon: BrainCircuit },
  ]},
];

const pageLabels = Object.fromEntries(navGroups.flatMap((group) => group.items.map((item) => [item.href, item.label])));

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<(SessionIdentity & { initials: string; corporateTitle: string }) | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "authenticated" | "unauthenticated" | "unavailable">("checking");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [frictionHelp, setFrictionHelp] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const activeGroup = useMemo(
    () => navGroups.find((group) => group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))?.label ?? "Visão geral",
    [pathname],
  );
  const [expandedGroup, setExpandedGroup] = useState(activeGroup);

  useEffect(() => setExpandedGroup(activeGroup), [activeGroup]);

  useEffect(() => {
    let cancelled = false;
    setSessionState("checking");
    void fetchSessionIdentity(getApiRoot())
      .then((identity) => {
        if (cancelled) return;
        setSessionUser({
          ...identity,
          initials: identity.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
          corporateTitle: identity.role === "ADMIN" ? "Sócio Administrador" : identity.role === "EXECUTIVE" ? "Diretor" : identity.role === "SALES" ? "Comercial" : identity.role,
        });
        setSessionState("authenticated");
      })
      .catch((cause) => {
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

  useEffect(() => {
    if (sessionState !== "authenticated" || pathname === "/home" || pathname === "/login" || routeHelpDismissed(pathname)) return;
    const signal = recordRouteVisit(pathname);
    setFrictionHelp(signal.repeated ? signal.message ?? null : null);
  }, [pathname, sessionState]);

  const currentLabel = useMemo(() => pageLabels[pathname] ?? "BBOS", [pathname]);

  if (sessionState !== "authenticated") {
    return <div className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-6"><div className="text-center"><p className="text-sm text-stone-600">{sessionState === "checking" ? "Conectando ao BBOS…" : sessionState === "unavailable" ? "Não conseguimos conectar ao BBOS." : "Redirecionando para o login…"}</p>{sessionState === "checking" && <p className="mt-2 text-xs text-stone-500">Retomando a conexão com segurança…</p>}{sessionState === "unavailable" && <><p className="mt-2 text-xs text-stone-600">O sistema está retomando a conexão. Isso pode levar alguns segundos.</p><button type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white">Tentar novamente</button></>}</div></div>;
  }

  const user = sessionUser;
  const logout = async () => {
    await fetch(`${getApiRoot()}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };
  const openAssistant = () => window.dispatchEvent(new Event("bbos:open-assistant"));

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5"><Logo />{mobile && <button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2"><X size={18} /></button>}</div>
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl border bg-[var(--bbos-surface-warm)] px-3 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-white"><Factory size={16} /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">Bispo Coffees</p><p className="text-[10px] text-[var(--bbos-text-muted)]">Operação integrada</p></div>
      </div>
      <nav className="flex-1 space-y-3 overflow-y-auto px-3 pb-5">
        {navGroups.map((group) => {
          const isOpen = group.alwaysOpen || expandedGroup === group.label;
          const hasActive = group.label === activeGroup;
          return <div key={group.label}>
            {group.alwaysOpen ? <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-[var(--bbos-text-muted)]">{group.label}</p> : <button type="button" onClick={() => setExpandedGroup(isOpen && !hasActive ? "" : group.label)} className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-[9px] font-bold uppercase tracking-[.16em] transition ${hasActive ? "text-[var(--bbos-text-primary)]" : "text-[var(--bbos-text-muted)] hover:bg-[var(--bbos-surface-subtle)]"}`}><span>{group.label}</span><ChevronDown size={13} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>}
            {isOpen && <div className="mt-0.5 space-y-0.5">{group.items.map(({ href, label, icon: Icon }) => {
              const active = pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
              return <Link key={href} href={href} onClick={() => mobile && setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active ? "bg-[var(--bbos-nav-active)] text-[var(--bbos-text-primary)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]" : "text-[var(--bbos-text-secondary)] hover:bg-[var(--bbos-surface-subtle)]"}`}><Icon size={17} /><span>{label}</span></Link>;
            })}</div>}
          </div>;
        })}
      </nav>
      <div className="mx-4 mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/55 p-3">
        <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-emerald-700"><Activity size={15}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-emerald-700">Operação hoje</p><p className="mt-0.5 text-[11px] font-bold text-stone-800">Sistema conectado</p></div></div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-500"><span className="size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,.10)]"/><span>Sessão ativa · dados disponíveis</span></div>
      </div>
    </div>
  );

  return <div className="min-h-screen bg-[var(--surface-page)] text-[var(--bbos-text-primary)]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-white lg:block"><Sidebar /></aside>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-72 bg-white shadow-xl"><Sidebar mobile /></aside></div>}
    <div className="lg:pl-64">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button aria-label="Abrir menu" className="rounded-xl border p-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div><p className="text-sm font-semibold">{currentLabel}</p><p className="text-[10px] text-[var(--bbos-text-muted)]">Bispo Business Operating System</p></div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={openAssistant} className="hidden min-h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[11px] font-semibold text-stone-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 md:flex" aria-label="Buscar ou perguntar ao BBOS"><Search size={15} /><span>Buscar ou perguntar ao BBOS</span><kbd className="ml-2 rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">⌘K</kbd></button>
            <button type="button" onClick={openAssistant} className="rounded-xl p-2 md:hidden" aria-label="Buscar ou perguntar ao BBOS"><Search size={18} /></button>
            <button className="rounded-xl p-2" aria-label="Notificações"><Bell size={18} /></button>
            {user && <div className="relative ml-1">
              <button type="button" onClick={() => setProfileOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-stone-100" aria-expanded={profileOpen}>
                <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                <div className="hidden sm:block"><p className="text-xs font-bold">{user.name}</p><p className="text-[10px] text-[var(--bbos-text-muted)]">{user.corporateTitle}</p></div>
                <ChevronDown size={13} className={`hidden text-stone-400 transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`} />
              </button>
              {profileOpen && <><button aria-label="Fechar menu de perfil" className="fixed inset-0 z-30 cursor-default" onClick={() => setProfileOpen(false)} /><div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                <div className="px-3 py-2"><p className="text-xs font-bold text-stone-900">{user.name}</p><p className="mt-0.5 text-[10px] text-stone-400">{user.corporateTitle}</p></div>
                <div className="my-1 border-t border-stone-100" />
                <Link href="/perfil" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><UserRound size={15} />Meu perfil</Link>
                {user.role === "ADMIN" && <Link href="/usuarios" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><Settings size={15} />Usuários e acessos</Link>}
                <button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><LogOut size={15} />Sair</button>
              </div></>}
            </div>}
          </div>
        </div>
        {frictionHelp && <div className="border-t border-violet-100 bg-violet-50 px-4 py-2 text-xs text-violet-900"><div className="mx-auto flex max-w-[1580px] items-center justify-between gap-3"><span>{frictionHelp}</span><div className="flex gap-2"><button type="button" onClick={openAssistant} className="font-bold">Me ajude</button><button type="button" onClick={() => { dismissRouteHelp(pathname); setFrictionHelp(null); }}><X size={14} /></button></div></div></div>}
      </header>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      <footer className="border-t px-6 py-4 text-center text-[10px] text-[var(--bbos-text-muted)]">{SYSTEM_CREATOR_CREDIT_PT}</footer>
    </div>
  </div>;
}
