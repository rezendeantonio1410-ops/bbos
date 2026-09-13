"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  Bell,
  ChevronDown,
  CornerDownLeft,
  Factory,
  LogOut,
  Menu,
  Search,
  Settings,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";
import { navigationForRole, toneClasses, type BbosNavGroup, type BbosNavItem } from "./bbos-navigation";
import { fetchSessionIdentity, getApiRoot, type SessionIdentity, SessionError } from "@/lib/auth-session";
import { SYSTEM_CREATOR_CREDIT_PT } from "@bbos/shared";
import { dismissRouteHelp, recordRouteVisit, routeHelpDismissed } from "@/lib/intelligence-client";

type ShellUser = SessionIdentity & { initials: string; corporateTitle: string };

type CommandItem = BbosNavItem & { groupLabel: string; groupTone: BbosNavGroup["tone"] };

export function AppShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<ShellUser | null>(null);
  const [sessionState, setSessionState] = useState<"checking" | "authenticated" | "unauthenticated" | "unavailable">("checking");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [frictionHelp, setFrictionHelp] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setSessionState("checking");
    void fetchSessionIdentity(getApiRoot())
      .then((identity) => {
        if (cancelled) return;
        setSessionUser({
          ...identity,
          initials: identity.name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(),
          corporateTitle: identity.role === "ADMIN" ? "Sócio Administrador" : identity.role === "EXECUTIVE" ? "Diretor" : identity.role === "SALES" ? "Comercial" : identity.role === "FINANCE" ? "Financeiro" : "Industrial",
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

  const navGroups = useMemo(() => navigationForRole(sessionUser?.role), [sessionUser?.role]);
  const pageLabels = useMemo(() => Object.fromEntries(navGroups.flatMap((group) => group.items.map((item) => [item.href, item.label]))), [navGroups]);
  const activeGroup = useMemo(() => navGroups.find((group) => group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)))?.label ?? "Visão geral", [navGroups, pathname]);
  const [expandedGroup, setExpandedGroup] = useState(activeGroup);

  useEffect(() => setExpandedGroup(activeGroup), [activeGroup]);

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  if (sessionState !== "authenticated") {
    return <div className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-6"><div className="text-center"><p className="text-sm text-stone-600">{sessionState === "checking" ? "Conectando ao BBOS…" : sessionState === "unavailable" ? "Não conseguimos conectar ao BBOS." : "Redirecionando para o login…"}</p>{sessionState === "unavailable" && <button type="button" onClick={() => setSessionAttempt((attempt) => attempt + 1)} className="mt-4 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white">Tentar novamente</button>}</div></div>;
  }

  const user = sessionUser;
  const currentLabel = pageLabels[pathname] ?? "BBOS";
  const openAssistant = () => window.dispatchEvent(new Event("bbos:open-assistant"));
  const logout = async () => {
    await fetch(`${getApiRoot()}/auth/logout`, { method: "POST", credentials: "include" });
    window.location.href = "/login";
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 py-5"><Logo />{mobile && <button aria-label="Fechar menu" onClick={() => setMobileOpen(false)} className="rounded-lg p-2"><X size={18} /></button>}</div>
      <div className="mx-4 mb-4 flex items-center gap-2 rounded-2xl border bg-[var(--bbos-surface-warm)] px-3 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-white"><Factory size={16} /></span>
        <div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">Bispo Coffees</p><p className="text-[10px] text-[var(--bbos-text-muted)]">Operação integrada</p></div>
      </div>
      <nav className="flex-1 space-y-2 overflow-y-auto px-3 pb-5">
        {navGroups.map((group) => {
          const tone = toneClasses[group.tone];
          const isOpen = group.alwaysOpen || expandedGroup === group.label;
          const hasActive = group.label === activeGroup;
          return <div key={group.id} className="rounded-2xl">
            {group.alwaysOpen ? (
              <div className={`px-3 pb-2 pt-1 ${tone.text}`}>
                <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.14em]"><span className={`size-1.5 rounded-full ${tone.dot}`} />{group.label}</div>
                <p className="ml-3.5 mt-1 text-[9px] font-medium normal-case tracking-normal text-stone-400">{group.description}</p>
              </div>
            ) : (
              <button type="button" onClick={() => setExpandedGroup(isOpen && !hasActive ? "" : group.label)} className={`w-full rounded-2xl border px-3 py-3 text-left transition hover:-translate-y-px hover:shadow-sm ${hasActive ? `${tone.soft} border-transparent` : "border-stone-100 bg-white/65"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className={`flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[.12em] ${tone.text}`}><span className={`grid size-7 place-items-center rounded-lg ${tone.dot}`}><span className="size-2 rounded-[3px] border-2 border-white/95" /></span>{group.label}</span>
                  <ChevronDown size={14} className={`text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
                <p className="ml-9 mt-1 text-[9px] font-semibold text-stone-400">{group.description}</p>
              </button>
            )}
            {isOpen && <div className="mt-1 space-y-0.5 pl-1">{group.items.map(({ href, label, description, icon: Icon }) => {
              const active = pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
              return <Link key={href} href={href} onClick={() => mobile && setMobileOpen(false)} className={`group flex items-start gap-3 rounded-xl px-3 py-2.5 transition ${active ? tone.active : "text-[var(--bbos-text-secondary)] hover:bg-white/80"}`}>
                <Icon size={17} className={`mt-0.5 shrink-0 ${active ? "" : tone.text}`} />
                <span className="min-w-0"><span className="block text-[13px] font-semibold">{label}</span><span className="mt-0.5 block truncate text-[9px] font-medium opacity-55">{description}</span></span>
              </Link>;
            })}</div>}
          </div>;
        })}
      </nav>
      <div className="mx-4 mb-4 rounded-2xl border border-emerald-100 bg-emerald-50/55 p-3">
        <div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-xl bg-white text-emerald-700"><Activity size={15}/></span><div><p className="text-[10px] font-extrabold uppercase tracking-[.13em] text-emerald-700">Operação hoje</p><p className="mt-0.5 text-[11px] font-bold text-stone-800">Sistema conectado</p></div></div>
        <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-500"><span className="size-2 rounded-full bg-emerald-500"/><span>Sessão ativa · dados disponíveis</span></div>
      </div>
    </div>
  );

  return <div className="min-h-screen bg-[var(--surface-page)] text-[var(--bbos-text-primary)]">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r bg-white lg:block"><Sidebar /></aside>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button aria-label="Fechar menu" className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} /><aside className="relative h-full w-72 bg-white shadow-xl"><Sidebar mobile /></aside></div>}
    <div className="lg:pl-72">
      <header className="sticky top-0 z-20 border-b bg-white/95 backdrop-blur">
        <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3"><button aria-label="Abrir menu" className="rounded-xl border p-2 lg:hidden" onClick={() => setMobileOpen(true)}><Menu size={18} /></button><div><p className="text-sm font-semibold">{currentLabel}</p><p className="text-[10px] text-[var(--bbos-text-muted)]">Bispo Business Operating System</p></div></div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCommandOpen(true)} className="hidden min-h-9 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-[11px] font-semibold text-stone-500 transition hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700 md:flex"><Search size={15} /><span>Buscar ou agir no BBOS</span><kbd className="ml-2 rounded-md bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold text-stone-400">⌘K</kbd></button>
            <button type="button" onClick={() => setCommandOpen(true)} className="rounded-xl p-2 md:hidden" aria-label="Buscar ou agir no BBOS"><Search size={18} /></button>
            <button className="rounded-xl p-2" aria-label="Notificações"><Bell size={18} /></button>
            {user && <div className="relative ml-1">
              <button type="button" onClick={() => setProfileOpen((open) => !open)} className="flex items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-stone-100"><UserAvatar name={user.name} avatarUrl={user.avatarUrl} /><div className="hidden sm:block"><p className="text-xs font-bold">{user.name}</p><p className="text-[10px] text-[var(--bbos-text-muted)]">{user.corporateTitle}</p></div><ChevronDown size={13} className={`hidden text-stone-400 transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`} /></button>
              {profileOpen && <><button aria-label="Fechar menu de perfil" className="fixed inset-0 z-30 cursor-default" onClick={() => setProfileOpen(false)} /><div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-xl"><div className="px-3 py-2"><p className="text-xs font-bold">{user.name}</p><p className="text-[10px] text-stone-400">{user.corporateTitle}</p></div><div className="my-1 border-t border-stone-100"/><Link href="/perfil" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><UserRound size={15}/>Meu perfil</Link>{user.role === "ADMIN" && <Link href="/usuarios" onClick={() => setProfileOpen(false)} className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"><Settings size={15}/>Usuários e acessos</Link>}<button type="button" onClick={() => void logout()} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"><LogOut size={15}/>Sair</button></div></>}
            </div>}
          </div>
        </div>
        {frictionHelp && <div className="border-t border-violet-100 bg-violet-50 px-4 py-2 text-xs text-violet-900"><div className="mx-auto flex max-w-[1580px] items-center justify-between gap-3"><span>{frictionHelp}</span><div className="flex gap-2"><button type="button" onClick={openAssistant} className="font-bold">Me ajude</button><button type="button" onClick={() => { dismissRouteHelp(pathname); setFrictionHelp(null); }}><X size={14}/></button></div></div></div>}
      </header>
      <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      <footer className="border-t px-6 py-4 text-center text-[10px] text-[var(--bbos-text-muted)]">{SYSTEM_CREATOR_CREDIT_PT}</footer>
    </div>
    <CommandCenter open={commandOpen} onClose={() => { setCommandOpen(false); setCommandQuery(""); }} query={commandQuery} setQuery={setCommandQuery} groups={navGroups} onNavigate={(href) => { setCommandOpen(false); setCommandQuery(""); router.push(href); }} onAsk={() => { setCommandOpen(false); openAssistant(); }} />
  </div>;
}

function CommandCenter({ open, onClose, query, setQuery, groups, onNavigate, onAsk }: { open: boolean; onClose: () => void; query: string; setQuery: (value: string) => void; groups: BbosNavGroup[]; onNavigate: (href: string) => void; onAsk: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 0); }, [open]);
  const items = useMemo<CommandItem[]>(() => groups.flatMap((group) => group.items.map((item) => ({ ...item, groupLabel: group.label, groupTone: group.tone }))), [groups]);
  const normalized = query.trim().toLowerCase();
  const filtered = normalized ? items.filter((item) => [item.label, item.description, item.groupLabel, ...(item.keywords ?? [])].join(" ").toLowerCase().includes(normalized)) : items.slice(0, 9);
  if (!open) return null;
  return <div className="fixed inset-0 z-[80] flex justify-center bg-black/30 px-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={onClose}>
    <div className="h-fit w-full max-w-2xl overflow-hidden rounded-[24px] border border-stone-200 bg-white shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4"><Search size={19} className="text-stone-400"/><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar área, ação ou perguntar ao BBOS…" className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-stone-300"/><kbd className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-400">ESC</kbd></div>
      <div className="max-h-[56vh] overflow-y-auto p-3">
        {filtered.length > 0 ? <div className="space-y-1">{filtered.map((item) => { const tone = toneClasses[item.groupTone]; const Icon = item.icon; return <button key={item.href} type="button" onClick={() => onNavigate(item.href)} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50"><span className={`grid size-9 place-items-center rounded-xl ${tone.soft} ${tone.text}`}><Icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-stone-900">{item.label}</span><span className="mt-0.5 block truncate text-[11px] text-stone-400">{item.groupLabel} · {item.description}</span></span><CornerDownLeft size={14} className="text-stone-300"/></button>; })}</div> : <div className="px-3 py-8 text-center"><p className="text-sm font-semibold text-stone-700">Nenhum caminho direto encontrado.</p><p className="mt-1 text-xs text-stone-400">O BBOS pode interpretar a pergunta no contexto da operação.</p></div>}
      </div>
      <div className="border-t border-stone-100 p-3"><button type="button" onClick={onAsk} className="flex w-full items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 text-left text-violet-800"><span className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-white"><Sparkles size={17}/></span><span><span className="block text-sm font-bold">Perguntar ao BBOS</span><span className="block text-[10px] text-violet-500">Explicar, comparar, diagnosticar ou preparar a próxima ação</span></span></span><CornerDownLeft size={14}/></button></div>
    </div>
  </div>;
}
