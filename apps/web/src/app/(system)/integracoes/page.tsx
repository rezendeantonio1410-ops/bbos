"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Link2,
  LoaderCircle,
  PackagePlus,
  PackageSearch,
  PlayCircle,
  PlugZap,
  RefreshCw,
  Save,
  ShieldCheck,
  Store,
  Truck,
  UsersRound,
  Webhook,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

type Readiness = {
  provider: string;
  configured: boolean;
  missingEnvironment: string[];
  connection: {
    status: string;
    lastSyncAt?: string | null;
  };
};

type Summary = {
  documents: Array<{ direction: string; status: string; count: number }>;
  outbox: Array<{ status: string; count: number }>;
  webhooks: Array<{ status: string; count: number }>;
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

type FiscalProfile = {
  ncm: string;
  origem: number;
  unidade: string;
  preco: number;
  pesoLiquido: number;
  pesoBruto: number;
  descricaoCurta: string;
  cest?: string | null;
};

type CompanyFiscalProfile = {
  taxRegime: "LUCRO_REAL";
  pisCofinsRegime: "NAO_CUMULATIVO";
  state: string;
  cstIcms?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cfopIntra?: string | null;
  cfopInter?: string | null;
  sampleCfopIntra: "5910";
  sampleCfopInter: "6910";
  sampleNatureOperationId?: string | null;
  sampleNatureOperationName?: string | null;
  sampleValidatedByAccountant: boolean;
  notes?: string | null;
  validatedByAccountant: boolean;
};

type OperationNature = {
  id: string;
  name: string;
  type?: string | null;
};

type ProfilesResponse = {
  defaultNcm: string;
  companyProfile: CompanyFiscalProfile;
  items: Array<{
    slug: string;
    name: string;
    sku: string;
    mapped: boolean;
    blingProductId?: string | null;
    profile: FiscalProfile;
  }>;
};

type IntegrationOverview = {
  providers: Array<{
    provider: "BLING" | "MERCADO_LIVRE" | "MELHOR_ENVIO" | "MERCADO_PAGO";
    configured: boolean;
    connection: {
      status: string;
      connectedAt?: string | null;
      lastSyncAt?: string | null;
      lastError?: string | null;
    };
    activity: {
      pending: number;
      failed: number;
      webhookErrors: number;
      lastWebhookAt?: string | null;
    };
  }>;
  customerFiscalReadiness: {
    total: number;
    ready: number;
    pending: number;
    items: Array<{
      id: string;
      name: string;
      taxId?: string | null;
      issues: string[];
    }>;
  };
  checkedAt: string;
};

export default function IntegrationsPage() {
  const root = getApiBaseUrl();
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [catalog, setCatalog] = useState<CatalogStatus | null>(null);
  const [profiles, setProfiles] = useState<ProfilesResponse | null>(null);
  const [overview, setOverview] = useState<IntegrationOverview | null>(null);
  const [operationNatures, setOperationNatures] = useState<OperationNature[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [reconciling, setReconciling] = useState(false);
  const [creating, setCreating] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [savingSlug, setSavingSlug] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [lastAction, setLastAction] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [o, r, s, c, p] = await Promise.all([
        fetch(`${root}/integrations/overview`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${root}/integrations/bling/readiness`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${root}/integrations/fiscal/summary`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${root}/integrations/bling/catalog/status`, {
          credentials: "include",
          cache: "no-store",
        }),
        fetch(`${root}/integrations/bling/catalog/profiles`, {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      if (!o.ok || !r.ok || !s.ok || !c.ok || !p.ok)
        throw new Error("Não foi possível consultar a integração.");
      setOverview(await o.json());
      setReadiness(await r.json());
      setSummary(await s.json());
      setCatalog(await c.json());
      setProfiles(await p.json());
      const naturesResponse = await fetch(
        `${root}/integrations/bling/operation-natures`,
        {
          credentials: "include",
          cache: "no-store",
        },
      ).catch(() => null);
      if (naturesResponse?.ok) {
        const payload = await naturesResponse
          .json()
          .catch(() => ({ items: [] }));
        setOperationNatures(Array.isArray(payload?.items) ? payload.items : []);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha na integração.");
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void load();
  }, [load]);

  const reconcile = async () => {
    setReconciling(true);
    setError("");
    try {
      const response = await fetch(
        `${root}/integrations/bling/catalog/reconcile`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.message || "Falha ao reconciliar catálogo.");
      setLastAction(
        payload.ready
          ? "Catálogo reconciliado e pronto."
          : "Reconciliação concluída com pendências.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao reconciliar catálogo.",
      );
    } finally {
      setReconciling(false);
    }
  };

  const createMissing = async () => {
    setCreating(true);
    setError("");
    setLastAction("");
    try {
      const response = await fetch(
        `${root}/integrations/bling/catalog/create-missing`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
          payload?.message || "Falha ao criar produtos no Bling.",
        );
      const created = Number(payload?.created?.length ?? 0);
      const failed = Number(payload?.failed?.length ?? 0);
      setLastAction(
        failed
          ? `${created} produto(s) criado(s) no Bling; ${failed} pendência(s) exigem revisão.`
          : `${created} produto(s) criado(s) no Bling a partir do BBOS.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao criar produtos no Bling.",
      );
    } finally {
      setCreating(false);
    }
  };

  const saveCompanyProfile = async () => {
    if (!profiles?.companyProfile) return;
    setSavingCompany(true);
    setError("");
    try {
      const response = await fetch(
        `${root}/integrations/bling/fiscal-profile`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(profiles.companyProfile),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.message || "Falha ao salvar perfil fiscal.");
      setLastAction("Perfil fiscal da Bispo salvo no BBOS.");
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Falha ao salvar perfil fiscal.",
      );
    } finally {
      setSavingCompany(false);
    }
  };

  const saveProductProfile = async (slug: string) => {
    const item = profiles?.items.find((entry) => entry.slug === slug);
    if (!item) return;
    setSavingSlug(slug);
    setError("");
    try {
      const response = await fetch(
        `${root}/integrations/bling/catalog/profiles/${encodeURIComponent(slug)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(item.profile),
        },
      );
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.message || "Falha ao salvar produto.");
      setLastAction(
        item.mapped
          ? `${item.name} atualizado no BBOS e no Bling.`
          : `${item.name} salvo no BBOS.`,
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao salvar produto.",
      );
    } finally {
      setSavingSlug("");
    }
  };

  const processNext = async () => {
    setProcessing(true);
    setError("");
    try {
      const response = await fetch(`${root}/integrations/bling/process-next`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(payload?.message || "Falha ao processar fila.");
      setLastAction(
        payload?.processed
          ? "Próximo evento da fila processado."
          : "A fila do Bling está vazia.",
      );
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Falha ao processar fila.",
      );
    } finally {
      setProcessing(false);
    }
  };

  const updateCompany = (patch: Partial<CompanyFiscalProfile>) => {
    setProfiles((current) =>
      current
        ? {
            ...current,
            companyProfile: { ...current.companyProfile, ...patch },
          }
        : current,
    );
  };

  const updateProduct = (slug: string, patch: Partial<FiscalProfile>) => {
    setProfiles((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.slug === slug
                ? { ...item, profile: { ...item.profile, ...patch } }
                : item,
            ),
          }
        : current,
    );
  };

  const fiscalTotal = useMemo(
    () =>
      summary?.documents.reduce((sum, item) => sum + Number(item.count), 0) ??
      0,
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
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Central de integrações
          </h1>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            Conexões, sincronizações e impedimentos operacionais em uma só
            tela — antes que o pedido pare no faturamento ou na expedição.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700"
        >
          <RefreshCw size={14} /> Atualizar
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

      <section>
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-stone-900">
              Sistemas conectados ao BBOS
            </p>
            <p className="mt-1 text-xs text-stone-400">
              O status abaixo confirma configuração, autorização e atividade
              recente sem expor nenhuma credencial.
            </p>
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-stone-400">
            {overview?.checkedAt
              ? `Conferido ${new Date(overview.checkedAt).toLocaleString("pt-BR")}`
              : "Conferindo conexões"}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <ConnectorCard
            name="Bling"
            description="ERP, clientes, produtos e NF-e"
            icon={<PlugZap size={19} />}
            tone="violet"
            data={overview?.providers.find(
              (item) => item.provider === "BLING",
            )}
            connectHref={`${root}/integrations/bling/connect`}
            actionLabel="Conectar Bling"
          />
          <ConnectorCard
            name="Mercado Livre"
            description="Pedidos, anúncios e repasses"
            icon={<Store size={19} />}
            tone="yellow"
            data={overview?.providers.find(
              (item) => item.provider === "MERCADO_LIVRE",
            )}
            connectHref={`${root}/integrations/mercado-livre/connect`}
            actionLabel="Conectar Mercado Livre"
            detailsHref="/commerce/marketplaces"
          />
          <ConnectorCard
            name="Melhor Envio"
            description="Frete, etiqueta e rastreio"
            icon={<Truck size={19} />}
            tone="green"
            data={overview?.providers.find(
              (item) => item.provider === "MELHOR_ENVIO",
            )}
            connectHref={`${root}/integrations/melhor-envio/connect`}
            actionLabel="Conectar Melhor Envio"
          />
          <ConnectorCard
            name="Mercado Pago"
            description="PIX, cartão e confirmação de pagamento"
            icon={<CreditCard size={19} />}
            tone="blue"
            data={overview?.providers.find(
              (item) => item.provider === "MERCADO_PAGO",
            )}
          />
        </div>
      </section>

      <section
        className={`rounded-[24px] border p-5 shadow-sm ${
          overview?.customerFiscalReadiness.pending
            ? "border-amber-200 bg-amber-50/40"
            : "border-emerald-100 bg-emerald-50/40"
        }`}
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span
              className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                overview?.customerFiscalReadiness.pending
                  ? "bg-amber-100 text-amber-800"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              <UsersRound size={20} />
            </span>
            <div>
              <p className="text-sm font-bold text-stone-900">
                Clientes prontos para faturar no Bling
              </p>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-stone-500">
                O BBOS confere documento e endereço fiscal antes da NF-e. Assim,
                o erro aparece no cadastro — não depois de o pedido estar pronto.
              </p>
            </div>
          </div>
          <Link
            href="/clientes"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white"
          >
            Corrigir cadastros <ExternalLink size={13} />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric
            label="Clientes ativos"
            value={String(overview?.customerFiscalReadiness.total ?? "—")}
          />
          <Metric
            label="Prontos para NF-e"
            value={String(overview?.customerFiscalReadiness.ready ?? "—")}
          />
          <Metric
            label="Precisam de correção"
            value={String(overview?.customerFiscalReadiness.pending ?? "—")}
          />
        </div>

        {overview?.customerFiscalReadiness.items.length ? (
          <div className="mt-4 grid gap-2 lg:grid-cols-2">
            {overview.customerFiscalReadiness.items.slice(0, 8).map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-amber-100 bg-white px-4 py-3"
              >
                <p className="text-xs font-bold text-stone-900">{item.name}</p>
                <p className="mt-1 text-[11px] leading-5 text-amber-800">
                  Falta: {item.issues.join(", ")}.
                </p>
              </div>
            ))}
            {overview.customerFiscalReadiness.items.length > 8 && (
              <p className="px-1 text-xs font-semibold text-amber-800">
                + {overview.customerFiscalReadiness.items.length - 8} cliente(s)
                com pendências na tela Clientes.
              </p>
            )}
          </div>
        ) : overview ? (
          <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 size={16} /> Todos os clientes ativos estão completos
            para faturamento.
          </p>
        ) : null}
      </section>

      <div className="pt-2">
        <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#6D4FA3]">
          Operação fiscal e catálogo Bling
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-violet-50 text-violet-700">
                <PlugZap size={20} />
              </span>
              <div>
                <p className="text-sm font-bold">Bling ERP / Fiscal</p>
                <p className="mt-1 text-xs text-stone-400">
                  Produtos, contatos, pedidos, estoque e NF-e
                </p>
              </div>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[10px] font-extrabold uppercase ${connected ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
            >
              {loading
                ? "Verificando"
                : connected
                  ? "Conectado"
                  : "Desconectado"}
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <Metric label="Documentos fiscais" value={String(fiscalTotal)} />
            <Metric label="Fila pendente" value={String(pending)} />
            <Metric
              label="SKUs vinculados"
              value={catalog ? `${catalog.mapped}/${catalog.total}` : "—"}
            />
            <Metric
              label="Último sync"
              value={
                readiness?.connection.lastSyncAt
                  ? new Date(readiness.connection.lastSyncAt).toLocaleString(
                      "pt-BR",
                    )
                  : "—"
              }
            />
          </div>
          <div className="mt-5 flex items-center gap-2 rounded-2xl bg-stone-50 p-4 text-sm font-semibold text-emerald-700">
            <ShieldCheck size={16} /> Ambiente preparado e segredos protegidos.
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <Webhook size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Fluxos de integração</p>
              <p className="mt-1 text-xs text-stone-400">
                Saída BBOS → Bling e retornos Bling → BBOS
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <Rows title="Documentos" rows={summary?.documents} />
            <Rows title="Fila de saída BBOS → Bling" rows={summary?.outbox} />
            <Rows title="Retornos Bling → BBOS" rows={summary?.webhooks} />
          </div>
          <button
            type="button"
            onClick={() => void processNext()}
            disabled={!connected || processing || !catalogReady}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white disabled:opacity-40"
          >
            {processing ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <PlayCircle size={15} />
            )}{" "}
            Processar próxima saída
          </button>
        </div>
      </section>

      {profiles?.companyProfile && (
        <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-bold">
                Perfil fiscal da Bispo Coffees
              </p>
              <p className="mt-1 text-xs text-stone-400">
                Fonte de verdade: BBOS. Regime travado em Lucro Real.
              </p>
            </div>
            <div className="flex gap-2">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-extrabold uppercase text-violet-700">
                Lucro Real
              </span>
              <span className="rounded-full bg-blue-50 px-3 py-1 text-[10px] font-extrabold uppercase text-blue-700">
                PIS/COFINS não cumulativo
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Field
              label="UF"
              value={profiles.companyProfile.state}
              onChange={(v) => updateCompany({ state: v.toUpperCase() })}
            />
            <Field
              label="CST ICMS"
              value={profiles.companyProfile.cstIcms ?? ""}
              onChange={(v) => updateCompany({ cstIcms: v })}
            />
            <Field
              label="CST PIS"
              value={profiles.companyProfile.cstPis ?? ""}
              onChange={(v) => updateCompany({ cstPis: v })}
            />
            <Field
              label="CST COFINS"
              value={profiles.companyProfile.cstCofins ?? ""}
              onChange={(v) => updateCompany({ cstCofins: v })}
            />
            <Field
              label="CFOP PR"
              value={profiles.companyProfile.cfopIntra ?? ""}
              onChange={(v) => updateCompany({ cfopIntra: v })}
            />
            <Field
              label="CFOP interestadual"
              value={profiles.companyProfile.cfopInter ?? ""}
              onChange={(v) => updateCompany({ cfopInter: v })}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-bold text-emerald-950">
                  Rota fiscal para degustação em embalagem comercial
                </p>
                <p className="mt-1 max-w-3xl text-xs leading-5 text-emerald-800">
                  O BBOS registra cada pacote real por R$ 1,00, aplica a natureza
                  selecionada em cada item, usa CFOP 5.910 dentro do Paraná e
                  6.910 para outros estados e confere o rascunho antes de
                  transmitir à SEFAZ.
                </p>
              </div>
              <div className="flex gap-2 text-[10px] font-extrabold uppercase">
                <span className="rounded-full bg-white px-3 py-1 text-emerald-800">
                  PR → PR · 5.910
                </span>
                <span className="rounded-full bg-white px-3 py-1 text-emerald-800">
                  PR → outros · 6.910
                </span>
              </div>
            </div>
            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <label className="block">
                <span className="mb-1 block text-[9px] font-bold uppercase tracking-[.08em] text-emerald-800">
                  Natureza de operação no Bling
                </span>
                <select
                  value={profiles.companyProfile.sampleNatureOperationId ?? ""}
                  onChange={(event) => {
                    const selected = operationNatures.find(
                      (item) => item.id === event.target.value,
                    );
                    updateCompany({
                      sampleNatureOperationId: event.target.value || null,
                      sampleNatureOperationName: selected?.name ?? null,
                      sampleValidatedByAccountant: false,
                    });
                  }}
                  className="w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-xs text-stone-800 outline-none focus:border-[#087568]"
                >
                  <option value="">
                    Selecione a natureza de remessa gratuita sem retorno
                  </option>
                  {profiles.companyProfile.sampleNatureOperationId &&
                    !operationNatures.some(
                      (item) =>
                        item.id ===
                        profiles.companyProfile.sampleNatureOperationId,
                    ) && (
                      <option
                        value={profiles.companyProfile.sampleNatureOperationId}
                      >
                        {profiles.companyProfile.sampleNatureOperationName ??
                          `Natureza #${profiles.companyProfile.sampleNatureOperationId}`}
                      </option>
                    )}
                  {operationNatures.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-semibold text-emerald-950">
                <input
                  type="checkbox"
                  checked={profiles.companyProfile.sampleValidatedByAccountant}
                  disabled={!profiles.companyProfile.sampleNatureOperationId}
                  onChange={(event) =>
                    updateCompany({
                      sampleValidatedByAccountant: event.target.checked,
                    })
                  }
                />
                Remessa gratuita validada pela contabilidade
              </label>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-amber-800">
              O valor fiscal informado pelo BBOS é R$ 1,00 por pacote. Confirme
              somente depois de a contabilidade validar ICMS, IPI, PIS, COFINS
              e a base de cálculo dessa natureza no Bling. Sem essa confirmação,
              pedidos de amostra não são enviados à SEFAZ.
            </p>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <input
                type="checkbox"
                checked={profiles.companyProfile.validatedByAccountant}
                onChange={(event) =>
                  updateCompany({ validatedByAccountant: event.target.checked })
                }
              />
              Parametrização validada pela contabilidade
            </label>
            <button
              type="button"
              onClick={() => void saveCompanyProfile()}
              disabled={savingCompany}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white"
            >
              {savingCompany ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Save size={14} />
              )}{" "}
              Salvar perfil fiscal
            </button>
          </div>
        </section>
      )}

      <section className="rounded-[24px] border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-amber-50 text-amber-700">
              <PackageSearch size={18} />
            </span>
            <div>
              <p className="text-sm font-bold">Produtos: BBOS → Bling</p>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-stone-400">
                Café torrado não descafeinado usa NCM 09012100 como padrão. NCM,
                origem, CEST, preço e pesos permanecem editáveis no BBOS.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void reconcile()}
              disabled={!connected || reconciling}
              className="inline-flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-xs font-bold text-stone-700"
            >
              {reconciling ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Link2 size={14} />
              )}{" "}
              Reconciliar
            </button>
            <button
              type="button"
              onClick={() => void createMissing()}
              disabled={!connected || creating || !catalog?.missing.length}
              className="inline-flex items-center gap-2 rounded-xl bg-[#087568] px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40"
            >
              {creating ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <PackagePlus size={14} />
              )}{" "}
              Criar ausentes no Bling
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Metric label="Produtos BBOS" value={String(catalog?.total ?? 0)} />
          <Metric
            label="Vinculados ao Bling"
            value={String(catalog?.mapped ?? 0)}
          />
          <Metric
            label="Pendentes"
            value={String(catalog?.missing.length ?? 0)}
          />
        </div>

        <div className="mt-5 space-y-3">
          {profiles?.items.map((item) => (
            <div
              key={item.slug}
              className="rounded-2xl border border-stone-100 p-4"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-sm font-bold text-stone-900">
                    {item.name}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-stone-400">
                    {item.sku} ·{" "}
                    {item.mapped
                      ? `Bling #${item.blingProductId}`
                      : "Pendente no Bling"}
                  </p>
                </div>
                <div className="grid flex-1 gap-2 sm:grid-cols-3 lg:max-w-3xl lg:grid-cols-5">
                  <Field
                    label="NCM"
                    value={item.profile.ncm}
                    onChange={(v) => updateProduct(item.slug, { ncm: v })}
                  />
                  <Field
                    label="Origem"
                    value={String(item.profile.origem)}
                    onChange={(v) =>
                      updateProduct(item.slug, { origem: Number(v) })
                    }
                  />
                  <Field
                    label="CEST"
                    value={item.profile.cest ?? ""}
                    onChange={(v) => updateProduct(item.slug, { cest: v })}
                  />
                  <Field
                    label="Preço R$"
                    value={String(item.profile.preco)}
                    onChange={(v) =>
                      updateProduct(item.slug, {
                        preco: Number(v.replace(",", ".")),
                      })
                    }
                  />
                  <Field
                    label="Peso kg"
                    value={String(item.profile.pesoLiquido)}
                    onChange={(v) =>
                      updateProduct(item.slug, {
                        pesoLiquido: Number(v.replace(",", ".")),
                        pesoBruto: Number(v.replace(",", ".")),
                      })
                    }
                  />
                </div>
                <button
                  type="button"
                  onClick={() => void saveProductProfile(item.slug)}
                  disabled={savingSlug === item.slug}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-bold text-stone-700"
                >
                  {savingSlug === item.slug ? (
                    <LoaderCircle size={14} className="animate-spin" />
                  ) : (
                    <Save size={14} />
                  )}{" "}
                  Salvar
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#087568]/10 bg-[#F3FAF7] p-5">
        <p className="text-[10px] font-extrabold uppercase tracking-[.14em] text-[#087568]">
          Próxima ação operacional
        </p>
        <p className="mt-2 text-base font-bold text-stone-900">
          {!connected
            ? "Conectar o Bling."
            : !catalogReady
              ? "Revisar a parametrização e criar os produtos ausentes pelo BBOS."
              : "Catálogo pronto para o primeiro pedido WEB controlado."}
        </p>
        {!profiles?.companyProfile.validatedByAccountant && (
          <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <AlertTriangle size={16} /> Antes da primeira NF-e real, validar
            CST/CFOP/PIS/COFINS com a contabilidade.
          </p>
        )}
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

function ConnectorCard({
  name,
  description,
  icon,
  tone,
  data,
  connectHref,
  actionLabel,
  detailsHref,
}: {
  name: string;
  description: string;
  icon: ReactNode;
  tone: "violet" | "yellow" | "green" | "blue";
  data?: IntegrationOverview["providers"][number];
  connectHref?: string;
  actionLabel?: string;
  detailsHref?: string;
}) {
  const connected = data?.connection.status === "CONNECTED";
  const attention = Boolean(
    data?.connection.lastError ||
      data?.activity.failed ||
      data?.activity.webhookErrors,
  );
  const signalAt =
    data?.connection.lastSyncAt ??
    data?.activity.lastWebhookAt ??
    data?.connection.connectedAt;
  const colors = {
    violet: "bg-violet-50 text-violet-700",
    yellow: "bg-[#FFF7CC] text-[#665600]",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
  }[tone];
  const status = !data
    ? "Verificando"
    : !data.configured
      ? "Configuração pendente"
      : connected
        ? attention
          ? "Conectado · atenção"
          : "Conectado"
        : data.connection.status === "CONNECTING"
          ? "Conectando"
          : "Não conectado";

  return (
    <div
      className={`flex min-h-64 flex-col rounded-[24px] border bg-white p-5 shadow-sm ${
        attention ? "border-red-200" : "border-stone-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-10 place-items-center rounded-2xl ${colors}`}>
          {icon}
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-extrabold uppercase tracking-[.06em] ${
            attention
              ? "bg-red-50 text-red-700"
              : connected
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-4 text-sm font-bold text-stone-900">{name}</p>
      <p className="mt-1 text-xs leading-5 text-stone-400">{description}</p>

      <div className="mt-4 space-y-2 text-[11px] text-stone-500">
        <div className="flex items-center justify-between gap-3">
          <span>Último sinal</span>
          <span className="text-right font-semibold text-stone-700">
            {signalAt ? new Date(signalAt).toLocaleString("pt-BR") : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span>Fila / falhas</span>
          <span className="font-semibold text-stone-700">
            {data ? `${data.activity.pending} / ${data.activity.failed}` : "—"}
          </span>
        </div>
      </div>

      {data?.connection.lastError && (
        <p className="mt-3 line-clamp-3 rounded-xl bg-red-50 p-3 text-[10px] leading-4 text-red-700">
          {data.connection.lastError}
        </p>
      )}

      <div className="mt-auto pt-4">
        {connected && detailsHref ? (
          <Link
            href={detailsHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 px-3 py-2.5 text-xs font-bold text-stone-700"
          >
            Abrir operação <ExternalLink size={13} />
          </Link>
        ) : !connected && data?.configured && connectHref ? (
          <a
            href={connectHref}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-stone-900 px-3 py-2.5 text-xs font-bold text-white"
          >
            {actionLabel ?? "Conectar"} <ExternalLink size={13} />
          </a>
        ) : !data?.configured && data ? (
          <p className="rounded-xl bg-stone-50 px-3 py-2.5 text-center text-[10px] font-semibold text-stone-500">
            Credenciais do ambiente ainda não configuradas.
          </p>
        ) : (
          <p className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-[10px] font-bold text-emerald-700">
            <CheckCircle2 size={13} /> Operação disponível
          </p>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[9px] font-bold uppercase tracking-[.08em] text-stone-400">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-xs text-stone-800 outline-none focus:border-[#087568]"
      />
    </label>
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
      <p className="text-[10px] font-bold uppercase tracking-[.12em] text-stone-400">
        {title}
      </p>
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
          <span className="text-xs text-stone-400">
            Nenhum evento registrado.
          </span>
        )}
      </div>
    </div>
  );
}
