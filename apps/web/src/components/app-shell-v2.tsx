"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bell,
  ChevronDown,
  ChevronRight,
  CornerDownLeft,
  Factory,
  LogOut,
  Menu,
  Search,
  PlugZap,
  Settings,
  Sparkles,
  Smartphone,
  UserRound,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";
import {
  mobileNavigationForRole,
  navigationForRole,
  pendingCountByGroup,
  toneClasses,
  type BbosNavGroup,
  type BbosNavItem,
} from "./bbos-navigation";
import {
  fetchSessionIdentity,
  getApiRoot,
  type SessionIdentity,
  SessionError,
} from "@/lib/auth-session";
import { SYSTEM_CREATOR_CREDIT_PT } from "@bbos/shared";
import {
  dismissRouteHelp,
  recordRouteVisit,
  routeHelpDismissed,
} from "@/lib/intelligence-client";

type ShellUser = SessionIdentity & { initials: string; corporateTitle: string };

type CommandItem = BbosNavItem & {
  groupLabel: string;
  groupTone: BbosNavGroup["tone"];
};
type ShellNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  readAt: string | null;
  createdAt: string;
};

const corporateTitleByRole: Record<string, string> = {
  ADMIN: "Sócio Administrador",
  EXECUTIVE: "Diretor",
  SALES: "Vendedor",
  FINANCE: "Financeiro",
  ACCOUNTANT: "Contabilidade",
  INDUSTRIAL: "Industrial",
  MARKETPLACE_OPERATOR: "Operador de marketplace",
};

/** Pages reached through in-page tabs (not in the side menu). */
const subpageLabels: Record<string, string> = {
  "/financeiro/receber": "Contas a receber",
  "/financeiro/pagar": "Contas a pagar",
  "/financeiro/agenda-vendas": "Agenda de vendas",
  "/financeiro/fluxo-caixa": "Fluxo de caixa",
  "/financeiro/bancos-contas": "Bancos e contas",
  "/financeiro/conciliacao": "Conciliação",
  "/financeiro/parametros": "Parâmetros",
};

const mobileShortLabelByHref: Record<string, string> = {
  "/home": "Início",
  "/dashboard": "Executivo",
  "/dashboard-industrial": "Industrial",
  "/clientes": "Clientes",
  "/atendimento": "Atendimento",
  "/por-perto": "Visitas",
  "/prospeccao": "Prospecção",
  "/pedidos": "Pedidos",
  "/estoque": "Estoque",
  "/producao": "Produção",
  "/financeiro": "Financeiro",
  "/notas-entrada": "Notas",
  "/custos": "Custos",
  "/commerce/marketplaces": "Marketplaces",
};

const salesRestrictedPrefixes = [
  "/dashboard",
  "/dashboard-industrial",
  "/cafe-verde",
  "/compras-cafe-verde",
  "/recebimento",
  "/estoque",
  "/laboratorio",
  "/producao",
  "/blends",
  "/produtos",
  "/fornecedores",
  "/corretores",
  "/commerce",
  "/exportacoes",
  "/notas-entrada",
  "/financeiro",
  "/custos",
  "/integracoes",
  "/usuarios",
  "/bi",
  "/bbos",
  "/pedidos/aprovacao",
] as const;

const accountantAllowedRoutes = new Set([
  "/financeiro",
  "/financeiro/receber",
  "/financeiro/pagar",
  "/financeiro/fluxo-caixa",
  "/financeiro/agenda-vendas",
  "/financeiro/bancos-contas",
  "/financeiro/conciliacao",
  "/notas-entrada",
  "/custos",
  "/clientes",
  "/pedidos",
  "/vendas",
  "/perfil",
]);
const accountantAllowedPrefixes = ["/custos/produtos/"] as const;

