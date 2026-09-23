"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, FileCheck2, FileUp, Layers3, Link2, LoaderCircle, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import { Card } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

const API = `${getApiBaseUrl()}/fiscal-inbound`;
type Issue = { code: string; severity: string; message: string };
type DocumentRow = {
  id: string; status: string; number: string | null; series: string | null; accessKey: string;
  issueDate: string | null; totalAmount: string | number | null; source: string; issuerName: string | null;
  issuerTaxId: string | null; supplierName: string | null; itemCount: number; purchaseCount: number;
  validationIssues: Issue[]; matchStatus: string; importedAt: string | null;
};
type Distribution = { status: string; lastNsu: string; maxNsu: string; lastSyncAt: string | null; lastError: string | null };
type Readiness = { configured: boolean; automaticCapture: boolean; intervalMinutes: number; environment: string };
type Listing = { documents: DocumentRow[]; distribution: Distribution; readiness: Readiness };
type Candidate = { id: string; purchaseNumber: string; status: string; purchasedAt: string; totalValue: string | number; contractedWeightKg: string | number; species: string; variety: string | null; valueDifference: string | number };
type CostCenter = { id: string; code: string; name: string; category: string };
type PackagingMaterial = { id: string; name: string; sku: string | null; category: string; unit: string };
type Detail = { document: DocumentRow & Record<string, unknown>; items: Array<Record<string, unknown>>; allocations: Array<Record<string, unknown>>; candidates: Candidate[]; events: Array<Record<string, unknown>>; costCenters: CostCenter[]; packagingMaterials: PackagingMaterial[] };

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const date = (value?: string | null) => value ? new Date(value).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";
const taxId = (value?: string | null) => value?.length === 14 ? value.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5") : value ?? "—";
const source = (value: string) => value === "SEFAZ_DFE" ? "SEFAZ" : value === "BLING" ? "Bling" : "XML enviado";
const matchLabel: Record<string, string> = { UNMATCHED: "A classificar", PARTIAL: "Parcial", ALLOCATED: "Classificada", MATCHED: "Conciliada", DIVERGENT: "Com divergência" };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, credentials: "include", cache: "no-store" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof payload.message === "string" ? payload.message : "Não foi possível concluir a operação.");
  return payload as T;
}

