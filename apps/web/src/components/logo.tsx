import { Coffee } from 'lucide-react';

export function Logo({ compact = false }: { compact?: boolean }) {
  return <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl bg-forest-900 text-white"><Coffee size={20} strokeWidth={1.8} /></span>{!compact && <div><p className="font-[var(--font-manrope)] text-lg font-bold tracking-tight text-forest-950">BBOS</p><p className="text-[10px] font-semibold uppercase tracking-[.19em] text-stone-500">Bispo Coffees</p></div>}</div>;
}
