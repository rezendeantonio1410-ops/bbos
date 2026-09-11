"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  Search,
  ShoppingBag,
  Sparkles,
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
type NavGroup = { label: string; items: NavItem[] };

const navGroups: NavGroup[] = [
  {
    label: "Visão geral",
    items: [
      { href: "/home", label: "Central de comando", icon: House },
      { href: "/dashboard", label: "Executivo", icon: LayoutDashboard },
      { href: "/dashboard-industrial", label: "Industrial", icon: Gauge },
    ],
  },
  {
    label: "Comercial",
    items: [
      { href: "/clientes", label: "Clientes", icon: UsersRound },
      { href: "/pedidos", label: "Pedidos", icon: ShoppingBag },
      { href: "/vendas", label: "Vendas", icon: BarChart3 },
      { href: "/commerce", label: "Commerce", icon: Globe2 },
    ],
  },
  {
    label: "Operação",
    items: [
      { href: "/cafe-verde", label: "Café Verde", icon: PackageOpen },
      { href: "/producao", label: "Produção", icon: Factory },
      { href: "/blends", label: "Blends", icon: Boxes },
      { href: "/produtos", label: "Produtos", icon: PackageCheck },
      { href: "/laboratorio", label: "Laboratório", icon: FlaskConical },
    ],
  },
  {
    label: "Gestão",
    items: [
      { href: "/financeiro", label: "Financeiro", icon: CircleDollarSign },
      { href: "/custos", label: "Custos", icon: Calculator },
      { href: "/bi", label: "Inteligência", icon: BrainCircuit },
    ],
  },
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

  useEffect(() => {
    if (sessionState !== "authenticated" || pathname === "/home" || pathname === "/login") return;
    if (routeHelpDismissed(pathname)) return;
    const signal = recordRouteVisit(pathname);
    setFrictionHelp(signal.repeated ? signal.message ?? null : null);
  }, [pathname, sessionState]);

  const currentLabel = useMemo(() => pageLabels[pathname] ?? "BBOS", [pathname]);

  if (sessionState !== "authenticated") {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-6">
        <div className="text-center">
          <p className="text-sm text-stone-600">
            {sessionState === "checking" ? "Conectando ao BBOS…" : sessionState === "unavailable" ? "Não conseguimos conectar ao BBOS." : "Redirecionando para o login…"}
          </p>
          {sessionState === "checking" && <p className="mt-2 text-xs text-stone-500">Retomando a conexão com segurança…</p>}
          {sessionState === "unavailable" && <><p className="mt-2 text-xs text-stone-600">O sistema está retomando a conexão. Isso pode levar alguns segundos.</p><button type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-forest-900">Tentar novamente</button></>}
        </div>
      </div>
    );
  }

  const user = sessionUser;
  const logout = async () => { await fetch(`${getApiRoot()}/auth/logout`, { method: "POST", credentials: "include" }); window.location.href = "/login"; };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        {mobile && <button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2 text-stone-500 hover:bg-stone-100"><X size={18}/></button>}
      </div>
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl border border-[var(--bbos-border)] bg-[var(--bbos-surface-warm)] px-3 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-white text-[var(--bbos-coffee-green)] shadow-sm"><Factory size={16}/></span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">Bispo Coffees</p><p className="text-[10px] text-[var(--bbos-text-muted)]">Operação integrada</p></div>
        <ChevronDown size={14} className="text-stone-400" />
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-[var(--bbos-text-muted)]">{group.label}</p>
            <div className="space-y-0.5">
              {group.items.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
                return (
                  <Link key={href} href={href} onClick={() => mobile && setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition ${active ? "bg-[var(--bbos-nav-active)] text-[var(--bbos-text-primary)] shadow-[inset_3px_0_0_var(--bbos-coffee-green)]" : "text-[var(--bbos-text-secondary)] hover:bg-[var(--bbos-surface-subtle)] hover:text-[var(--bbos-text-primary)]"}`}>
                    <Icon size={17} strokeWidth={active ? 2.1 : 1.7}/>
                    <span>{label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <Link href="/bi" className="m-4 rounded-2xl border border-[#DDD6FE] bg-[var(--bbos-intelligence-soft)] p-4 transition hover:-translate-y-0.5 hover:shadow-sm">
        <div className="flex items-center gap-2 text-[var(--bbos-intelligence)]"><Sparkles size={15}/><p className="text-xs font-bold">BBOS Intelligence</p></div>
        <p className="mt-2 text-[11px] leading-4 text-[var(--bbos-text-secondary)]">Contexto, fricção e próxima melhor ação.</p>
        <span className="mt-3 inline-flex items-center text-[10px] font-bold text-[var(--bbos-intelligence)]">Abrir inteligência</span>
      </Link>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--surface-page)] lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="hidden border-r border-[var(--surface-border)] bg-[var(--surface-sidebar)] lg:sticky lg:top-0 lg:block lg:h-screen"><Sidebar /></aside>

      {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-black/25 backdrop-blur-[1px]" onClick={() => setMobileOpen(false)}/><aside className="relative h-full w-[86%] max-w-[310px] bg-white shadow-2xl"><Sidebar mobile /></aside></div>}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-[var(--surface-border)] bg-white/95 px-4 backdrop-blur md:px-7">
          <div className="flex min-w-0 items-center gap-3">
            <button aria-label="Abrir menu" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 hover:bg-stone-100 lg:hidden"><Menu size={20}/></button>
            <div className="hidden lg:block"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[var(--bbos-text-muted)]">Você está em</p><p className="truncate text-sm font-bold text-[var(--bbos-text-primary)]">{currentLabel}</p></div>
          </div>
          <div className="hidden w-full max-w-[390px] items-center gap-2 rounded-xl border border-transparent bg-[var(--bbos-surface-subtle)] px-3 py-2.5 text-stone-500 transition focus-within:border-[var(--bbos-border)] lg:flex">
            <Search size={16}/><input aria-label="Buscar" className="w-full bg-transparent text-sm outline-none" placeholder="Buscar cliente, pedido, lote, produto…" />
          </div>
          <div className="flex items-center gap-2.5">
            <Link href="/bi" className="hidden items-center gap-2 rounded-xl bg-[var(--bbos-intelligence-soft)] px-3 py-2 text-xs font-bold text-[var(--bbos-intelligence)] md:flex"><Sparkles size={14}/> Perguntar à IA</Link>
            <button aria-label="Notificações" className="relative rounded-xl border border-[var(--bbos-border)] bg-white p-2.5 text-stone-600"><Bell size={17}/><span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--bbos-state-attention)]" /></button>
            <div className="hidden h-8 w-px bg-stone-200 sm:block" />
            <div className="hidden items-center gap-2.5 sm:flex"><UserAvatar name={user?.name ?? "Usuário"} avatarUrl={user?.avatarUrl} size="medium"/><div><Link href="/perfil" className="text-xs font-semibold hover:text-forest-800">{user?.name ?? "Usuário"}</Link><p className="text-[10px] text-stone-500">{user?.corporateTitle ?? ""}</p></div></div>
            {user && <button type="button" onClick={() => void logout()} className="rounded-lg px-2 py-1 text-xs font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-900">Sair</button>}
          </div>
        </header>

        {frictionHelp && (
          <div className="mx-4 mt-4 md:mx-7">
            <div className="bbos-friction-banner">
              <span><Sparkles size={16}/></span>
              <div className="min-w-0 flex-1"><strong>Posso facilitar este caminho.</strong><p>{frictionHelp}</p></div>
              <Link href="/bi" className="bbos-friction-action">Me ajude</Link>
              <button aria-label="Dispensar sugestão" onClick={() => { dismissRouteHelp(pathname); setFrictionHelp(null); }} className="rounded-lg p-1.5 text-[var(--bbos-text-muted)] hover:bg-white"><X size={14}/></button>
            </div>
          </div>
        )}

        <main className="p-4 md:p-7 xl:p-9">{children}<footer className="mx-auto mt-10 max-w-7xl border-t border-[var(--surface-border)] pt-4 text-center text-[10px] text-stone-400"><Link href="/sobre" className="transition hover:text-stone-600">{SYSTEM_CREATOR_CREDIT_PT}</Link></footer></main>
      </div>
    </div>
  );
}
