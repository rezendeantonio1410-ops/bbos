'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardCheck,
  FlaskConical,
  MapPin,
  PackageOpen,
  Plus,
  Scale,
  ShieldAlert,
  Truck,
  Warehouse,
  X,
} from 'lucide-react';
import { Badge, Button, Card } from '@bbos/ui';
import type { LabAnalysis, LotCostBreakdown, ReceiptAlert, ReceiptApproval, ReceiptLot, ReceiptStatus } from '@bbos/shared';
import { receiptDemoDashboard } from '@/lib/receipt-demo-data';

const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
const steps = ['Fornecedor', 'Café/Carga', 'Peso', 'Custos', 'Controles de entrada', 'Aprovação', 'Estoque'];
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';
const statusLabels: Record<ReceiptStatus, { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }> = {
  'awaiting-lab': { label: 'Aguardando laboratório', tone: 'neutral' }, approved: { label: 'Aprovado', tone: 'success' }, attention: { label: 'Atenção', tone: 'warning' }, blocked: { label: 'Bloqueado', tone: 'danger' },
};
const approvalStyles: Record<ReceiptApproval, { label: string; className: string }> = {
  approved: { label: 'APROVADO', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }, attention: { label: 'ATENÇÃO', className: 'border-amber-200 bg-amber-50 text-amber-700' }, rejected: { label: 'REPROVADO', className: 'border-red-200 bg-red-50 text-red-700' },
};

type ReceiptDraft = {
  supplierId: string; warehouseId: string; origin: string; variety: string; harvest: string; invoice: string; weightKg: number; costs: LotCostBreakdown; lab: Omit<LabAnalysis, 'approval' | 'scaScore'>;
};

type ReceiptOptions = { companyId: string; suppliers: Array<{ id: string; name: string }>; warehouses: Array<{ id: string; code: string; name: string }> };
type ReceiptApiResult = { lotId: string; code: string; receivedAt: string; totalCost: number; realCostPerKg: number; status: 'QUALITY_REVIEW' | 'APPROVED' | 'BLOCKED'; labSampleId: string | null };

const initialDraft: ReceiptDraft = {
  supplierId: '', warehouseId: '', origin: 'Carmo de Minas, MG', variety: 'Catuaí Amarelo', harvest: '2026/27', invoice: '', weightKg: 1200,
  costs: { coffeeValue: 33600, freight: 1600, nonRecoverableTaxes: 0, unloading: 240, initialProcessing: 420, otherDirectCosts: 0 },
  lab: { moisturePercent: 11.5, waterActivity: 0.58, densityGPerL: 710, screen: '16 acima', defects: 6 },
};

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="text-xs font-semibold text-stone-700">{label}</span><div className="mt-2">{children}</div>{hint && <span className="mt-1 block text-[11px] text-stone-400">{hint}</span>}</label>;
}
const inputClass = 'w-full rounded-xl border bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-forest-700 focus:bg-white';