export default function InboundFiscalPage() {
  const [data, setData] = React.useState<Listing | null>(null);
  const [selected, setSelected] = React.useState<Detail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    try { setData(await request<Listing>(API)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao carregar as notas de entrada."); }
    finally { setLoading(false); }
  }, []);
  React.useEffect(() => { void load(); }, [load]);

  const open = async (id: string) => {
    setBusy(`open:${id}`); setError("");
    try { setSelected(await request<Detail>(`${API}/${id}`)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível abrir a nota."); }
    finally { setBusy(""); }
  };
  const sync = async () => {
    setBusy("sync"); setMessage(""); setError("");
    try {
      const result = await request<{ imported: number; summaries: number; hasMore: boolean }>(`${API}/sync`, { method: "POST" });
      setMessage(`${result.imported} XML completo(s) e ${result.summaries} nova(s) NF-e identificada(s).${result.hasMore ? " O motor continuará do último NSU." : " Consulta atualizada."}`);
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Falha ao consultar a SEFAZ."); }
    finally { setBusy(""); }
  };
  const upload = async (file?: File) => {
    if (!file) return;
    setBusy("upload"); setMessage(""); setError("");
    try {
      if (file.size > 2_000_000) throw new Error("O XML excede o limite de 2 MB.");
      const xmlContent = await file.text();
      const result = await request<{ duplicate: boolean; supplierMatched: boolean }>(`${API}/import-xml`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ xmlContent }) });
      setMessage(result.duplicate ? "Esta NF-e já existia e foi atualizada com o XML autorizado." : result.supplierMatched ? "NF-e importada e fornecedor identificado." : "NF-e importada. O emitente ainda precisa ser vinculado a um fornecedor.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível importar o XML."); }
    finally { setBusy(""); if (inputRef.current) inputRef.current.value = ""; }
  };
  const match = async (purchaseId: string) => {
    if (!selected) return;
    setBusy(`match:${purchaseId}`); setError("");
    try {
      const result = await request<{ matchStatus: string; valueDifference: number }>(`${API}/${selected.document.id}/match-purchase`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ purchaseId }) });
      setMessage(result.matchStatus === "MATCHED" ? "NF-e conciliada com a compra. Nenhum novo título financeiro foi criado." : `Compra vinculada com divergência de ${money.format(result.valueDifference)} para conferência.`);
      await load(); await open(selected.document.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível vincular a compra."); }
    finally { setBusy(""); }
  };
  const allocate = async (itemId: string, allocationType: string, purchaseId: string, costCenterId: string, targetReferenceId: string) => {
    if (!selected) return;
    setBusy(`allocate:${itemId}`); setError("");
    try {
      await request(`${API}/${selected.document.id}/allocate-item`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ itemId, allocationType, purchaseId: purchaseId || undefined, costCenterId: costCenterId || undefined, targetReferenceId: targetReferenceId || undefined }) });
      setMessage("Destino registrado. Nenhum estoque ou título financeiro foi criado antes da conferência operacional.");
      await load(); await open(selected.document.id);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível classificar o item."); }
    finally { setBusy(""); }
  };

  const documents = (data?.documents ?? []).filter((item) => [item.number, item.accessKey, item.issuerName, item.supplierName].some((value) => String(value ?? "").toLowerCase().includes(query.toLowerCase())));
  const newCount = data?.documents.filter((item) => item.matchStatus === "UNMATCHED").length ?? 0;
  const divergenceCount = data?.documents.filter((item) => item.matchStatus === "DIVERGENT").length ?? 0;

  return <div className="mx-auto max-w-[1380px] space-y-5">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><Link href="/financeiro" className="inline-flex items-center gap-2 text-xs font-bold text-forest-700"><ArrowLeft size={14}/>Gestão</Link><p className="mt-5 text-xs font-bold uppercase tracking-[.15em] text-forest-700">Caixa fiscal de entrada</p><h1 className="mt-2 text-3xl font-bold">Notas emitidas para a Bispo</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">O BBOS recebe todas as NF-e do CNPJ. Cada item é destinado a café verde, embalagens, energia, manutenção, ativos, serviços ou despesas antes de movimentar estoque e financeiro.</p></div>
      <div className="flex flex-wrap gap-2"><input ref={inputRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(event) => void upload(event.target.files?.[0])}/><button type="button" onClick={() => inputRef.current?.click()} disabled={Boolean(busy)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-bold disabled:opacity-50"><FileUp size={16}/>Enviar XML</button><button type="button" onClick={() => void sync()} disabled={Boolean(busy) || !data?.readiness.configured} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#0E191D] px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">{busy === "sync" ? <LoaderCircle className="animate-spin" size={16}/> : <RefreshCw size={16}/>}Buscar agora</button></div>
    </div>

    {error && <div className="flex items-start gap-3 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle size={18} className="mt-0.5 shrink-0"/><span>{error}</span></div>}
    {message && <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800"><CheckCircle2 size={18} className="mt-0.5 shrink-0"/><span>{message}</span></div>}

    <section className="grid gap-4 lg:grid-cols-[1.35fr_.65fr]">
      <Card className="p-5"><div className="flex items-start gap-4"><span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${data?.readiness.configured ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}><ShieldCheck size={21}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-[.13em] text-stone-400">Captura automática · Distribuição DF-e</p><h2 className="mt-1 text-lg font-bold">{data?.readiness.configured ? `Consulta a cada ${data.readiness.intervalMinutes} minutos` : "Aguardando certificado digital A1"}</h2></div><span className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${data?.readiness.automaticCapture ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-500"}`}>{data?.readiness.automaticCapture ? "Motor ativo" : "Não ativado"}</span></div><p className="mt-2 text-sm leading-5 text-stone-500">{data?.readiness.configured ? "O BBOS continua sempre do último NSU recebido e não repete documentos já capturados." : "A estrutura está preparada. Após instalar o A1 de forma segura no servidor, o motor encontrará as NF-e emitidas para o CNPJ da Bispo."}</p><div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-stone-500"><span><b className="text-stone-800">Última consulta:</b> {date(data?.distribution.lastSyncAt)}</span><span><b className="text-stone-800">Último NSU:</b> {data?.distribution.lastNsu ?? "—"}</span>{data?.distribution.lastError && <span className="font-semibold text-red-700">{data.distribution.lastError}</span>}</div></div></div></Card>
      <div className="grid grid-cols-3 gap-3"><Metric label="Capturadas" value={data?.documents.length ?? 0}/><Metric label="A conciliar" value={newCount}/><Metric label="Divergências" value={divergenceCount} attention={divergenceCount > 0}/></div>
    </section>

    <Card className="overflow-hidden p-0"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4"><div><h2 className="font-bold">Caixa de entrada fiscal</h2><p className="mt-1 text-xs text-stone-500">XML autorizado, classificação por item e situação operacional.</p></div><label className="flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm text-stone-500"><Search size={15}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nota, chave ou fornecedor" className="w-64 max-w-[55vw] outline-none"/></label></div>{loading ? <p className="p-10 text-center text-sm text-stone-500">Carregando documentos fiscais…</p> : documents.length === 0 ? <div className="p-12 text-center"><FileCheck2 className="mx-auto text-stone-300" size={28}/><p className="mt-3 font-semibold">Nenhuma NF-e nesta caixa.</p><p className="mt-1 text-sm text-stone-500">A captura automática ou o envio de XML fará os documentos aparecerem aqui.</p></div> : <div className="divide-y">{documents.map((item) => <button key={item.id} type="button" onClick={() => void open(item.id)} className="grid w-full gap-3 p-4 text-left transition hover:bg-stone-50 md:grid-cols-[1.2fr_.75fr_.7fr_.7fr_auto] md:items-center"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-bold">NF-e {item.number ?? "identificada"}</span><span className="rounded-full bg-stone-100 px-2 py-0.5 text-[9px] font-bold uppercase text-stone-500">{source(item.source)}</span></div><p className="mt-1 truncate text-xs text-stone-500">{item.issuerName ?? item.supplierName ?? "Emitente não identificado"} · {taxId(item.issuerTaxId)}</p></div><div><p className="text-[10px] font-bold uppercase text-stone-400">Emissão</p><p className="mt-1 text-sm font-semibold">{date(item.issueDate).split(" ")[0]}</p></div><div><p className="text-[10px] font-bold uppercase text-stone-400">Total</p><p className="mt-1 text-sm font-bold">{money.format(Number(item.totalAmount ?? 0))}</p></div><div><p className="text-[10px] font-bold uppercase text-stone-400">Alocação</p><Status value={item.matchStatus}/></div><span className="inline-flex min-h-9 items-center justify-center rounded-xl border px-3 text-xs font-bold">{busy === `open:${item.id}` ? <LoaderCircle className="animate-spin" size={14}/> : "Conferir"}</span></button>)}</div>}</Card>

    {selected && <DetailPanel detail={selected} busy={busy} close={() => setSelected(null)} match={match} allocate={allocate}/>} 
  </div>;
}

function Metric({ label, value, attention = false }: { label: string; value: number; attention?: boolean }) { return <Card className={`grid min-h-28 place-content-center p-3 text-center ${attention ? "border-amber-200 bg-amber-50" : ""}`}><strong className="text-2xl">{value}</strong><span className="mt-1 text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</span></Card>; }
function Status({ value }: { value: string }) { const style = ["MATCHED", "ALLOCATED"].includes(value) ? "bg-emerald-50 text-emerald-700" : ["DIVERGENT", "PARTIAL"].includes(value) ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"; return <span className={`mt-1 inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${style}`}>{matchLabel[value] ?? value}</span>; }

function DetailPanel({ detail, busy, close, match, allocate }: { detail: Detail; busy: string; close: () => void; match: (purchaseId: string) => Promise<void>; allocate: (itemId: string, allocationType: string, purchaseId: string, costCenterId: string, targetReferenceId: string) => Promise<void> }) {
  const d = detail.document;
  return <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onMouseDown={close}><aside className="h-full w-full max-w-2xl overflow-y-auto bg-[#FAFAF8] shadow-2xl" onMouseDown={(event) => event.stopPropagation()}><header className="sticky top-0 z-10 flex items-start justify-between border-b bg-white p-5"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Conferência fiscal</p><h2 className="mt-1 text-2xl font-bold">NF-e {d.number ?? "identificada"}</h2><p className="mt-1 text-xs text-stone-500">Chave {d.accessKey}</p></div><button onClick={close} className="rounded-xl border p-2" aria-label="Fechar"><X size={18}/></button></header><div className="space-y-4 p-5"><Card className="p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold">{String(d.issuerName ?? "Emitente não identificado")}</p><p className="mt-1 text-sm text-stone-500">{taxId(String(d.issuerTaxId ?? ""))}</p></div><Status value={String(d.matchStatus)}/></div><div className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4"><Detail label="Emissão" value={date(String(d.issueDate ?? ""))}/><Detail label="Produtos" value={money.format(Number(d.productsAmount ?? 0))}/><Detail label="Frete" value={money.format(Number(d.freightAmount ?? 0))}/><Detail label="Total NF-e" value={money.format(Number(d.totalAmount ?? 0))}/></div></Card>
      {Array.isArray(d.validationIssues) && d.validationIssues.length > 0 && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">{d.validationIssues.map((issue: Issue) => <p key={issue.code} className="text-sm text-amber-900"><AlertTriangle className="mr-2 inline" size={15}/>{issue.message}</p>)}</div>}
      <Card className="overflow-hidden p-0"><div className="border-b p-4"><div className="flex items-center gap-2"><Layers3 size={17} className="text-forest-700"/><h3 className="font-bold">Destino dos itens</h3></div><p className="mt-1 text-xs text-stone-500">Uma mesma NF-e pode conter café, embalagens, gás e outras despesas.</p></div>{detail.items.length ? <div className="divide-y">{detail.items.map((item) => <ItemDestination key={String(item.id)} item={item} allocation={detail.allocations.find((allocation) => String(allocation.fiscalDocumentItemId) === String(item.id))} candidates={detail.candidates} costCenters={detail.costCenters} packagingMaterials={detail.packagingMaterials} busy={busy} allocate={allocate}/>)}</div> : <p className="p-5 text-sm text-stone-500">O XML completo ainda não foi distribuído pela SEFAZ.</p>}</Card>
      <Card className="p-5"><div className="flex items-center gap-2"><Link2 size={17} className="text-forest-700"/><h3 className="font-bold">Conciliação de café verde</h3></div><p className="mt-2 text-sm text-stone-500">Use esta conciliação rápida quando toda a NF-e corresponder a uma única compra de café. Para notas mistas, classifique cada item acima.</p>{detail.allocations.some((item) => item.allocationType === "GREEN_COFFEE_PURCHASE") && <div className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800"><CheckCircle2 className="mr-2 inline" size={16}/>Há itens vinculados a uma compra de café verde.</div>}<div className="mt-4 space-y-2">{detail.candidates.length === 0 ? <p className="text-sm text-stone-500">Nenhuma compra aberta deste fornecedor foi encontrada.</p> : detail.candidates.map((candidate) => <div key={candidate.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3"><div><p className="text-sm font-bold">{candidate.purchaseNumber}</p><p className="mt-1 text-xs text-stone-500">{candidate.species} · {candidate.variety ?? "cultivar não informado"} · {Number(candidate.contractedWeightKg).toLocaleString("pt-BR")} kg</p><p className={`mt-1 text-xs ${Number(candidate.valueDifference) > Math.max(1, Number(candidate.totalValue) * .005) ? "font-semibold text-amber-700" : "text-emerald-700"}`}>Compra {money.format(Number(candidate.totalValue))} · diferença {money.format(Number(candidate.valueDifference))}</p></div><button type="button" onClick={() => void match(candidate.id)} disabled={Boolean(busy)} className="min-h-10 rounded-xl bg-forest-900 px-4 text-xs font-bold text-white disabled:opacity-50">{busy === `match:${candidate.id}` ? "Vinculando…" : "Vincular toda a NF-e"}</button></div>)}</div><p className="mt-4 text-xs leading-5 text-stone-500">O vínculo apenas concilia os títulos previstos na compra. Ele não cria uma segunda conta a pagar.</p></Card>
    </div></aside></div>;
}

const destinations = [
  ["", "Selecione o destino"], ["GREEN_COFFEE_PURCHASE", "Café verde"], ["PACKAGING_MATERIAL", "Embalagens e insumos"], ["GAS_ENERGY", "Gás e energia"], ["MAINTENANCE", "Manutenção"], ["FIXED_ASSET", "Ativo imobilizado"], ["SERVICE", "Serviço"], ["ADMINISTRATIVE_EXPENSE", "Despesa administrativa"], ["TAX", "Impostos e taxas"], ["OTHER", "Outro"],
] as const;
function ItemDestination({ item, allocation, candidates, costCenters, packagingMaterials, busy, allocate }: { item: Record<string, unknown>; allocation?: Record<string, unknown>; candidates: Candidate[]; costCenters: CostCenter[]; packagingMaterials: PackagingMaterial[]; busy: string; allocate: (itemId: string, allocationType: string, purchaseId: string, costCenterId: string, targetReferenceId: string) => Promise<void> }) {
  const [type, setType] = React.useState(String(allocation?.allocationType ?? ""));
  const [purchaseId, setPurchaseId] = React.useState(String(allocation?.purchaseId ?? ""));
  const [costCenterId, setCostCenterId] = React.useState(String(allocation?.costCenterId ?? ""));
  const [targetReferenceId, setTargetReferenceId] = React.useState(String(allocation?.targetReferenceId ?? ""));
  const itemId = String(item.id);
  return <div className="space-y-3 p-4"><div className="flex items-start justify-between gap-3 text-sm"><div><p className="font-semibold">{String(item.itemNumber)} · {String(item.description)}</p><p className="mt-1 text-xs text-stone-500">NCM {String(item.ncm ?? "—")} · {String(item.quantity)} {String(item.commercialUnit ?? "")}</p></div><p className="shrink-0 font-bold">{money.format(Number(item.totalValue ?? 0))}</p></div><div className="grid gap-2 sm:grid-cols-2"><select value={type} onChange={(event) => setType(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm">{destinations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{type === "GREEN_COFFEE_PURCHASE" ? <select value={purchaseId} onChange={(event) => setPurchaseId(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm"><option value="">Selecione a compra</option>{candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.purchaseNumber} · {money.format(Number(candidate.totalValue))}</option>)}</select> : type === "PACKAGING_MATERIAL" ? <select value={targetReferenceId} onChange={(event) => setTargetReferenceId(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm"><option value="">Material específico (opcional)</option>{packagingMaterials.map((material) => <option key={material.id} value={material.id}>{material.name}{material.sku ? ` · ${material.sku}` : ""}</option>)}</select> : <select value={costCenterId} onChange={(event) => setCostCenterId(event.target.value)} className="min-h-10 rounded-xl border bg-white px-3 text-sm"><option value="">Centro de custo (opcional)</option>{costCenters.map((center) => <option key={center.id} value={center.id}>{center.code} · {center.name}</option>)}</select>}</div><div className="flex items-center justify-between gap-3"><p className="text-[11px] text-stone-500">{allocation ? `Classificado como ${destinations.find(([value]) => value === allocation.allocationType)?.[1] ?? allocation.allocationType}` : "Ainda não classificado"}</p><button type="button" onClick={() => void allocate(itemId, type, purchaseId, costCenterId, targetReferenceId)} disabled={!type || (type === "GREEN_COFFEE_PURCHASE" && !purchaseId) || Boolean(busy)} className="min-h-9 rounded-xl bg-forest-900 px-4 text-xs font-bold text-white disabled:opacity-40">{busy === `allocate:${itemId}` ? "Salvando…" : allocation ? "Atualizar destino" : "Salvar destino"}</button></div></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-[10px] font-bold uppercase tracking-wide text-stone-400">{label}</p><p className="mt-1 font-semibold">{value}</p></div>; }
