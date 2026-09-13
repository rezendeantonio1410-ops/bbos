"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, FlaskConical, PackageOpen, RefreshCw, ShoppingBag, Warehouse } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";
import { OperationalRecordHeader, type OperationalStage } from "@/components/operational-record-header";

const API = getApiBaseUrl();
type Purchase = { approvalStatus: string; externalAcceptanceStatus: string; operationalStatus: string; balanceKg: number };
type ReceiptOptions = { purchases?: Purchase[] };
type StockSummary = { activeLots?: number; attentionLots?: number; blockedLots?: number };
const INITIAL_COUNTS = { purchases: 0, delivery: 0, receipts: 0, stock: 0, attention: 0, blocked: 0 };

async function getJson<T>(url: string, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, { credentials: "include", cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json() as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolve) => setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }
  throw lastError;
}

export default function GreenCoffeeHome() {
  const [counts, setCounts] = React.useState(INITIAL_COUNTS);
  const [loading, setLoading] = React.useState(true);
  const [warning, setWarning] = React.useState("");
  const [refreshing, setRefreshing] = React.useState(false);
  const [session, setSession] = React.useState<SessionIdentity | null>(null);
  const [referenceMessage, setReferenceMessage] = React.useState("");
  const [initializingReferences, setInitializingReferences] = React.useState(false);

  const loadData = React.useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    const results = await Promise.allSettled([
      getJson<Purchase[]>(`${API}/green-coffee-purchases`),
      getJson<ReceiptOptions>(`${API}/receipts/options`),
      getJson<unknown[]>(`${API}/receipts`),
      getJson<StockSummary>(`${API}/inventory/summary`),
      fetchSessionIdentity(API),
    ]);
    const [purchasesResult, optionsResult, receiptsResult, stockResult, sessionResult] = results;
    if (sessionResult.status === "fulfilled") setSession(sessionResult.value);
    const purchases = purchasesResult.status === "fulfilled" ? purchasesResult.value : null;
    const options = optionsResult.status === "fulfilled" ? optionsResult.value : null;
    const receipts = receiptsResult.status === "fulfilled" ? receiptsResult.value : null;
    const stock = stockResult.status === "fulfilled" ? stockResult.value : null;
    setCounts((current) => ({
      purchases: purchases?.length ?? current.purchases,
      delivery: options?.purchases?.filter((purchase) => purchase.approvalStatus === "APPROVED" && purchase.externalAcceptanceStatus === "ACCEPTED" && purchase.operationalStatus === "AWAITING_DELIVERY" && purchase.balanceKg > 0).length ?? current.delivery,
      receipts: receipts?.length ?? current.receipts,
      stock: stock?.activeLots ?? current.stock,
      attention: stock?.attentionLots ?? current.attention,
      blocked: stock?.blockedLots ?? current.blocked,
    }));
    const failures = results.filter((result) => result.status === "rejected").length;
    setWarning(failures === 0 ? "" : failures < results.length ? "Algumas informações estão temporariamente indisponíveis. Os dados disponíveis foram mantidos." : "A conexão com o servidor está lenta ou temporariamente indisponível. O módulo permanece disponível.");
    setLoading(false); setRefreshing(false);
  }, []);

  React.useEffect(() => { void loadData(); }, [loadData]);

  const initializeReferences = async () => {
    setInitializingReferences(true); setReferenceMessage("");
    try {
      const response = await fetch(`${API}/admin/coffee-reference-data/initialize`, { method: "POST", credentials: "include" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || payload.success !== true) throw new Error(payload.message ?? "Não foi possível inicializar os dados mestres.");
      setReferenceMessage("Dados mestres configurados"); await loadData(true);
    } catch (error) { setReferenceMessage(error instanceof Error ? error.message : "Não foi possível inicializar os dados mestres."); }
    finally { setInitializingReferences(false); }
  };

  const nextAction = counts.delivery > 0 ? "Registrar recebimento pendente" : counts.attention > 0 ? "Concluir análise de qualidade" : counts.blocked > 0 ? "Revisar lotes bloqueados" : "Registrar nova compra";
  const nextHref = counts.delivery > 0 ? "/recebimento" : counts.attention > 0 || counts.blocked > 0 ? "/laboratorio" : "/compras-cafe-verde-v2";
  const blocker = counts.blocked > 0 ? `${counts.blocked} lote(s) bloqueado(s) não podem seguir para produção.` : counts.attention > 0 ? `${counts.attention} lote(s) aguardam conclusão da Qualidade.` : null;
  const stages: OperationalStage[] = [
    { label: "Compra", state: counts.purchases > 0 ? "done" : "current", detail: `${counts.purchases} registrada(s)` },
    { label: "Entrega", state: counts.delivery > 0 ? "current" : counts.purchases > 0 ? "done" : "future", detail: `${counts.delivery} aguardando` },
    { label: "Recebimento", state: counts.receipts > 0 ? "done" : counts.delivery > 0 ? "future" : "current", detail: `${counts.receipts} entrada(s)` },
    { label: "Laboratório", state: counts.attention > 0 ? "current" : counts.receipts > 0 ? "done" : "future", detail: counts.attention ? `${counts.attention} em análise` : undefined },
    { label: "Estoque liberado", state: counts.blocked > 0 ? "blocked" : counts.stock > 0 ? "current" : "future", detail: `${counts.stock} lote(s) ativo(s)` },
  ];

  const cards = [
    { href: "/compras-cafe-verde", label: "Compras", description: "Negociações, aprovações e contratos.", count: counts.purchases, icon: ShoppingBag, tone: "border-stone-200" },
    { href: "/recebimento", label: "Aguardando entrega", description: "Negócios confirmados com saldo físico a receber.", count: counts.delivery, icon: PackageOpen, tone: "border-amber-200" },
    { href: "/recebimento", label: "Recebimentos", description: "Entradas físicas, NF e recebimentos parciais.", count: counts.receipts, icon: PackageOpen, tone: "border-blue-200" },
    { href: "/laboratorio", label: "Laboratório", description: "Quarentena, amostras e liberação de qualidade.", count: counts.attention || "—", icon: FlaskConical, tone: "border-amber-200" },
    { href: "/estoque", label: "Estoque verde", description: "Lotes aprovados disponíveis para produção.", count: counts.stock, icon: Warehouse, tone: "border-emerald-200" },
  ];

  return <div className="mx-auto max-w-[1280px] space-y-6">
    <OperationalRecordHeader eyebrow="Operação · Café Verde" title="Do negócio ao lote liberado" subtitle="O BBOS acompanha compra, aceite, recebimento, NF, qualidade e disponibilidade para produção como uma única jornada." status={loading ? "Carregando" : warning ? "Atenção" : "Operação disponível"} statusTone={warning ? "attention" : "success"} stages={stages} blocker={blocker} nextAction={nextAction} nextActionDetail="A próxima ação é sugerida a partir do estado operacional atual, sem pular travas de qualidade ou aprovação." action={<div className="flex flex-wrap gap-2"><button type="button" onClick={() => void loadData(true)} disabled={refreshing} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-xs font-bold text-stone-700"><RefreshCw size={14} className={refreshing ? "animate-spin" : ""}/>Atualizar</button><Link href={nextHref} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#0E191D] px-4 text-xs font-bold text-white">{nextAction}<ArrowRight size={14}/></Link></div>} />

    {(session?.role === "ADMIN" || session?.role === "EXECUTIVE") && <div className="flex justify-end"><button type="button" onClick={() => void initializeReferences()} disabled={initializingReferences || referenceMessage === "Dados mestres configurados"} className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-xs font-bold text-stone-600 disabled:opacity-50">{referenceMessage === "Dados mestres configurados" ? "Dados mestres configurados" : "Inicializar dados mestres"}</button></div>}
    {referenceMessage && <p className="text-sm font-semibold text-forest-800">{referenceMessage}</p>}
    {warning && <div className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{warning}</div>}

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">{cards.map(({ href, label, description, count, icon: Icon, tone }) => <Link key={label} href={href} className="group"><Card className={`h-full border-2 ${tone} p-5 transition group-hover:-translate-y-0.5 group-hover:shadow-md`}><div className="flex items-start justify-between gap-3"><span className="grid size-11 place-items-center rounded-xl bg-stone-50 text-forest-800"><Icon size={20}/></span><strong className="text-2xl">{count}</strong></div><h2 className="mt-5 text-lg font-bold">{label}</h2><p className="mt-2 min-h-10 text-sm leading-5 text-stone-500">{description}</p><span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-forest-700">Abrir etapa<ArrowRight size={14}/></span></Card></Link>)}</section>

    <Card className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Regra operacional</p><p className="mt-2 text-sm font-semibold text-stone-800">Café recebido não significa café disponível para produção.</p><p className="mt-1 text-xs leading-5 text-stone-500">Somente lotes liberados pela Qualidade entram na disponibilidade produtiva. Recebimentos divergentes, amostras pendentes e lotes bloqueados permanecem visíveis, mas não utilizáveis.</p></div><Link href="/compras-cafe-verde-v2" className="shrink-0 rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white">Nova compra</Link></div></Card>
  </div>;
}
