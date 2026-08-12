"use client";

import Link from "next/link";
import { Bell, UserCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { currentUser } from "@/lib/current-user";

export function SalesShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname.startsWith("/sales/desktop")) return <>{children}</>;
  const mobile = pathname === "/sales" || pathname.startsWith("/sales/mobile");
  const homeHref = mobile ? "/sales/mobile" : "/sales/desktop";

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      <header
        className={`flex items-center justify-between border-b border-stone-200 bg-white px-4 ${mobile ? "py-3" : "py-3 lg:px-8"}`}
      >
        <Link
          href={homeHref}
          aria-label={
            mobile
              ? "Ir para Sales mobile"
              : "Ir para a Central do representante"
          }
          className="shrink-0"
        >
          <Logo compact={mobile} />
        </Link>
        {mobile ? (
          <div className="flex items-center gap-2">
            <Link
              href="/sales/notificacoes"
              aria-label="Notificações"
              className="grid size-9 place-items-center rounded-xl text-stone-600 hover:bg-stone-50"
            >
              <Bell size={18} />
            </Link>
            <span
              aria-label={currentUser.name}
              className="grid size-9 place-items-center rounded-full bg-blue-50 text-blue-700"
            >
              <UserCircle size={19} />
            </span>
          </div>
        ) : (
          <div className="text-right">
            <p className="text-sm font-semibold text-stone-800">
              {currentUser.name}
            </p>
            <p className="text-xs text-stone-500">
              {currentUser.corporateTitle}
            </p>
          </div>
        )}
      </header>
      {children}
    </div>
  );
}
