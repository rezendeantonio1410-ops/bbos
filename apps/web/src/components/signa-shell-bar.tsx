"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { Logo } from "@/components/logo";

export type ShellOrder = { id: string; code: string; status: string; customerName: string; endCustomerName?: string | null; totalAmount: number | string };
export type ShellEvent = { id: string; orderId: string; title: string; detail: string; occurredAt: string };

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Global search over orders: code, end customer, billing name or status label. */
export function searchShellOrders<T extends ShellOrder>(orders: readonly T[], query: string, stages: Record<string, string>, limit = 6): T[] {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return [];
  return orders
    .filter((order) => {
      const haystack = normalize([order.code, order.customerName, order.endCustomerName ?? "", stages[order.status] ?? order.status].join(" "));
      return terms.every((term) => haystack.includes(term));
    })
    .slice(0, limit);
}

/**
 * Enterprise shell bar (SAP Fiori shell bar / Microsoft 365 header pattern):
 * brand, product name, global search, notifications and user menu.
 */
export function SignaShellBar({
  partnerName,
  orders,
  events,
  stages,
  onOpenOrder,
  onLogout,
  onToggleMenu,
  menuOpen = false,
}: {
  partnerName: string;
  orders: ShellOrder[];
  events: ShellEvent[];
  stages: Record<string, string>;
  onOpenOrder: (orderId: string) => void;
  onLogout: () => void;
  onToggleMenu?: () => void;
  menuOpen?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [panel, setPanel] = useState<"none" | "notifications" | "user">("none");
  const searchRef = useRef<HTMLInputElement | null>(null);
  const results = useMemo(() => searchShellOrders(orders, query, stages), [orders, query, stages]);
  const recent = useMemo(() => [...events].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 8), [events]);
  const codeById = useMemo(() => new Map(orders.map((order) => [order.id, order.code])), [orders]);
  const initials = partnerName.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.key === "/" || (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey))) && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") setPanel("none");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const open = (orderId: string) => {
    setQuery("");
    setFocused(false);
    setPanel("none");
    onOpenOrder(orderId);
  };

  return (
    <header className="fixed inset-x-0 top-0 z-40 h-14 border-b border-[#e6e6e1] bg-[#ffffff]/95 backdrop-blur">
      <div className="flex h-full items-center gap-3 px-3 sm:px-5">
        <div className="flex shrink-0 items-center gap-2 sm:gap-3 lg:w-[11.5rem]">
          {onToggleMenu && <button type="button" onClick={onToggleMenu} aria-label="Menu do portal" aria-expanded={menuOpen} aria-controls="signa-portal-nav" className="grid size-10 place-items-center rounded-lg text-[#3d3d39] hover:bg-[#f4f4f1] lg:hidden"><Menu size={20} aria-hidden /></button>}
          <Logo compact />
          <span className="hidden h-6 w-px bg-[#e6e6e1] sm:block" aria-hidden />
          <span className="hidden text-[11px] font-semibold uppercase tracking-[.14em] text-[#6b6b66] sm:block">Portal</span>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <label className="flex h-10 items-center gap-2 rounded-lg border border-[#e2e2dd] bg-[#f6f6f3] px-3 text-sm focus-within:border-[#0A0A0A] focus-within:bg-white">
            <Search size={16} className="shrink-0 text-[#8a8a84]" aria-hidden />
            <span className="sr-only">Buscar pedidos</span>
            <input
              ref={searchRef}
              role="combobox"
              aria-expanded={focused && query.length > 0}
              aria-controls="shell-search-results"
              aria-activedescendant={results[highlight] ? `shell-result-${results[highlight].id}` : undefined}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setHighlight(0); }}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 150)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") { event.preventDefault(); setHighlight((value) => Math.min(value + 1, Math.max(results.length - 1, 0))); }
                if (event.key === "ArrowUp") { event.preventDefault(); setHighlight((value) => Math.max(value - 1, 0)); }
                if (event.key === "Enter" && results[highlight]) { event.preventDefault(); open(results[highlight].id); }
              }}
              placeholder="Buscar pedido, cliente ou situação"
              className="w-full bg-transparent text-[#0A0A0A] outline-none placeholder:text-[#8a8a84]"
            />
            <kbd aria-hidden="true" className="hidden rounded border border-[#e2e2dd] bg-white px-1.5 text-[10px] text-[#8a8a84] md:inline">/</kbd>
          </label>
          {focused && query && (
            <ul id="shell-search-results" role="listbox" className="absolute inset-x-0 top-12 max-h-80 overflow-auto rounded-xl border border-[#e6e6e1] bg-white p-1 shadow-xl">
              {results.length === 0 && <li className="px-3 py-3 text-sm text-[#6b6b66]">Nenhum pedido encontrado para “{query}”.</li>}
              {results.map((order, index) => (
                <li key={order.id} id={`shell-result-${order.id}`} role="option" aria-selected={index === highlight}>
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => open(order.id)}
                    className={`grid w-full grid-cols-[1fr_auto] gap-x-3 rounded-lg px-3 py-2 text-left text-sm ${index === highlight ? "bg-[#f4f4f1]" : "hover:bg-[#f7f7f4]"}`}>
                    <span className="font-semibold text-[#0A0A0A]">{order.code}</span>
                    <span className="tabular-nums text-[#3d3d39]">{currency.format(Number(order.totalAmount || 0))}</span>
                    <span className="truncate text-xs text-[#6b6b66]">{order.endCustomerName || order.customerName}</span>
                    <span className="text-xs text-[#6b6b66]">{stages[order.status] ?? order.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative flex shrink-0 items-center gap-1">
          <button type="button" aria-label={`Notificações${recent.length ? ` (${recent.length})` : ""}`} aria-expanded={panel === "notifications"}
            onClick={() => setPanel((value) => (value === "notifications" ? "none" : "notifications"))}
            className="relative grid size-10 place-items-center rounded-lg text-[#3d3d39] hover:bg-[#f4f4f1]">
            <Bell size={18} aria-hidden />
            {recent.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-[#c8792f]" aria-hidden />}
          </button>
          <button type="button" aria-label="Menu do usuário" aria-expanded={panel === "user"}
            onClick={() => setPanel((value) => (value === "user" ? "none" : "user"))}
            className="grid size-9 place-items-center rounded-full bg-[#0A0A0A] text-xs font-semibold text-white">
            {initials}
          </button>
          {panel === "notifications" && (
            <div className="absolute right-0 top-12 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-[#e6e6e1] bg-white p-2 shadow-xl">
              <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-[#6b6b66]">Atualizações dos pedidos</p>
              {recent.length === 0 && <p className="px-2 py-3 text-sm text-[#6b6b66]">Sem novidades por enquanto.</p>}
              <ul className="max-h-80 overflow-auto">
                {recent.map((event) => (
                  <li key={event.id}>
                    <button type="button" onClick={() => open(event.orderId)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-[#f7f7f4]">
                      <span className="block text-sm font-medium text-[#0A0A0A]">{event.title} · {codeById.get(event.orderId) ?? "Pedido"}</span>
                      <span className="block text-xs text-[#6b6b66]">{new Date(event.occurredAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {panel === "user" && (
            <div className="absolute right-0 top-12 w-60 rounded-xl border border-[#e6e6e1] bg-white p-2 shadow-xl">
              <p className="px-2 pt-1 text-sm font-semibold text-[#0A0A0A]">{partnerName}</p>
              <p className="px-2 pb-2 text-xs text-[#6b6b66]">Parceiro Bispo Coffees</p>
              <button type="button" onClick={onLogout} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-[#0A0A0A] hover:bg-[#f4f4f1]"><LogOut size={16} aria-hidden /> Sair do portal</button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
