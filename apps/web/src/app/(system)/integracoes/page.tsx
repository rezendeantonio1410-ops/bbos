"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw, ShieldCheck, Webhook } from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Readiness = {
  provider: string;
  configured: boolean;
  missingEnvironment: string[];
  apiBaseUrl: string;
  resources: string[];
  connection: { status: string; providerAccountId?: string | null; connectedAt?: string | null; lastSyncAt?: string | null; lastError?: string | null };
  credentialsExposed: boolean;
};
type Summary = { documents: Array<{ direction: string; status: string; count: number }>; outbox: Array<{ status: string; count: number }>; webhooks: Array<{ status: string; count: number }> };

export default function IntegrationsPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      const root = getApiBaseUrl();
      const [r, s] = await Promise.all([
        fetch(`${root}/integrations/bling/readiness`, { credentials: "include", cache: "no-store" }),
        fetch(`${root}/integrations/fiscal/summary`, { credentials: "include", cache: "no-store" }),
      ]);
      if (!r.ok || !s.ok) throw new Error("Não foi possível consultar a integração.");
      setReadiness(await r.json()); setSummary(await s.json());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha na integração."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);

  const fiscalTotal = useMemo(() => summary?.documents.reduce((sum, item) => sum + Number(item.count), 0) ?? 0, [summary]);
  const pending = useMemo(() => summary?.outbox.filter((item) => item.status !== "DONE").reduce((sum, item) => sum + Number(item.count), 0) ?? 0, [summary]);
  const connected = readiness?.connection.status === "CONNECTED";

  return <div className="space-y-6">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#6D4FA3]">Gestão · Integrações</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Integrações e fiscal</h1><p className="mt-2 max-w-2xl text-sm text-stone-500">O BBOS mantém a operação como fonte da verdade e acompanha os conectores externos sem expor credenciais.</p></div><button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"><RefreshCw size={14}/>Atualizar</button></header>

    {error && <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between gap-4"><div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700"><PlugZap size={20}/></span><div><p className="text-sm font-bold">Bling ERP / Fiscal</p><p className="mt-1 text-xs text-stone-400">Produtos, contatos, pedidos, estoque e NF-e</p></div></div><span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>{loading ? "Verificando" : connected ? "Conectado" : "Desconectado"}</span></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3"><Metric label="Documentos fiscais" value={String(fiscalTotal)}/><Metric label="Fila pendente" value={String(pending)}/><Metric label="Último sync" value={readiness?.connection.lastSyncAt ? new Date(readiness.connection.lastSyncAt).toLocaleString("pt-BR") : "—"}/></div>
        <div className="mt-5 rounded-2xl bg-stone-50 p-4"><p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-stone-400">Readiness</p>{readiness?.configured ? <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700"><CheckCircle2 size={16}/>Ambiente preparado para autenticação.</div> : <div className="mt-3"><div className="flex items-center gap-2 text-sm font-semibold text-amber-700"><AlertTriangle size={16}/>Configuração ainda incompleta.</div><p className="mt-2 text-xs leading-5 text-stone-500">Variáveis ausentes: {(readiness?.missingEnvironment ?? []).join(", ") || "—"}</p></div>}<div className="mt-3 flex items-center gap-2 text-[10px] text-stone-400"><ShieldCheck size={13}/>Segredos nunca são expostos nesta tela.</div></div>
      </div>

      <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-700"><Webhook size={18}/></span><div><p className="text-sm font-bold">Eventos e retorno</p><p className="mt-1 text-xs text-stone-400">Fila idempotente e webhooks persistidos</p></div></div><div className="mt-5 space-y-3"><Rows title="Documentos" rows={summary?.documents}/><Rows title="Fila" rows={summary?.outbox}/><Rows title="Webhooks" rows={summary?.webhooks}/></div></div>
    </section>

    <section className="rounded-[24px] border border-[#087568]/10 bg-[#F3FAF7] p-5"><p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#087568]">Próxima ação segura</p><p className="mt-2 text-base font-bold text-stone-900">{connected ? "Validar um ciclo controlado de NF-e em homologação." : "Conectar a conta Bling e validar OAuth antes de qualquer emissão real."}</p><p className="mt-1 text-sm leading-6 text-stone-500">O fluxo alvo é: pedido faturado → documento fiscal pronto → Bling → autorização → chave/XML/status → BBOS → expedição.</p></section>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-stone-100 p-3"><p className="text-[10px] text-stone-400">{label}</p><p className="mt-1 text-lg font-bold text-stone-900">{value}</p></div>; }
function Rows({ title, rows }: { title: string; rows?: Array<{ status?: string; direction?: string; count: number }> }) { return <div><p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">{title}</p><div className="mt-2 flex flex-wrap gap-2">{rows?.length ? rows.map((item, index) => <span key={`${item.direction ?? item.status}-${index}`} className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10px] font-semibold text-stone-600">{item.direction ?? item.status}: {item.count}</span>) : <span className="text-xs text-stone-400">Nenhum evento registrado.</span>}</div></div>; }
