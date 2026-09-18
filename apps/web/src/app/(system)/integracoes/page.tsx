"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  LoaderCircle,
  PackageSearch,
  PlayCircle,
  PlugZap,
  RefreshCw,
  ShieldCheck,
  Webhook,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Readiness = {
  provider: string;
  configured: boolean;
  missingEnvironment: string[];
  apiBaseUrl: string;
  resources: string[];
  connection: {
    status: string;
    providerAccountId?: string | null;
    connectedAt?: string | null;
    lastSyncAt?: string | null;
    lastError?: string | null;
  };
  credentialsExposed: boolean;
};

type Summary = {
  documents: Array<{ direction: string; status: string; count: number }>;
  outbox: Array<{ status: string; count: number }>;
  webhooks: Array<{ status: string; count: number }>;
  mappings?: Array<{ resourceType: string; count: number }>;
};

type CatalogStatus = {
  total: number;
  mapped: number;
  missing: string[];
  ready: boolean;
  items: Array<{
    slug: string;
    name: string;
    sku: string;
    weightGrams: number;
    mapped: boolean;
    blingProductId?: string | null;
  }>;
};

type ReconcileResult = {
  safeMode: boolean;
  createsProducts: boolean;
  remoteProductsScanned: number;
  matched: Array<{ slug: string; name: string; sku: string; blingProductId: string }>;
  missing: Array<{ slug: string; name: string; sku?: string | null; reason: string }>;
  ambiguous: Array<{ slug: string; name: string; sku: string; reason: string }>;
  ready: boolean;
};

