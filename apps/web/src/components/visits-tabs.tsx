"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, LocateFixed, MapPinned } from "lucide-react";

const TABS = [
  { href: "/por-perto", label: "Por perto", icon: LocateFixed },
  { href: "/atendimento", label: "Atendimento", icon: ClipboardList },
  { href: "/prospeccao", label: "Prospecção", icon: MapPinned },
] as const;

/** One "Visitas" area: switch between nearby, customer visits and prospects with one tap. */
export function VisitsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Visitas" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-stone-200 bg-white p-1 shadow-sm">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-1 text-xs font-semibold transition sm:min-h-11 sm:flex-row sm:gap-1.5 sm:px-2 sm:text-sm ${active ? "bg-stone-950 text-white" : "text-stone-600 hover:bg-stone-50"}`}
          >
            <Icon size={17} aria-hidden className="shrink-0" />
            <span className="truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
