"use client";

import type { MouseEvent, ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ClipboardList,
  FileText,
  Package,
  Users,
  Wallet,
  Warehouse,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "@/components/logo";
import { currentUser } from "@/lib/current-user";
import { salesDesktopRoutes as routes } from "@/lib/sales-routes";

const items = [
  ["Início", routes.home, BarChart3],
  ["Clientes", routes.clients, Users],
  ["Pedidos", routes.orders, ClipboardList],
  ["Agenda / Visitas", routes.agenda, CalendarDays],
  ["Catálogo e preços", routes.catalog, Package],
  ["Comissões", routes.commissions, Wallet],
  ["Estoque", routes.stock, Warehouse],
  ["Relatórios", routes.reports, FileText],
  ["Notificações", routes.notifications, Bell],
] as const;

export function SalesDesktopLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const home = pathname === routes.home;
  if (home) return <>{children}</>;
  const normalize = (href: string) => {
    if (href.startsWith("/sales/mobile"))
      return href
        .replace("/sales/mobile", "/sales/desktop")
        .replace("/catalogo", "/catalogo");
    const legacy: Record<string, string> = {
      clientes: "clientes",
      pedidos: "pedidos",
      produtos: "catalogo",
      agenda: "agenda",
      comissoes: "comissoes",
      estoque: "estoque",
      relatorios: "relatorios",
      notificacoes: "notificacoes",
    };
    const match = href.match(
      /^\/sales\/(clientes|pedidos|produtos|agenda|comissoes|estoque|relatorios|notificacoes)(.*)$/,
    );
    const segment = match?.[1];
    return segment ? `/sales/desktop/${legacy[segment]}${match[2]}` : href;
  };
  const interceptLegacy = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const href = anchor.getAttribute("href");
    if (
      !href ||
      (!href.startsWith("/sales/mobile") && href.startsWith("/sales/desktop"))
    )
      return;
    const target = normalize(href);
    if (target !== href) {
      event.preventDefault();
      router.push(target);
    }
  };
  return (
    <div className="min-h-screen bg-[#F7F7F5] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 border-r border-stone-200 bg-white px-4 py-6 lg:flex lg:flex-col">
        <Link
          href={routes.home}
          aria-label="Bispo Coffees · Central do representante"
        >
          <Logo compact />
        </Link>
        <nav className="mt-8 space-y-1 text-sm">
          {items.slice(0, 8).map(([label, href, Icon]) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ${pathname.startsWith(href) ? "bg-blue-50 text-blue-800" : "text-stone-600 hover:bg-stone-50"}`}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="my-5 border-t border-stone-100" />
        <Link
          href={routes.notifications}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm ${pathname.startsWith(routes.notifications) ? "bg-blue-50 text-blue-800" : "text-stone-600 hover:bg-stone-50"}`}
        >
          <Bell size={17} />
          Notificações
        </Link>
        <div className="mt-auto border-t border-stone-100 pt-4">
          <p className="text-sm font-semibold">{currentUser.name}</p>
          <p className="mt-1 text-xs text-stone-500">
            {currentUser.corporateTitle}
          </p>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-60">
        <header className="flex items-center justify-end border-b border-stone-200 bg-white px-5 py-3 lg:px-9">
          <div className="text-right">
            <p className="text-sm font-semibold">{currentUser.name}</p>
            <p className="text-xs text-stone-500">
              {currentUser.corporateTitle}
            </p>
          </div>
        </header>
        <main className="px-5 py-6 lg:px-9">
          <div className="mx-auto max-w-7xl">
            <div onClick={interceptLegacy}>{children}</div>
          </div>
        </main>
      </div>
    </div>
  );
}