export default function IntegrationsPage() {
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null);
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [error, setError] = useState("");

  const root = getApiBaseUrl();

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [r, s, c] = await Promise.all([
        fetch(`${root}/integrations/bling/readiness`, { credentials: "include", cache: "no-store" }),
        fetch(`${root}/integrations/fiscal/summary`, { credentials: "include", cache: "no-store" }),
        fetch(`${root}/integrations/bling/catalog/status`, { credentials: "include", cache: "no-store" }),
      ]);
      if (!r.ok || !s.ok || !c.ok) throw new Error("Não foi possível consultar a integração.");
      setReadiness(await r.json());
      setSummary(await s.json());
      setCatalog(await c.json());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na integração.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reconcile = async () => {
    setReconciling(true);
    setError("");
    setLastAction("");
    try {
      const response = await fetch(`${root}/integrations/bling/catalog/reconcile`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Falha ao reconciliar catálogo.");
      setReconcileResult(payload as ReconcileResult);
      setLastAction(payload.ready ? "Catálogo reconciliado e pronto." : "Reconciliação concluída com pendências.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao reconciliar catálogo.");
    } finally {
      setReconciling(false);
    }
  };

  const processNext = async () => {
    setProcessing(true);
    setError("");
    setLastAction("");
    try {
      const response = await fetch(`${root}/integrations/bling/process-next`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || "Falha ao processar fila.");
      setLastAction(payload?.processed ? "Próximo evento da fila processado." : "A fila do Bling está vazia.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao processar fila.");
    } finally {
      setProcessing(false);
    }
  };

  const fiscalTotal = useMemo(
    () => summary?.documents.reduce((sum, item) => sum + Number(item.count), 0) ?? 0,
    [summary],
  );
  const pending = useMemo(
    () =>
      summary?.outbox
        .filter((item) => !["SENT", "CANCELLED"].includes(item.status))
        .reduce((sum, item) => sum + Number(item.count), 0) ?? 0,
    [summary],
  );
  const connected = readiness?.connection.status === "CONNECTED";
  const catalogReady = Boolean(catalog?.ready);

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#6D4FA3]">
            Gestão · Integrações
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">Bling e operação fiscal</h1>
          <p className="mt-2 max-w-2xl text-sm text-stone-500">
            Conexão real entre o BBOS e o Bling para produtos, clientes, pedidos, estoque e documentos fiscais.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700 hover:bg-stone-50"
        >
          <RefreshCw size={14} />
          Atualizar
        </button>
      </header>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}
      {lastAction && !error && (
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">
          {lastAction}
        </div>
      )}

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <PlugZap size={20} />
              </span>
              <div>
                <p className="text-sm font-bold">Bling ERP / Fiscal</p>
                <p className="mt-1 text-xs text-stone-400">Produtos, contatos, pedidos, estoque e NF-e</p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${
                connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {loading ? "Verificando" : connected ? "Conectado" : "Desconectado"}
            </span>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label="Documentos fiscais" value={String(fiscalTotal)} />
            <Metric label="Fila pendente" value={String(pending)} />
            <Metric label="SKUs vinculados" value={catalog ? `${catalog.mapped}/${catalog.total}` : "—"} />
            <Metric
              label="Último sync"
              value={
                readiness?.connection.lastSyncAt
                  ? new Date(readiness.connection.lastSyncAt).toLocaleString("pt-BR")
                  : "—"
              }
            />
          </div>

          <div className="mt-5 rounded-2xl bg-stone-50 p-4">
            <p className="text-[10px] font-extrabold uppercase tracking-[.12em] text-stone-400">Readiness</p>
            {readiness?.configured ? (
              <div className="mt-3 flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} />
                Ambiente preparado.
              </div>
            ) : (
              <div className="mt-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-amber-700">
                  <AlertTriangle size={16} />
                  Configuração ainda incompleta.
                </div>
                <p className="mt-2 text-xs leading-5 text-stone-500">
                  Variáveis ausentes: {(readiness?.missingEnvironment ?? []).join(", ") || "—"}
                </p>
              </div>
            )}
            <div className="mt-3 flex items-center gap-2 text-[10px] text-stone-400">
              <ShieldCheck size={13} />
              Segredos nunca são expostos nesta tela.
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <Webhook size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Eventos e retorno</p>
              <p className="mt-1 text-xs text-stone-400">Fila idempotente e webhooks persistidos</p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <Rows title="Documentos" rows={summary?.documents} />
            <Rows title="Fila" rows={summary?.outbox} />
            <Rows title="Webhooks" rows={summary?.webhooks} />
          </div>
          <button
            type="button"
            onClick={() => void processNext()}
            disabled={!connected || processing || !catalogReady}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {processing ? <LoaderCircle size={15} className="animate-spin" /> : <PlayCircle size={15} />}
            Processar próximo evento
          </button>
        </div>
      </section>

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <PackageSearch size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Catálogo BBOS ↔ Bling</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-400">
                A reconciliação procura correspondência exata por SKU. O BBOS não cria produtos automaticamente no Bling.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void reconcile()}
            disabled={!connected || reconciling}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#087568] px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {reconciling ? <LoaderCircle size={15} className="animate-spin" /> : <Link2 size={15} />}
            Reconciliar catálogo
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Produtos BBOS" value={String(catalog?.total ?? 0)} />
          <Metric label="Vinculados ao Bling" value={String(catalog?.mapped ?? 0)} />
          <Metric label="Pendentes" value={String(catalog?.missing.length ?? 0)} />
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-stone-100">
          <div className="grid grid-cols-[1.2fr_1fr_.65fr] gap-3 bg-stone-50 px-4 py-2 text-[10px] font-extrabold uppercase tracking-[.1em] text-stone-400">
            <span>Produto</span>
            <span>SKU</span>
            <span>Status</span>
          </div>
          <div className="divide-y divide-stone-100">
            {catalog?.items?.length ? (
              catalog.items.map((item) => (
                <div
                  key={item.slug}
                  className="grid grid-cols-[1.2fr_1fr_.65fr] gap-3 px-4 py-3 text-xs text-stone-700"
                >
                  <span className="font-semibold">{item.name}</span>
                  <span className="font-mono text-[11px] text-stone-500">{item.sku}</span>
                  <span className={item.mapped ? "font-semibold text-emerald-700" : "font-semibold text-amber-700"}>
                    {item.mapped ? "Vinculado" : "Pendente"}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-4 py-5 text-xs text-stone-400">Nenhum produto encontrado.</div>
            )}
          </div>
        </div>

        {reconcileResult && (
          <div className="mt-4 rounded-2xl bg-stone-50 p-4 text-xs text-stone-600">
            <p className="font-bold text-stone-800">
              Última reconciliação: {reconcileResult.ready ? "catálogo pronto" : "há pendências"}
            </p>
            <p className="mt-1">
              {reconcileResult.matched.length} correspondências encontradas · {reconcileResult.missing.length} ausentes · {reconcileResult.ambiguous.length} ambíguas.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-[24px] border border-[#087568]/10 bg-[#F3FAF7] p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#087568]">Próxima ação operacional</p>
        <p className="mt-2 text-base font-bold text-stone-900">
          {!connected
            ? "Conectar a conta Bling."
            : !catalogReady
              ? "Reconciliar os SKUs antes de processar pedidos."
              : "Catálogo pronto para o primeiro pedido WEB controlado."}
        </p>
        <p className="mt-1 text-sm leading-6 text-stone-500">
          Fluxo alvo: pedido WEB pago → BBOS → Bling → retorno → estoque e financeiro.
        </p>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-stone-100 p-3">
      <p className="text-[10px] text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-bold text-stone-900">{value}</p>
    </div>
  );
}

function Rows({
  title,
  rows,
}: {
  title: string;
  rows?: Array<{ status?: string; direction?: string; count: number }>;
}) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {rows?.length ? (
          rows.map((item, index) => (
            <span
              key={`${item.direction ?? item.status}-${index}`}
              className="rounded-lg bg-stone-50 px-2.5 py-1.5 text-[10px] font-semibold text-stone-600"
            >
              {item.direction ?? item.status}: {item.count}
            </span>
          ))
        ) : (
          <span className="text-xs text-stone-400">Nenhum evento registrado.</span>
        )}
      </div>
    </div>
  );
}
