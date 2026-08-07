import { notFound } from 'next/navigation';
import { Activity, ArrowRight, Boxes, CircleDollarSign, ClipboardCheck, Factory, FlaskConical, PackageCheck, PackageOpen, ShoppingBag, Warehouse } from 'lucide-react';
import { Badge, Card } from '@bbos/ui';

const modules = {
  industrial: { title: 'Dashboard Industrial', description: 'Eficiência, rendimento e capacidade da operação.', icon: Activity, stats: ['84,5% rendimento', '3 ordens ativas', '1.240 kg hoje'] },
  recebimento: { title: 'Recebimento', description: 'Entrada e conferência de café verde.', icon: PackageOpen, stats: ['2 cargas previstas', '7.800 kg', '1 pendência'] },
  laboratorio: { title: 'Laboratório', description: 'Análises, provas e liberação de lotes.', icon: FlaskConical, stats: ['4 análises abertas', '85,6 nota média', '2 pendências'] },
  estoque: { title: 'Estoque', description: 'Posição e movimentação de matérias-primas e produtos.', icon: Warehouse, stats: ['42.180 kg verde', '8.640 pacotes', '52 dias cobertura'] },
  producao: { title: 'Produção', description: 'Planejamento e execução das ordens industriais.', icon: Factory, stats: ['3 ordens ativas', '18.420 kg/mês', '84,5% rendimento'] },
  blends: { title: 'Blends', description: 'Composições, versões e custos de blends.', icon: Boxes, stats: ['8 blends ativos', '3 em revisão', 'R$ 29,42/kg médio'] },
  produtos: { title: 'Produtos', description: 'Portfólio e estrutura de produto acabado.', icon: PackageCheck, stats: ['24 SKUs ativos', '18,8% margem', '2 lançamentos'] },
  pedidos: { title: 'Pedidos', description: 'Carteira comercial e atendimento.', icon: ShoppingBag, stats: ['164 no mês', '92% no prazo', 'R$ 486 mil'] },
  financeiro: { title: 'Financeiro', description: 'Resultado, custos e fluxo financeiro industrial.', icon: CircleDollarSign, stats: ['R$ 728 mil caixa', 'R$ 91 mil resultado', '18,8% margem'] },
} as const;

export default async function ModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module: slug } = await params;
  const item = modules[slug as keyof typeof modules];
  if (!item) notFound();
  const Icon = item.icon;
  return <div className="mx-auto max-w-[1480px]"><div className="flex items-center gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-forest-900 text-white"><Icon size={22} /></span><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-forest-700">Operação Industrial</p><h1 className="mt-1 font-[var(--font-manrope)] text-3xl font-bold tracking-tight">{item.title}</h1></div></div><p className="mt-4 max-w-2xl text-sm text-stone-500">{item.description}</p><div className="mt-8 grid gap-4 md:grid-cols-3">{item.stats.map(stat => <Card key={stat} className="p-6"><p className="text-2xl font-bold tracking-tight">{stat}</p><p className="mt-2 text-xs text-stone-500">Indicador demonstrativo</p></Card>)}</div><Card className="mt-6 min-h-80 p-7"><div className="flex items-center justify-between"><div><h2 className="font-[var(--font-manrope)] text-lg font-bold">Visão geral</h2><p className="mt-1 text-sm text-stone-500">Fundação pronta para receber os fluxos operacionais desta área.</p></div><Badge tone="success">Fundação ativa</Badge></div><div className="mt-12 grid place-items-center rounded-2xl border border-dashed bg-stone-50 py-16 text-center"><ClipboardCheck size={34} strokeWidth={1.4} className="text-forest-700" /><p className="mt-4 text-sm font-semibold">Módulo preparado para evolução</p><button className="mt-3 flex items-center gap-1 text-xs font-semibold text-forest-700">Explorar estrutura <ArrowRight size={14} /></button></div></Card></div>;
}