function Wizard({ options, onClose, onComplete }: { options: ReceiptOptions; onClose: () => void; onComplete: (draft: ReceiptDraft, approval: ReceiptApproval) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<ReceiptDraft>(() => ({ ...initialDraft, supplierId: options.suppliers[0]?.id ?? '', warehouseId: options.warehouses[0]?.id ?? '' }));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const totalCost = Object.values(draft.costs).reduce((sum, value) => sum + value, 0);
  const costPerKg = draft.weightKg > 0 ? totalCost / draft.weightKg : 0;
  const approval: ReceiptApproval = draft.lab.moisturePercent > 12.3 || draft.lab.waterActivity > 0.65 ? 'rejected' : draft.lab.moisturePercent > 12 || draft.lab.waterActivity > 0.62 ? 'attention' : 'approved';
  const updateCost = (key: keyof LotCostBreakdown, value: number) => setDraft(current => ({ ...current, costs: { ...current.costs, [key]: value } }));
  const updateLab = (key: keyof ReceiptDraft['lab'], value: string | number) => setDraft(current => ({ ...current, lab: { ...current.lab, [key]: value } }));
  const complete = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try { await onComplete(draft, approval); }
    catch (cause) { setSubmitError(cause instanceof Error ? cause.message : 'Não foi possível concluir o recebimento.'); }
    finally { setSubmitting(false); }
  };
  return <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-4 backdrop-blur-[2px]"><div role="dialog" aria-modal="true" className="flex max-h-[94vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b px-6 py-5"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-forest-700">Novo recebimento</p><h2 className="mt-1 text-xl font-bold">{steps[step]}</h2></div><button onClick={onClose} aria-label="Fechar" className="rounded-xl border p-2 text-stone-500"><X size={18} /></button></header><div className="border-b px-6 py-4"><div className="flex items-center gap-1">{steps.map((item, index) => <div key={item} className="min-w-0 flex-1"><div className={`h-1.5 rounded-full ${index <= step ? 'bg-forest-800' : 'bg-stone-100'}`} /><p className={`mt-2 hidden truncate text-[10px] sm:block ${index === step ? 'font-bold text-forest-800' : 'text-stone-400'}`}>{index + 1}. {item}</p></div>)}</div></div><div className="overflow-y-auto p-6 md:p-8"><div className="mx-auto max-w-2xl">
    {step === 0 && <div><p className="mb-6 text-sm text-stone-500">Identifique a origem comercial desta carga.</p><div className="grid gap-5 sm:grid-cols-2"><Field label="Fornecedor"><select value={draft.supplierId} onChange={event => setDraft({ ...draft, supplierId: event.target.value })} className={inputClass}>{options.suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></Field><Field label="Documento fiscal"><input value={draft.invoice} onChange={event => setDraft({ ...draft, invoice: event.target.value })} placeholder="NF-e ou referência" className={inputClass} /></Field></div></div>}
    {step === 1 && <div><p className="mb-6 text-sm text-stone-500">Registre somente os dados essenciais da carga.</p><div className="grid gap-5 sm:grid-cols-2"><Field label="Origem"><input value={draft.origin} onChange={event => setDraft({ ...draft, origin: event.target.value })} className={inputClass} /></Field><Field label="Variedade"><input value={draft.variety} onChange={event => setDraft({ ...draft, variety: event.target.value })} className={inputClass} /></Field><Field label="Safra"><input value={draft.harvest} onChange={event => setDraft({ ...draft, harvest: event.target.value })} className={inputClass} /></Field></div></div>}
    {step === 2 && <div><p className="mb-6 text-sm text-stone-500">Informe o peso líquido conferido na balança.</p><div className="max-w-sm"><Field label="Peso líquido (kg)" hint="O custo real/kg será recalculado automaticamente."><input type="number" min="1" value={draft.weightKg} onChange={event => setDraft({ ...draft, weightKg: Number(event.target.value) })} className={inputClass} /></Field></div></div>}
    {step === 3 && <div><p className="mb-6 text-sm text-stone-500">Separe cada componente para preservar o custo real e a rastreabilidade.</p><div className="grid gap-4 sm:grid-cols-2">{([['coffeeValue', 'Valor do café'], ['freight', 'Frete'], ['nonRecoverableTaxes', 'Impostos não recuperáveis'], ['unloading', 'Descarga'], ['initialProcessing', 'Beneficiamento inicial'], ['otherDirectCosts', 'Outros custos diretos']] as const).map(([key, label]) => <Field key={key} label={label}><input type="number" min="0" value={draft.costs[key]} onChange={event => updateCost(key, Number(event.target.value))} className={inputClass} /></Field>)}</div><div className="mt-6 grid gap-3 rounded-2xl bg-forest-950 p-5 text-white sm:grid-cols-2"><div><p className="text-[11px] uppercase tracking-wider text-white/50">Custo real do lote</p><p className="mt-2 text-2xl font-bold">{currency.format(totalCost)}</p></div><div><p className="text-[11px] uppercase tracking-wider text-white/50">Custo real/kg</p><p className="mt-2 text-2xl font-bold">{currency.format(costPerKg)}</p></div></div></div>}
    {step === 4 && <div><div className="flex items-start justify-between gap-4"><p className="text-sm text-stone-500">Controles físicos da entrada. A avaliação sensorial oficial será realizada no Laboratório/Cupping.</p><Badge tone="neutral">QL-UMI-01 • QL-AW-01</Badge></div><div className="mt-6 grid gap-5 sm:grid-cols-3"><Field label="Umidade (%)" hint="Limite configurado: 12,0%"><input type="number" step="0.1" value={draft.lab.moisturePercent} onChange={event => updateLab('moisturePercent', Number(event.target.value))} className={inputClass} /></Field><Field label="Aw" hint="Limite configurado: 0,65"><input type="number" step="0.01" value={draft.lab.waterActivity} onChange={event => updateLab('waterActivity', Number(event.target.value))} className={inputClass} /></Field><Field label="Densidade (g/L)"><input type="number" value={draft.lab.densityGPerL} onChange={event => updateLab('densityGPerL', Number(event.target.value))} className={inputClass} /></Field><Field label="Peneira"><input value={draft.lab.screen} onChange={event => updateLab('screen', event.target.value)} className={inputClass} /></Field><Field label="Defeitos"><input type="number" value={draft.lab.defects} onChange={event => updateLab('defects', Number(event.target.value))} className={inputClass} /></Field></div></div>}
    {step === 5 && <div className="text-center"><span className={`inline-flex rounded-2xl border px-8 py-5 text-2xl font-black tracking-wide ${approvalStyles[approval].className}`}>{approvalStyles[approval].label}</span><p className="mx-auto mt-6 max-w-md text-sm leading-6 text-stone-500">Status calculado pelas regras configuradas. A decisão será registrada com os resultados laboratoriais e a identificação do responsável.</p>{approval !== 'approved' && <div className="mx-auto mt-5 max-w-md rounded-xl bg-amber-50 p-4 text-left text-xs leading-5 text-amber-800"><strong>Ação necessária:</strong> manter em quarentena e solicitar decisão do responsável técnico. Nenhuma recomendação de tratamento é aplicada automaticamente.</div>}</div>}
    {step === 6 && <div><p className="mb-6 text-sm text-stone-500">Defina o armazém inicial. Ao concluir, os eventos de estoque e custo serão registrados juntos.</p><Field label="Armazém"><select value={draft.warehouseId} onChange={event => setDraft({ ...draft, warehouseId: event.target.value })} className={inputClass}>{options.warehouses.map((warehouse) => <option key={warehouse.id} value={warehouse.id}>{warehouse.code} • {warehouse.name}</option>)}</select></Field><div className="mt-6 rounded-2xl bg-stone-50 p-5"><p className="text-sm font-bold">Registros gerados na conclusão</p><div className="mt-4 grid gap-3 text-xs text-stone-600 sm:grid-cols-2">{['Lote e código único', 'Entrada no estoque', 'IndustrialEvent de recebimento', 'CostEvents por componente', `Custo real: ${currency.format(costPerKg)}/kg`, 'Amostra para qualidade quando aplicável'].map(item => <span key={item} className="flex items-center gap-2"><Check size={14} className="text-emerald-700" />{item}</span>)}</div></div>{submitError && <p className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{submitError}</p>}</div>}
  </div></div><footer className="flex items-center justify-between border-t px-6 py-4"><button disabled={step === 0 || submitting} onClick={() => setStep(value => value - 1)} className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-stone-600 disabled:opacity-30"><ArrowLeft size={16} />Voltar</button>{step < steps.length - 1 ? <Button onClick={() => setStep(value => value + 1)} className="flex items-center gap-2">Continuar <ArrowRight size={16} /></Button> : <Button disabled={submitting || !draft.supplierId || !draft.warehouseId} onClick={() => void complete()} className="flex items-center gap-2"><Check size={16} />{submitting ? 'Salvando...' : 'Concluir recebimento'}</Button>}</footer></div></div>;
}

function LotDrawer({ lot, onClose }: { lot: ReceiptLot; onClose: () => void }) {
  const status = statusLabels[lot.status];
  return <div className="fixed inset-0 z-50 flex justify-end"><button className="absolute inset-0 bg-forest-950/25 backdrop-blur-[2px]" aria-label="Fechar" onClick={onClose} /><aside className="relative h-full w-full max-w-xl overflow-y-auto border-l bg-white shadow-2xl"><header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white/95 p-6 backdrop-blur"><div><p className="text-xs font-bold uppercase tracking-[.15em] text-forest-700">Lote de café verde</p><h2 className="mt-1 text-xl font-bold">{lot.code}</h2></div><button onClick={onClose} className="rounded-xl border p-2 text-stone-500"><X size={18} /></button></header><div className="space-y-7 p-6"><div className="flex items-center justify-between rounded-2xl bg-stone-50 p-4"><div><p className="text-sm font-bold">{lot.supplier}</p><p className="mt-1 text-xs text-stone-500">{lot.origin}</p></div><Badge tone={status.tone}>{status.label}</Badge></div><section><h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Origem</h3><div className="mt-3 grid grid-cols-2 gap-3"><Info label="Fornecedor" value={lot.supplier} /><Info label="Origem" value={lot.origin} /><Info label="Recebido em" value={lot.receivedAt} /><Info label="Quantidade" value={`${integer.format(lot.quantityKg)} kg`} /></div></section><section><h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Qualidade</h3><div className="mt-3 grid grid-cols-3 gap-3"><Info label="Umidade" value={lot.lab ? `${lot.lab.moisturePercent}%` : 'Pendente'} /><Info label="Aw" value={lot.lab?.waterActivity.toString() ?? 'Pendente'} /><Info label="SCA" value={lot.scaScore?.toLocaleString('pt-BR') ?? 'Pendente'} /><Info label="Densidade" value={lot.lab ? `${lot.lab.densityGPerL} g/L` : '—'} /><Info label="Peneira" value={lot.lab?.screen ?? '—'} /><Info label="Defeitos" value={lot.lab?.defects.toString() ?? '—'} /></div></section><section><h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Custos</h3><div className="mt-3 rounded-2xl bg-forest-950 p-5 text-white"><div className="flex justify-between"><div><p className="text-xs text-white/50">Custo real do lote</p><p className="mt-1 text-xl font-bold">{currency.format(lot.totalCost)}</p></div><div className="text-right"><p className="text-xs text-white/50">Custo real/kg</p><p className="mt-1 text-xl font-bold">{currency.format(lot.realCostPerKg)}</p></div></div></div></section><section><h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Estoque</h3><div className="mt-3 flex items-center gap-3 rounded-xl border p-4"><MapPin size={18} className="text-forest-700" /><div><p className="text-sm font-semibold">{lot.location}</p><p className="mt-1 text-xs text-stone-400">Posição atual do lote</p></div></div></section><section><h3 className="text-xs font-bold uppercase tracking-wider text-stone-400">Rastreabilidade</h3><div className="mt-4 space-y-0">{lot.traceability.map((event, index) => <div key={event.id} className="flex gap-3"><div className="flex flex-col items-center"><span className={`grid size-7 place-items-center rounded-full ${event.status === 'complete' ? 'bg-emerald-100 text-emerald-700' : event.status === 'current' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'}`}>{event.status === 'complete' ? <Check size={13} /> : <span className="size-1.5 rounded-full bg-current" />}</span>{index < lot.traceability.length - 1 && <span className="h-8 w-px bg-stone-200" />}</div><div><p className={`text-sm font-semibold ${event.status === 'future' ? 'text-stone-400' : ''}`}>{event.label}</p><p className="mt-0.5 text-[11px] text-stone-400">{event.occurredAt}</p></div></div>)}</div></section></div></aside></div>;
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-stone-50 p-3"><p className="text-[10px] uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-xs font-semibold">{value}</p></div>; }

function LotGrid({ lots, onSelect }: { lots: ReceiptLot[]; onSelect: (lot: ReceiptLot) => void }) {
  return <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{lots.map(lot => { const status = statusLabels[lot.status]; return <button key={lot.id} onClick={() => onSelect(lot)} className="text-left"><Card className="h-full p-5 transition hover:-translate-y-0.5 hover:shadow-lg"><div className="flex items-center justify-between"><p className="font-bold">{lot.code}</p><Badge tone={status.tone}>{status.label}</Badge></div><p className="mt-3 text-sm font-semibold text-stone-700">{lot.supplier}</p><p className="mt-1 text-xs text-stone-400">{lot.origin}</p><div className="mt-5 grid grid-cols-3 gap-3 border-t pt-4"><Info label="Quantidade" value={`${integer.format(lot.quantityKg)} kg`} /><Info label="Custo/kg" value={currency.format(lot.realCostPerKg)} /><Info label="SCA" value={lot.scaScore?.toLocaleString('pt-BR') ?? 'Pendente'} /></div><div className="mt-4 flex items-center justify-between text-xs"><span className="flex items-center gap-1 text-stone-500"><Warehouse size={13} />{lot.location}</span><ChevronRight size={14} className="text-stone-300" /></div></Card></button>; })}</div>;
}

function AlertDrawer({ alert, lot, onClose }: { alert: ReceiptAlert; lot?: ReceiptLot; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex justify-end"><button aria-label="Fechar" className="absolute inset-0 bg-forest-950/25" onClick={onClose} /><aside className="relative h-full w-full max-w-lg overflow-y-auto border-l bg-white p-6 shadow-2xl"><div className="flex justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-red-700">Alerta operacional</p><h2 className="mt-2 text-xl font-bold">{alert.alert}</h2></div><button onClick={onClose} className="rounded-xl border p-2"><X size={18} /></button></div><div className="mt-7 space-y-4">{[['Dado', alert.datum], ['Alerta', `${lot?.code ?? 'Lote'} • ${alert.alert}`], ['Diagnóstico', alert.diagnosis], ['Impacto', alert.impact], ['Ação', alert.action], ['Resultado esperado', 'Decisão registrada, lote corretamente segregado e indicadores atualizados.']].map(([label, value], index) => <div key={label} className="flex gap-3"><span className={`grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold ${index < 4 ? 'bg-red-50 text-red-700' : 'bg-forest-50 text-forest-700'}`}>{index + 1}</span><div><p className="text-xs font-bold uppercase tracking-wider text-stone-400">{label}</p><p className="mt-1 text-sm leading-6 text-stone-600">{value}</p></div></div>)}</div>{alert.ruleReference && <p className="mt-6 rounded-xl bg-stone-50 p-4 text-xs text-stone-500">{alert.ruleReference}</p>}<Button className="mt-6 w-full">Registrar decisão operacional</Button></aside></div>;
}

export default function ReceiptPage() {
  const [realLots, setRealLots] = useState<ReceiptLot[]>([]);
  const lots = useMemo(() => [...realLots, ...receiptDemoDashboard.lots], [realLots]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [options, setOptions] = useState<ReceiptOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedLot, setSelectedLot] = useState<ReceiptLot | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<ReceiptAlert | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const summary = useMemo(() => ({ ...receiptDemoDashboard.summary, receiptsToday: receiptDemoDashboard.summary.receiptsToday + realLots.length, receivedKgToday: receiptDemoDashboard.summary.receivedKgToday + realLots.reduce((sum, lot) => sum + lot.quantityKg, 0), receivedValueToday: receiptDemoDashboard.summary.receivedValueToday + realLots.reduce((sum, lot) => sum + lot.totalCost, 0) }), [realLots]);

  useEffect(() => {
    if (!wizardOpen || options) return;
    setOptionsError(null);
    fetch(`${API_URL}/receipts/options`, { cache: 'no-store' })
      .then(async (response) => { if (!response.ok) throw new Error(`API respondeu com status ${response.status}`); return response.json() as Promise<ReceiptOptions>; })
      .then(setOptions)
      .catch((cause) => setOptionsError(cause instanceof Error ? cause.message : 'Não foi possível carregar fornecedores e armazéns.'));
  }, [wizardOpen, options]);

  const complete = async (draft: ReceiptDraft, approval: ReceiptApproval) => {
    if (!options) throw new Error('As opções reais do recebimento ainda não foram carregadas.');
    const response = await fetch(`${API_URL}/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: options.companyId, supplierId: draft.supplierId, warehouseId: draft.warehouseId, origin: draft.origin, harvest: draft.harvest, variety: draft.variety, weightKg: draft.weightKg, costs: draft.costs, lab: { ...draft.lab, approval } }),
    });
    const payload = await response.json().catch(() => null) as (ReceiptApiResult & { message?: string }) | null;
    if (!response.ok || !payload) throw new Error(payload?.message ?? `API respondeu com status ${response.status}`);
    const supplier = options.suppliers.find((item) => item.id === draft.supplierId);
    const warehouse = options.warehouses.find((item) => item.id === draft.warehouseId);
    const status: ReceiptStatus = payload.status === 'APPROVED' ? 'approved' : payload.status === 'BLOCKED' ? 'blocked' : 'awaiting-lab';
    const lot: ReceiptLot = { id: payload.lotId, code: payload.code, supplier: supplier?.name ?? 'Fornecedor', origin: draft.origin, quantityKg: draft.weightKg, totalCost: payload.totalCost, realCostPerKg: payload.realCostPerKg, location: warehouse ? `${warehouse.code} • ${warehouse.name}` : 'Armazém', status, receivedAt: new Date(payload.receivedAt).toLocaleString('pt-BR'), costs: draft.costs, lab: { ...draft.lab, approval }, traceability: [{ id: `${payload.lotId}-receipt`, label: 'Recebimento', occurredAt: 'Agora', status: 'complete' }, ...(payload.labSampleId ? [{ id: `${payload.lotId}-lab`, label: 'Laboratório', occurredAt: 'Aguardando prova', status: 'current' as const }] : [])] };
    setRealLots(current => [lot, ...current]);
    setWizardOpen(false);
    setResult(`${payload.code} criado • estoque, IndustrialEvent e CostEvents registrados${payload.labSampleId ? ' • Amostra enviada ao Laboratório.' : ''}`);
  };
  const summaries = [{ label: 'Recebimentos hoje', value: summary.receiptsToday.toString(), icon: Truck }, { label: 'Kg recebidos hoje', value: `${integer.format(summary.receivedKgToday)} kg`, icon: Scale }, { label: 'Valor recebido', value: currency.format(summary.receivedValueToday), icon: CircleDollarSign }, { label: 'Custo médio/kg', value: currency.format(summary.averageCostPerKg), icon: ClipboardCheck }, { label: 'Aguardando laboratório', value: summary.awaitingLab.toString(), icon: FlaskConical }, { label: 'Lotes bloqueados', value: summary.blockedLots.toString(), icon: ShieldAlert }];
  return <div className="mx-auto max-w-[1480px]"><div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-forest-700"><PackageOpen size={14} />Operação Industrial</div><h1 className="font-[var(--font-manrope)] text-3xl font-bold tracking-tight">Recebimento</h1><p className="mt-2 text-sm text-stone-500">Cargas, custos, qualidade e entrada em estoque</p></div><Button onClick={() => setWizardOpen(true)} className="flex items-center justify-center gap-2 px-5 py-3"><Plus size={17} />Novo Recebimento</Button></div>{result && <div className="mt-6 flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span className="flex items-center gap-2"><Check size={16} />{result}</span><button onClick={() => setResult(null)}><X size={15} /></button></div>}<section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{summaries.map(({ label, value, icon: Icon }, index) => <Card key={label} className="p-5"><div className="flex items-center justify-between"><p className="text-xs font-medium text-stone-500">{label}</p><Icon size={16} className={index === 5 ? 'text-red-600' : 'text-forest-700'} /></div><p className="mt-4 text-xl font-bold tracking-tight">{value}</p></Card>)}</section>
    <section className="mt-8"><div className="flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-red-700">Requer atenção</p><h2 className="mt-1 text-lg font-bold">Alertas com diagnóstico</h2></div><Badge tone="danger">{receiptDemoDashboard.alerts.length} alertas</Badge></div><div className="mt-4 grid gap-4 lg:grid-cols-2">{receiptDemoDashboard.alerts.map(alert => { const lot = lots.find(item => item.id === alert.lotId); return <Card key={alert.id} className={`p-5 ${alert.status === 'off-track' ? 'border-red-200' : 'border-amber-200'}`}><div className="flex gap-3"><span className={`grid size-9 shrink-0 place-items-center rounded-xl ${alert.status === 'off-track' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}><AlertTriangle size={17} /></span><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><p className="text-sm font-bold">{alert.alert}</p><Badge tone={alert.status === 'off-track' ? 'danger' : 'warning'}>{lot?.code}</Badge></div><p className="mt-2 text-xs leading-5 text-stone-500">{alert.datum} • {alert.impact}</p><button onClick={() => setSelectedAlert(alert)} className="mt-3 flex items-center gap-1 text-xs font-bold text-forest-700">Ver detalhes e agir <ChevronRight size={13} /></button></div></div></Card>; })}</div></section>
    {realLots.length > 0 && <section className="mt-8"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-emerald-700">Persistidos pela API</p><h2 className="mt-1 text-lg font-bold">Recebimentos reais desta sessão</h2></div><LotGrid lots={realLots} onSelect={setSelectedLot}/></section>}
    <section className="mt-8"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-stone-500">Dados demonstrativos</p><h2 className="mt-1 text-lg font-bold">Histórico DEMO</h2><p className="mt-1 text-xs text-stone-400">Registros de referência visual; não representam novas gravações no banco.</p></div><LotGrid lots={receiptDemoDashboard.lots} onSelect={setSelectedLot}/></section>
    {wizardOpen && options && <Wizard options={options} onClose={() => setWizardOpen(false)} onComplete={complete} />}{wizardOpen && !options && <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-4"><Card className="w-full max-w-md p-7 text-center">{optionsError ? <><AlertTriangle className="mx-auto text-red-600"/><strong className="mt-3 block">Não foi possível iniciar o recebimento</strong><p className="mt-2 text-sm text-stone-500">{optionsError}</p><div className="mt-5 flex justify-center gap-3"><Button onClick={() => setWizardOpen(false)}>Fechar</Button><Button onClick={() => { setOptionsError(null); setWizardOpen(false); setTimeout(() => setWizardOpen(true), 0); }}>Tentar novamente</Button></div></> : <p className="text-sm text-stone-500">Carregando fornecedores e armazéns...</p>}</Card></div>}{selectedLot && <LotDrawer lot={selectedLot} onClose={() => setSelectedLot(null)} />}{selectedAlert && <AlertDrawer alert={selectedAlert} lot={lots.find(item => item.id === selectedAlert.lotId)} onClose={() => setSelectedAlert(null)} />}
  </div>;
}
