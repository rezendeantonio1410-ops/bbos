"use client";

import Link from "next/link";
import { AlertCircle, ArrowRight, RefreshCw } from "lucide-react";
import { Button, Card } from "@bbos/ui";
import { useCallback, useEffect, useState } from "react";
import { LabEmptyState, LabStatusBadge, type LabQueueItem } from "@/components/laboratory-dashboard";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

type LaboratoryDashboardResponse = { queue: LabQueueItem[] };

export default function LabLotsPage() {
  const [items, setItems] = useState<LabQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/laboratory/dashboard`, { cache: "no-store" });
      if (!response.ok) throw new Error(`API respondeu com status ${response.status}`);
      const data = (await response.json()) as LaboratoryDashboardResponse;
      setItems(Array.isArray(data.queue) ? data.queue : []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar a fila do laboratório.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadQueue(); }, [loadQueue]);

  return <div className="mx-auto max-w-[1320px]">
    <Link href="/laboratorio" className="inline-flex min-h-11 items-center text-xs font-bold text-forest-700">← Laboratório</Link>
    <h1 className="mt-3 text-3xl font-bold">Amostras e lotes</h1>
    <p className="mt-2 text-sm text-stone-500">Fila de cafés aguardando avaliação sensorial.</p>

    {loading ? <Card className="mt-6 p-8" aria-live="polite"><div className="flex items-center justify-center gap-3 text-sm text-stone-500"><RefreshCw className="animate-spin" size={18}/>Carregando amostras...</div></Card> : error ? <Card className="mt-6 border-red-200 p-8 text-center"><AlertCircle className="mx-auto text-red-600" size={24}/><strong className="mt-3 block text-sm">Erro de comunicação com a API</strong><p className="mt-1 text-xs text-stone-500">{error}</p><Button className="mt-5" onClick={() => void loadQueue()}>Tentar novamente</Button></Card> : items.length === 0 ? <div className="mt-6"><LabEmptyState title="Nenhuma amostra aguardando prova." description="Novas amostras de entrada aparecerão aqui após o recebimento."/></div> : <Card className="mt-6 overflow-hidden">
      <div className="hidden overflow-x-auto lg:block"><div className="min-w-[1120px]"><div className="grid grid-cols-[110px_120px_1fr_1fr_1fr_110px_110px_110px_120px] gap-3 border-b bg-stone-50 px-5 py-3 text-[9px] font-bold uppercase tracking-wide text-stone-500"><span>Lote</span><span>Amostra</span><span>Café</span><span>Fornecedor</span><span>Origem</span><span>Entrada</span><span>Finalidade</span><span>Status</span><span>Ação</span></div>{items.map((sample) => <div key={sample.id} className="grid grid-cols-[110px_120px_1fr_1fr_1fr_110px_110px_110px_120px] items-center gap-3 border-b border-stone-100 px-5 py-4 text-xs last:border-0"><strong>{sample.lot.code}</strong><span>{sample.sampleCode}</span><span>{sample.lot.variety ?? "Café verde"}</span><span>{sample.lot.supplier.name}</span><span>{sample.lot.origin}</span><span>{new Date(sample.lot.receivedAt).toLocaleDateString("pt-BR")}</span><span>{sample.sampleType.replaceAll("_", " ")}</span><LabStatusBadge status={sample.status}/><Link href={`/laboratorio/sessoes/nova?sampleId=${sample.id}`} className="font-bold text-forest-700">Iniciar prova →</Link></div>)}</div></div>
      <div className="grid gap-4 p-4 lg:hidden">{items.map((sample) => <article key={sample.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{sample.lot.code}</p><strong className="mt-1 block text-sm">{sample.sampleCode}</strong></div><LabStatusBadge status={sample.status}/></div><dl className="mt-4 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-stone-400">Café</dt><dd className="mt-1 font-semibold">{sample.lot.variety ?? "Café verde"}</dd></div><div><dt className="text-stone-400">Fornecedor</dt><dd className="mt-1 font-semibold">{sample.lot.supplier.name}</dd></div><div><dt className="text-stone-400">Origem</dt><dd className="mt-1">{sample.lot.origin}</dd></div><div><dt className="text-stone-400">Entrada</dt><dd className="mt-1">{new Date(sample.lot.receivedAt).toLocaleDateString("pt-BR")}</dd></div><div><dt className="text-stone-400">Finalidade</dt><dd className="mt-1">{sample.sampleType.replaceAll("_", " ")}</dd></div></dl><Link href={`/laboratorio/sessoes/nova?sampleId=${sample.id}`} className="mt-4 inline-flex min-h-11 items-center gap-2 font-bold text-forest-700">Iniciar prova <ArrowRight size={14}/></Link></article>)}</div>
    </Card>}
  </div>;
}