export function AppShellV2({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<ShellUser | null>(null);
  const [sessionState, setSessionState] = useState<
    "checking" | "authenticated" | "unauthenticated" | "unavailable"
  >("checking");
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [frictionHelp, setFrictionHelp] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<ShellNotification[]>([]);
  const [notificationsAvailable, setNotificationsAvailable] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSessionState("checking");
    void fetchSessionIdentity(getApiRoot())
      .then((identity) => {
        if (cancelled) return;
        if (identity.role === "PARTNER") {
          router.replace("/parceiro");
          return;
        }
        setSessionUser({
          ...identity,
          initials: identity.name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase(),
          corporateTitle:
            corporateTitleByRole[identity.role] ?? "Acesso restrito",
        });
        setSessionState("authenticated");
      })
      .catch((cause) => {
        if (cancelled) return;
        setSessionUser(null);
        setSessionState(
          cause instanceof SessionError && cause.kind === "unavailable"
            ? "unavailable"
            : "unauthenticated",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [router, sessionAttempt]);

  useEffect(() => {
    if (sessionState !== "authenticated") return;
    let cancelled = false;
    const load = () => {
      void fetch(`${getApiRoot()}/notifications`, {
        credentials: "include",
        cache: "no-store",
      })
        .then(async (response) => {
          if (!response.ok) throw new Error("notifications unavailable");
          return response.json() as Promise<{ items: ShellNotification[] }>;
        })
        .then((payload) => {
          if (cancelled) return;
          setNotifications(Array.isArray(payload?.items) ? payload.items : []);
          setNotificationsAvailable(true);
        })
        .catch(() => {
          if (!cancelled) setNotificationsAvailable(false);
        });
    };
    load();
    const timer = window.setInterval(load, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [sessionState]);

  const navGroups = useMemo(
    () => navigationForRole(sessionUser?.role),
    [sessionUser?.role],
  );
  const mobileQuickLinks = useMemo(
    () =>
      mobileNavigationForRole(sessionUser?.role).map((item) => ({
        ...item,
        shortLabel: mobileShortLabelByHref[item.href] ?? item.label,
      })),
    [sessionUser?.role],
  );
  const mobileExitHref = useMemo(() => {
    const defaultLanding =
      sessionUser?.role === "ACCOUNTANT"
        ? (mobileQuickLinks[0]?.href ?? "/financeiro")
        : "/home";
    if (pathname === defaultLanding) return null;

    const parentRoute = navGroups
      .flatMap((group) => group.items)
      .filter(
        (item) =>
          pathname === item.href || pathname.startsWith(`${item.href}/`),
      )
      .sort((a, b) => b.href.length - a.href.length)[0]?.href;

    return parentRoute && parentRoute !== pathname
      ? parentRoute
      : defaultLanding;
  }, [mobileQuickLinks, navGroups, pathname, sessionUser?.role]);
  const pageLabels = useMemo(
    () =>
      Object.fromEntries(
        navGroups.flatMap((group) =>
          group.items.map((item) => [item.href, item.label]),
        ),
      ),
    [navGroups],
  );
  const pendingByGroup = useMemo(
    () => pendingCountByGroup(navGroups, notifications),
    [navGroups, notifications],
  );
  const activeGroup = useMemo(
    () =>
      navGroups.find((group) =>
        group.items.some(
          (item) =>
            pathname === item.href || pathname.startsWith(`${item.href}/`),
        ),
      )?.label ?? "Visão geral",
    [navGroups, pathname],
  );
  const currentSubgroup = useMemo(
    () =>
      navGroups
        .flatMap((group) => group.items)
        .filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`))
        .sort((a, b) => b.href.length - a.href.length)[0]?.subgroup?.label ?? null,
    [navGroups, pathname],
  );
  const [expandedGroup, setExpandedGroup] = useState(activeGroup);
  const [openSubgroup, setOpenSubgroup] = useState("");

  useEffect(() => setExpandedGroup(activeGroup), [activeGroup]);

  useEffect(() => {
    const onAvatarUpdated = (event: Event) => {
      const detail = (event as CustomEvent<SessionIdentity>).detail;
      if (detail?.id)
        setSessionUser((current) =>
          current ? { ...current, ...detail } : current,
        );
    };
    window.addEventListener("bbos:avatar-updated", onAvatarUpdated);
    return () =>
      window.removeEventListener("bbos:avatar-updated", onAvatarUpdated);
  }, []);

  useEffect(() => {
    if (sessionState !== "unauthenticated" || pathname === "/login") return;
    const returnTo = `${pathname}${window.location.search}`;
    router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  }, [pathname, router, sessionState]);

  useEffect(() => {
    if (sessionState !== "authenticated" || sessionUser?.role !== "SALES")
      return;
    if (
      salesRestrictedPrefixes.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
      )
    ) {
      router.replace("/home");
    }
  }, [pathname, router, sessionState, sessionUser?.role]);

  useEffect(() => {
    if (
      sessionState !== "authenticated" ||
      sessionUser?.role !== "ACCOUNTANT" ||
      pathname === "/login"
    )
      return;
    if (
      !accountantAllowedRoutes.has(pathname) &&
      !accountantAllowedPrefixes.some((prefix) => pathname.startsWith(prefix))
    )
      router.replace("/financeiro");
  }, [pathname, router, sessionState, sessionUser?.role]);

  useEffect(() => {
    if (
      sessionState !== "authenticated" ||
      pathname === "/home" ||
      pathname === "/login" ||
      routeHelpDismissed(pathname)
    )
      return;
    const signal = recordRouteVisit(pathname);
    setFrictionHelp(signal.repeated ? (signal.message ?? null) : null);
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
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--surface-page)] p-6">
        <div className="text-center">
          <p className="text-sm text-stone-600">
            {sessionState === "checking"
              ? "Conectando ao BBOS…"
              : sessionState === "unavailable"
                ? "Não conseguimos conectar ao BBOS."
                : "Redirecionando para o login…"}
          </p>
          {sessionState === "unavailable" && (
            <button
              type="button"
              onClick={() => setSessionAttempt((attempt) => attempt + 1)}
              className="mt-4 rounded-xl bg-forest-800 px-4 py-2 text-sm font-semibold text-white"
            >
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  const user = sessionUser;
  const isSales = sessionUser?.role === "SALES";
  const currentLabel =
    isSales && pathname === "/home"
      ? "Painel comercial"
      : (pageLabels[pathname] ?? subpageLabels[pathname] ?? pageLabels[
          navGroups.flatMap((group) => group.items).filter((item) => pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? ""
        ] ?? "BBOS");
  const openAssistant = () =>
    window.dispatchEvent(new Event("bbos:open-assistant"));
  const logout = async () => {
    await fetch(`${getApiRoot()}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
    window.location.href = "/login";
  };
  const unreadNotifications = notifications.filter(
    (item) => !item.readAt,
  ).length;
  const openNotification = async (item: ShellNotification) => {
    if (!item.readAt) {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, readAt: new Date().toISOString() }
            : notification,
        ),
      );
      await fetch(`${getApiRoot()}/notifications/${item.id}/read`, {
        method: "PATCH",
        credentials: "include",
      }).catch(() => undefined);
    }
    setNotificationOpen(false);
    router.push(item.href);
  };
  const markAllNotificationsRead = async () => {
    const readAt = new Date().toISOString();
    setNotifications((current) =>
      current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })),
    );
    await fetch(`${getApiRoot()}/notifications/read-all`, {
      method: "PATCH",
      credentials: "include",
    }).catch(() => undefined);
  };

  const isRouteActive = (href: string) =>
    pathname === href || (href !== "/home" && pathname.startsWith(`${href}/`));
  const pendingFor = (href: string) =>
    notifications.filter(
      (item) => !item.readAt && (item.href.split(/[?#]/)[0] === href || item.href.startsWith(`${href}/`)),
    ).length;
  const renderNavLink = (
    { href, label, icon: Icon }: BbosNavItem,
    tone: (typeof toneClasses)[keyof typeof toneClasses],
    mobile: boolean,
  ) => {
    const active = isRouteActive(href);
    const itemPending = pendingFor(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        onClick={() => mobile && setMobileOpen(false)}
        className={`group flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 transition lg:min-h-10 ${active ? tone.active : "text-[var(--bbos-text-secondary)] hover:bg-white/80"}`}
      >
        <Icon size={18} aria-hidden className={`shrink-0 ${active ? "" : tone.text}`} />
        <span className="min-w-0 truncate text-sm font-medium">{label}</span>
        {itemPending > 0 && (
          <span className="ml-auto min-w-6 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-white">
            {itemPending > 99 ? "99+" : itemPending}
          </span>
        )}
      </Link>
    );
  };

  const Sidebar = ({ mobile = false }: { mobile?: boolean }) => (
    <div
      className={`flex h-full flex-col ${mobile ? "pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]" : ""}`}
    >
      <div className="flex items-center justify-between px-4 py-4">
        <Logo />
        {mobile && (
          <button
            aria-label="Fechar menu"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-2"
          >
            <X size={18} />
          </button>
        )}
      </div>
      <div className="mx-3 mb-3 flex items-center gap-2 rounded-xl border bg-[var(--bbos-surface-warm)] px-3 py-2.5">
        <span className="grid size-8 place-items-center rounded-lg bg-white">
          <Factory size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">Bispo Coffees</p>
          <p className="text-xs text-[var(--bbos-text-muted)]">
            Operação integrada
          </p>
        </div>
      </div>
      <nav aria-label="Áreas do sistema" className="flex-1 space-y-1 overflow-y-auto px-2 pb-3">
        {navGroups.map((group) => {
          const tone = toneClasses[group.tone];
          const isOpen = group.alwaysOpen || expandedGroup === group.label;
          const hasActive = group.label === activeGroup;
          const GroupIcon = group.icon;
          const pending = pendingByGroup[group.id] ?? 0;
          const badge = pending > 0 && (
            <span
              className="ml-auto min-w-6 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-white"
              aria-label={`${pending} pendências`}
            >
              {pending > 99 ? "99+" : pending}
            </span>
          );
          return (
            <div key={group.id} className="rounded-xl">
              {!group.alwaysOpen && (
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() =>
                    setExpandedGroup(isOpen && !hasActive ? "" : group.label)
                  }
                  className={`flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2.5 text-left text-sm font-semibold transition hover:bg-white lg:min-h-10 ${hasActive ? `${tone.soft} text-[var(--bbos-text-primary)]` : "text-[var(--bbos-text-primary)]"}`}
                >
                  <GroupIcon size={18} className={`shrink-0 ${tone.text}`} aria-hidden />
                  <span className="min-w-0 truncate">{group.label}</span>
                  {!isOpen && badge}
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className={`shrink-0 text-stone-400 transition-transform ${isOpen ? "rotate-180" : ""} ${!isOpen && pending ? "" : "ml-auto"}`}
                  />
                </button>
              )}
              {isOpen && (
                <div className={`space-y-0.5 ${group.alwaysOpen ? "" : "mt-0.5 border-l border-stone-200 pl-1.5 ml-[1.15rem]"}`}>
                  {group.items.map((item, index) => {
                    const sub = item.subgroup;
                    if (sub && group.items[index - 1]?.subgroup?.id === sub.id) return null;
                    if (!sub) return renderNavLink(item, tone, mobile);
                    const children = group.items.filter((candidate) => candidate.subgroup?.id === sub.id);
                    const subActive = children.some((child) => isRouteActive(child.href));
                    const subOpen = subActive || openSubgroup === sub.id;
                    const subPending = children.reduce((total, child) => total + pendingFor(child.href), 0);
                    const SubIcon = sub.icon;
                    return (
                      <div key={sub.id}>
                        <button
                          type="button"
                          aria-expanded={subOpen}
                          onClick={() => setOpenSubgroup(subOpen && !subActive ? "" : sub.id)}
                          className={`flex min-h-11 w-full items-center gap-2.5 rounded-lg px-2.5 text-left transition lg:min-h-10 ${subActive ? "font-semibold text-[var(--bbos-text-primary)]" : "text-[var(--bbos-text-secondary)] hover:bg-white/80"}`}
                        >
                          <SubIcon size={18} aria-hidden className={`shrink-0 ${tone.text}`} />
                          <span className="min-w-0 truncate text-sm font-medium">{sub.label}</span>
                          {!subOpen && subPending > 0 && (
                            <span className="ml-auto min-w-6 rounded-full bg-red-600 px-1.5 py-0.5 text-center text-xs font-bold tabular-nums text-white">
                              {subPending > 99 ? "99+" : subPending}
                            </span>
                          )}
                          <ChevronDown
                            size={15}
                            aria-hidden
                            className={`shrink-0 text-stone-400 transition-transform ${subOpen ? "rotate-180" : ""} ${!subOpen && subPending ? "" : "ml-auto"}`}
                          />
                        </button>
                        {subOpen && (
                          <div className="ml-[1.15rem] space-y-0.5 border-l border-stone-200 pl-1.5">
                            {children.map((child) => renderNavLink(child, tone, mobile))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>
      {!notificationsAvailable && (
        <div role="status" className="mx-3 mb-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-900">
          <Activity size={16} aria-hidden className="shrink-0" />
          Sem conexão com o servidor. Tentando de novo…
        </div>
      )}
    </div>
  );

  return (
    <div
      data-bbos-app-shell
      data-bbos-role={sessionUser?.role ?? ""}
      className="min-h-screen bg-[var(--surface-page)] text-[var(--bbos-text-primary)]"
    >
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 border-r bg-[var(--surface-sidebar)] lg:block">
        <Sidebar />
      </aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-[min(88vw,320px)] bg-[var(--surface-sidebar)] shadow-xl">
            <Sidebar mobile />
          </aside>
        </div>
      )}
      <div className="lg:pl-60">
        <header
          data-bbos-header
          className="sticky top-0 z-20 border-b bg-[color:var(--surface-header)]/95 pt-[env(safe-area-inset-top)] backdrop-blur"
        >
          <div className="flex h-14 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-5 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                aria-label="Abrir menu"
                className="rounded-xl border p-2 lg:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={18} />
              </button>
              {mobileExitHref && (
                <Link
                  href={mobileExitHref}
                  aria-label="Abandonar esta tela e voltar"
                  className="inline-flex min-h-10 items-center gap-1 rounded-xl border bg-white px-2.5 text-xs font-bold text-[var(--bbos-text-secondary)] lg:hidden"
                >
                  <ArrowLeft size={17} />
                  <span className="hidden min-[430px]:inline">Voltar</span>
                </Link>
              )}
              <nav aria-label="Caminho" className="min-w-0">
                <ol className="flex min-w-0 items-center gap-1.5 text-sm">
                  {activeGroup && activeGroup !== currentLabel && (
                    <li className="hidden shrink-0 items-center gap-1.5 text-[var(--bbos-text-muted)] sm:flex">
                      {activeGroup}
                      <ChevronRight size={14} aria-hidden />
                    </li>
                  )}
                  {currentSubgroup && (
                    <li className="hidden shrink-0 items-center gap-1.5 text-[var(--bbos-text-muted)] sm:flex">
                      {currentSubgroup}
                      <ChevronRight size={14} aria-hidden />
                    </li>
                  )}
                  <li aria-current="page" className="truncate font-semibold">
                    {currentLabel}
                  </li>
                </ol>
              </nav>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="hidden min-h-10 items-center gap-2 rounded-xl border border-[var(--bbos-control-border)] bg-white px-3 text-sm font-medium text-[var(--bbos-text-secondary)] transition hover:bg-[var(--bbos-surface-subtle)] md:flex"
              >
                <Search size={15} />
                <span>Buscar ou agir no BBOS</span>
                <kbd className="ml-2 rounded-md bg-stone-100 px-1.5 py-0.5 text-xs font-semibold text-stone-500">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                className="rounded-xl p-2 md:hidden"
                aria-label="Buscar ou agir no BBOS"
              >
                <Search size={18} />
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationOpen((open) => !open);
                    setProfileOpen(false);
                  }}
                  className="relative rounded-xl p-2 transition hover:bg-stone-100"
                  aria-label={
                    unreadNotifications
                      ? `Notificações, ${unreadNotifications} não lidas`
                      : "Notificações"
                  }
                  aria-expanded={notificationOpen}
                >
                  <Bell size={18} />
                  {unreadNotifications > 0 && (
                    <span className="absolute right-1 top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-600 px-1 text-[8px] font-bold text-white">
                      {Math.min(unreadNotifications, 9)}
                      {unreadNotifications > 9 ? "+" : ""}
                    </span>
                  )}
                </button>
                {notificationOpen && (
                  <>
                    <button
                      type="button"
                      aria-label="Fechar notificações"
                      className="fixed inset-0 z-30 cursor-default"
                      onClick={() => setNotificationOpen(false)}
                    />
                    <div className="fixed inset-x-2 top-[calc(3.75rem_+_env(safe-area-inset-top))] z-40 max-h-[min(72vh,560px)] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[min(360px,calc(100vw-2rem))]">
                      <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                        <div>
                          <p className="text-sm font-bold">Notificações</p>
                          <p className="mt-0.5 text-[10px] text-stone-400">
                            {isSales
                              ? "Avisos e decisões comerciais"
                              : "Decisões e exceções da operação"}
                          </p>
                        </div>
                        {unreadNotifications > 0 && (
                          <button
                            type="button"
                            onClick={() => void markAllNotificationsRead()}
                            className="text-[10px] font-bold text-emerald-700"
                          >
                            Marcar todas como lidas
                          </button>
                        )}
                      </div>
                      <div className="max-h-[calc(min(72vh,560px)_-_64px)] overflow-y-auto">
                        {!notificationsAvailable ? (
                          <div className="p-5 text-xs text-red-700">
                            Não foi possível confirmar as notificações agora.
                          </div>
                        ) : notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell
                              size={20}
                              className="mx-auto text-stone-300"
                            />
                            <p className="mt-3 text-xs font-semibold text-stone-700">
                              {isSales
                                ? "Nenhum aviso comercial."
                                : "Nenhuma notificação operacional."}
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-stone-400">
                              Novos avisos aparecerão aqui quando exigirem
                              acompanhamento.
                            </p>
                          </div>
                        ) : (
                          <div className="divide-y divide-stone-100">
                            {notifications.map((item) => {
                              const criticalDelivery = item.type.startsWith(
                                "ORDER_DELIVERY_EXCEPTION",
                              );
                              return (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => void openNotification(item)}
                                  className={`w-full px-4 py-3 text-left transition hover:bg-stone-50 ${
                                    criticalDelivery
                                      ? item.readAt
                                        ? "bg-red-50/35"
                                        : "bg-red-50"
                                      : item.readAt
                                        ? "bg-white"
                                        : "bg-amber-50/45"
                                  }`}
                                >
                                  <div className="flex gap-3">
                                    <span
                                      className={`mt-1 size-2 shrink-0 rounded-full ${
                                        criticalDelivery
                                          ? "bg-red-600 ring-4 ring-red-100"
                                          : item.readAt
                                            ? "bg-stone-200"
                                            : "bg-amber-500"
                                      }`}
                                    />
                                    <span className="min-w-0">
                                      {criticalDelivery && (
                                        <span className="mb-1 block text-[8px] font-black uppercase tracking-wider text-red-700">
                                          Ação imediata
                                        </span>
                                      )}
                                      <strong
                                        className={`block text-xs ${criticalDelivery ? "text-red-950" : "text-stone-900"}`}
                                      >
                                        {item.title}
                                      </strong>
                                      <span
                                        className={`mt-1 block text-[10px] leading-4 ${criticalDelivery ? "text-red-800" : "text-stone-500"}`}
                                      >
                                        {item.message}
                                      </span>
                                      <span className="mt-2 block text-[9px] text-stone-400">
                                        {new Date(
                                          item.createdAt,
                                        ).toLocaleString("pt-BR")}
                                      </span>
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              {user && (
                <div className="relative ml-1">
                  <button
                    type="button"
                    onClick={() => setProfileOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-xl px-1 py-1 text-left transition hover:bg-stone-100"
                  >
                    <UserAvatar name={user.name} avatarUrl={user.avatarUrl} />
                    <div className="hidden sm:block">
                      <p className="text-xs font-bold">{user.name}</p>
                      <p className="text-[10px] text-[var(--bbos-text-muted)]">
                        {user.corporateTitle}
                      </p>
                    </div>
                    <ChevronDown
                      size={13}
                      className={`hidden text-stone-400 transition-transform sm:block ${profileOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                  {profileOpen && (
                    <>
                      <button
                        aria-label="Fechar menu de perfil"
                        className="fixed inset-0 z-30 cursor-default"
                        onClick={() => setProfileOpen(false)}
                      />
                      <div className="absolute right-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-stone-200 bg-white p-2 shadow-xl">
                        <div className="px-3 py-2">
                          <p className="text-xs font-bold">{user.name}</p>
                          <p className="text-[10px] text-stone-400">
                            {user.corporateTitle}
                          </p>
                        </div>
                        <div className="my-1 border-t border-stone-100" />
                        <Link
                          href="/perfil"
                          onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                        >
                          <UserRound size={15} />
                          Meu perfil
                        </Link>
                        {(["ADMIN", "EXECUTIVE"] as string[]).includes(
                          user.role,
                        ) && (
                          <Link
                            href="/aplicativo"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                          >
                            <Smartphone size={15} />
                            Aplicativo no iPhone
                          </Link>
                        )}
                        {(["ADMIN", "EXECUTIVE"] as string[]).includes(
                          user.role,
                        ) && (
                          <Link
                            href="/integracoes"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                          >
                            <PlugZap size={15} />
                            Integrações
                          </Link>
                        )}
                        {user.role === "ADMIN" && (
                          <Link
                            href="/usuarios"
                            onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50"
                          >
                            <Settings size={15} />
                            Usuários e acessos
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => void logout()}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <LogOut size={15} />
                          Sair
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
          {frictionHelp && (
            <div className="border-t border-violet-100 bg-violet-50 px-4 py-2 text-xs text-violet-900">
              <div className="mx-auto flex max-w-[1580px] items-center justify-between gap-3">
                <span>{frictionHelp}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={openAssistant}
                    className="font-bold"
                  >
                    Me ajude
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      dismissRouteHelp(pathname);
                      setFrictionHelp(null);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </header>
        <main data-bbos-main className="p-2.5 sm:p-4 lg:p-5">
          {children}
        </main>
        <footer className="border-t px-5 py-3 text-center text-xs text-[var(--bbos-text-muted)]">
          {SYSTEM_CREATOR_CREDIT_PT}
        </footer>
      </div>
      {mobileQuickLinks.length > 0 && (
        <nav
          data-bbos-mobile-dock
          aria-label="Atalhos principais"
          className="fixed bottom-[calc(.45rem_+_env(safe-area-inset-bottom))] left-1/2 z-40 grid w-[calc(100%_-_1rem)] max-w-3xl -translate-x-1/2 grid-cols-5 overflow-hidden rounded-[20px] border border-stone-200 bg-white/95 p-1 shadow-[0_12px_40px_rgba(15,23,42,.18)] backdrop-blur lg:hidden"
          style={{
            gridTemplateColumns: `repeat(${mobileQuickLinks.length + 1}, minmax(0, 1fr))`,
          }}
        >
          {mobileQuickLinks.map((item) => {
            const Icon = item.icon;
            // A shortcut of a subgroup (Visitas) stays lit on its sibling pages.
            const siblings = item.subgroup
              ? navGroups.flatMap((group) => group.items).filter((other) => other.subgroup?.id === item.subgroup?.id)
              : [item];
            const active = siblings.some(
              (other) =>
                pathname === other.href ||
                (other.href !== "/home" && pathname.startsWith(`${other.href}/`)),
            );
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold transition sm:min-h-16 sm:text-sm ${
                  active
                    ? "bg-emerald-50 text-emerald-800"
                    : "text-stone-500 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span className="truncate">{item.shortLabel}</span>
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex min-h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-xs font-semibold text-stone-500 transition hover:bg-stone-50 hover:text-stone-900 sm:min-h-16 sm:text-sm"
            aria-label="Abrir todas as áreas"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </nav>
      )}
      <CommandCenter
        open={commandOpen}
        onClose={() => {
          setCommandOpen(false);
          setCommandQuery("");
        }}
        query={commandQuery}
        setQuery={setCommandQuery}
        groups={navGroups}
        onNavigate={(href) => {
          setCommandOpen(false);
          setCommandQuery("");
          router.push(href);
        }}
        onAsk={() => {
          setCommandOpen(false);
          openAssistant();
        }}
      />
    </div>
  );
}

function CommandCenter({
  open,
  onClose,
  query,
  setQuery,
  groups,
  onNavigate,
  onAsk,
}: {
  open: boolean;
  onClose: () => void;
  query: string;
  setQuery: (value: string) => void;
  groups: BbosNavGroup[];
  onNavigate: (href: string) => void;
  onAsk: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  const items = useMemo<CommandItem[]>(
    () =>
      groups.flatMap((group) =>
        group.items.map((item) => ({
          ...item,
          groupLabel: group.label,
          groupTone: group.tone,
        })),
      ),
    [groups],
  );
  const normalized = query.trim().toLowerCase();
  const filtered = normalized
    ? items.filter((item) =>
        [
          item.label,
          item.description,
          item.groupLabel,
          ...(item.keywords ?? []),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalized),
      )
    : items.slice(0, 9);
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[80] flex justify-center bg-black/30 px-2 pt-[max(.5rem,env(safe-area-inset-top))] backdrop-blur-[2px] sm:px-4 sm:pt-[10vh]"
      onMouseDown={onClose}
    >
      <div
        className="h-fit max-h-[calc(100dvh_-_1rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] w-full max-w-2xl overflow-hidden rounded-[20px] border border-stone-200 bg-white shadow-2xl sm:rounded-[24px]"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-stone-100 px-5 py-4">
          <Search size={19} className="text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar área, ação ou perguntar ao BBOS…"
            className="min-w-0 flex-1 bg-transparent text-base font-semibold outline-none placeholder:text-stone-300"
          />
          <kbd className="rounded-lg bg-stone-100 px-2 py-1 text-[10px] font-bold text-stone-400">
            ESC
          </kbd>
        </div>
        <div className="max-h-[56vh] overflow-y-auto p-3">
          {filtered.length > 0 ? (
            <div className="space-y-1">
              {filtered.map((item) => {
                const tone = toneClasses[item.groupTone];
                const Icon = item.icon;
                return (
                  <button
                    key={item.href}
                    type="button"
                    onClick={() => onNavigate(item.href)}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-stone-50"
                  >
                    <span
                      className={`grid size-9 place-items-center rounded-xl ${tone.soft} ${tone.text}`}
                    >
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-stone-900">
                        {item.label}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-stone-400">
                        {item.groupLabel} · {item.description}
                      </span>
                    </span>
                    <CornerDownLeft size={14} className="text-stone-300" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="px-3 py-8 text-center">
              <p className="text-sm font-semibold text-stone-700">
                Nenhum caminho direto encontrado.
              </p>
              <p className="mt-1 text-xs text-stone-400">
                O BBOS pode interpretar a pergunta no contexto da operação.
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-stone-100 p-3">
          <button
            type="button"
            onClick={onAsk}
            className="flex w-full items-center justify-between rounded-2xl bg-violet-50 px-4 py-3 text-left text-violet-800"
          >
            <span className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-white">
                <Sparkles size={17} />
              </span>
              <span>
                <span className="block text-sm font-bold">
                  Perguntar ao BBOS
                </span>
                <span className="block text-[10px] text-violet-500">
                  Explicar, comparar, diagnosticar ou preparar a próxima ação
                </span>
              </span>
            </span>
            <CornerDownLeft size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
