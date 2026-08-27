import { SYSTEM_CREATOR, SYSTEM_CREATOR_CREDIT_PT, SYSTEM_NAME } from '@bbos/shared';

export default function AboutPage() {
  return <div className="mx-auto max-w-3xl">
    <p className="text-xs font-bold uppercase tracking-[.16em] text-forest-700">Sobre o BBOS</p>
    <h1 className="mt-3 text-3xl font-bold text-forest-950">{SYSTEM_NAME}</h1>
    <p className="mt-4 max-w-2xl text-base leading-7 text-stone-600">O sistema operacional de negócios da Bispo Coffees, criado para conectar decisões, operação e inteligência em uma visão clara.</p>
    <section className="mt-8 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm"><p className="text-xs font-bold uppercase tracking-[.14em] text-stone-400">Crédito institucional</p><p className="mt-2 text-sm text-stone-700">{SYSTEM_CREATOR_CREDIT_PT}</p><p className="mt-1 text-xs text-stone-500">Creator: {SYSTEM_CREATOR}</p></section>
  </div>;
}
