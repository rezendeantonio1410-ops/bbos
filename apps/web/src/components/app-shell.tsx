'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, Boxes, ChevronDown, CircleDollarSign, Factory, FlaskConical, Gauge, LayoutDashboard, Menu, PackageCheck, PackageOpen, Search, ShoppingBag, Warehouse } from 'lucide-react';
import type { ReactNode } from 'react';
import { Logo } from './logo';

const nav = [
  { href: '/dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard },
  { href: '/industrial', label: 'Dashboard Industrial', icon: Gauge },
  { href: '/recebimento', label: 'Recebimento', icon: PackageOpen },
  { href: '/laboratorio', label: 'Laboratório', icon: FlaskConical },
  { href: '/estoque', label: 'Estoque', icon: Warehouse },
  { href: '/producao', label: 'Produção', icon: Factory },
  { href: '/blends', label: 'Blends', icon: Boxes },
  { href: '/produtos', label: 'Produtos', icon: PackageCheck },
  { href: '/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/financeiro', label: 'Financeiro', icon: CircleDollarSign },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="min-h-screen bg-[#f7f7f4] lg:grid lg:grid-cols-[264px_1fr]">
    <aside className="hidden border-r border-stone-200 bg-white lg:flex lg:flex-col">
      <div className="px-6 py-7"><Logo /></div>
      <div className="mx-4 mb-5 flex items-center gap-2 rounded-xl border bg-stone-50 px-3 py-2.5"><span className="grid size-8 place-items-center rounded-lg bg-coffee-100 text-coffee-600"><Factory size={16} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold">Bispo Coffees</p><p className="text-[11px] text-stone-500">Operação Industrial</p></div><ChevronDown size={14} className="text-stone-400" /></div>
      <nav className="flex-1 space-y-1 px-3">{nav.map(({ href, label, icon: Icon }) => { const active = pathname === href; return <Link key={href} href={href} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-forest-50 text-forest-900' : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'}`}><Icon size={18} strokeWidth={active ? 2.1 : 1.7} />{label}</Link>; })}</nav>
      <div className="m-4 rounded-2xl bg-forest-950 p-4 text-white"><p className="text-xs font-semibold text-forest-100">Operação saudável</p><p className="mt-1 text-2xl font-bold">94,6%</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15"><div className="h-full w-[95%] rounded-full bg-coffee-400" /></div><p className="mt-2 text-[11px] text-white/60">Meta mensal consolidada</p></div>
    </aside>
    <div className="min-w-0">
      <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-white/90 px-4 backdrop-blur md:px-8"><div className="flex items-center gap-3 lg:hidden"><button aria-label="Abrir menu" className="rounded-lg p-2 hover:bg-stone-100"><Menu size={20} /></button><Logo compact /></div><div className="hidden w-full max-w-sm items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500 lg:flex"><Search size={17} /><input aria-label="Buscar" className="w-full bg-transparent text-sm outline-none" placeholder="Buscar no BBOS..." /></div><div className="flex items-center gap-3"><button aria-label="Notificações" className="relative rounded-xl border bg-white p-2.5 text-stone-600"><Bell size={18} /><span className="absolute right-2 top-2 size-1.5 rounded-full bg-red-500" /></button><div className="hidden h-8 w-px bg-stone-200 sm:block" /><div className="hidden items-center gap-2.5 sm:flex"><span className="grid size-9 place-items-center rounded-full bg-forest-100 text-xs font-bold text-forest-800">AB</span><div><p className="text-xs font-semibold">Alex Bispo</p><p className="text-[11px] text-stone-500">Administrador</p></div></div></div></header>
      <main className="p-4 md:p-8 xl:p-10">{children}</main>
    </div>
  </div>;
}
