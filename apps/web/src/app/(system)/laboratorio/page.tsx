"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, FlaskConical, X } from "lucide-react";
import { Badge, Button, Card, HumanEmptyState } from "@bbos/ui";
import { getApiBaseUrl } from "@/lib/api-url";

type Sample = {
  id: string;
  sampleNumber: string;
  status: string;
  createdAt: string;
  receipt: {
    id: string;
    receiptNumber: string;
    confirmedAt: string;
    netWeightKg: number;
    qualityStatus: string;
    qualityNotes?: string | null;
  };
  supplier: { name: string };
  origin: {
    farmName?: string | null;
    municipality?: string | null;
    state?: string | null;
    region?: string | null;
    harvest?: string | null;
    species: string;
    variety?: string | null;
    process?: string | null;
  };
  lot: {
    id: string;
    code: string;
    status: string;
    qualityScore?: number | null;
  };
  contract: {
    purchaseNumber: string;
    contractedWeightKg: number;
    maxMoisturePercent?: number | null;
    maxDefects?: number | null;
    minimumScore?: number | null;
    contractedScreen?: string | null;
  } | null;
  measured: {
    moisturePercent?: number | null;
    defects?: number | null;
    screen?: string | null;
    score?: number | null;
  };
  comparison: {
    issues: string[];
    withinContract: boolean;
    moisture?: { contracted: number; measured: number; difference: number };
    defects?: { contracted: number; measured: number; difference: number };
    score?: { contracted: number; measured: number; difference: number };
    screen?: { contracted: string; measured: string; within: boolean };
  };
};

const api = `${getApiBaseUrl()}/receipts`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message ?? "Não foi possível carregar as amostras.");
  return body as T;
}

const statusLabel: Record<string, string> = {
  PENDING: "Pendente",
  IN_ANALYSIS: "Em análise",
  COMPLETED: "Concluída",
  REJECTED: "Reprovada",
};
const qualityLabel: Record<string, string> = {
  AWAITING_ANALYSIS: "Aguardando análise",
  APPROVED: "Aprovado",
  APPROVED_WITH_RESTRICTION: "Aprovado com ressalva",
  REJECTED: "Reprovado",
  BLOCKED: "Bloqueado",
};

function SampleDrawer({
  sample,
  close,
  reload,
}: {
  sample: Sample;
  close: () => void;
  reload: () => void;
}) {
  const [qualityStatus, setQualityStatus] = useState(
    sample.receipt.qualityStatus,
  );
  const [moisturePercent, setMoisturePercent] = useState(
    sample.measured.moisturePercent?.toString() ?? "",
  );
  const [defects, setDefects] = useState(
    sample.measured.defects?.toString() ?? "",
  );
  const [screen, setScreen] = useState(sample.measured.screen ?? "");
  const [score, setScore] = useState(sample.measured.score?.toString() ?? "");
  const [notes, setNotes] = useState(sample.receipt.qualityNotes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      await request(`${api}/lab-samples/${sample.id}/analysis`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qualityStatus,
          moisturePercent: moisturePercent
            ? Number(moisturePercent)
            : undefined,
          defects: defects ? Number(defects) : undefined,
          screen: screen || undefined,
          score: score ? Number(score) : undefined,
          notes: notes || undefined,
        }),
      });
      reload();
      close();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Não foi possível salvar a análise.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-forest-950/30 p-3">
      <aside className="ml-auto flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
        <header className="flex items-start justify-between border-b p-6">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">
              Amostra {sample.sampleNumber}
            </p>
            <h2 className="mt-2 text-2xl font-bold">{sample.supplier.name}</h2>
            <p className="mt-1 text-sm text-stone-500">
              {sample.receipt.receiptNumber} · lote {sample.lot.code}
            </p>
          </div>
          <button aria-label="Fechar" onClick={close}>
            <X />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">
          <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
              Contexto contratado
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <span>
                Compra{" "}
                <b className="block">
                  {sample.contract?.purchaseNumber ?? "—"}
                </b>
              </span>
              <span>
                Recebido{" "}
                <b className="block">
                  {sample.receipt.netWeightKg.toLocaleString("pt-BR")} kg
                </b>
              </span>
              <span>
                Origem{" "}
                <b className="block">
                  {sample.origin.farmName ?? "—"} ·{" "}
                  {sample.origin.municipality ?? "—"}/
                  {sample.origin.state ?? "—"}
                </b>
              </span>
              <span>
                Café{" "}
                <b className="block">
                  {sample.origin.species} · {sample.origin.variety ?? "—"}
                </b>
              </span>
              <span>
                Safra <b className="block">{sample.origin.harvest ?? "—"}</b>
              </span>
              <span>
                Processo <b className="block">{sample.origin.process ?? "—"}</b>
              </span>
            </div>
          </Card>
          <Card className="mt-4 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-stone-400">
              Comparação automática
            </p>
            <div className="mt-3 space-y-2 text-sm">
              {sample.comparison.moisture && (
                <p>
                  Umidade: {sample.comparison.moisture.measured}% medida ·
                  máximo {sample.comparison.moisture.contracted}% · diferença{" "}
                  {sample.comparison.moisture.difference.toFixed(1)} p.p.
                </p>
              )}
              {sample.comparison.defects && (
                <p>
                  Defeitos: {sample.comparison.defects.measured} encontrados ·
                  máximo {sample.comparison.defects.contracted}
                </p>
              )}
              {sample.comparison.score && (
                <p>
                  Pontuação: {sample.comparison.score.measured} obtida · mínimo{" "}
                  {sample.comparison.score.contracted}
                </p>
              )}
              {sample.comparison.screen && (
                <p>
                  Peneira: {sample.comparison.screen.measured} observada ·
                  contratada {sample.comparison.screen.contracted}
                </p>
              )}
              {sample.comparison.withinContract ? (
                <p className="font-semibold text-forest-800">
                  Este lote atende ao padrão contratado.
                </p>
              ) : (
                <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
                  <b>
                    Há {sample.comparison.issues.length} divergência(s) que
                    precisam da sua atenção.
                  </b>
                  {sample.comparison.issues.map((issue) => (
                    <p key={issue} className="mt-1 text-xs">
                      {issue}
                    </p>
                  ))}
                </div>
              )}
            </div>
          </Card>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-xs font-semibold">
              Umidade medida (%)
              <input
                type="number"
                step=".1"
                value={moisturePercent}
                onChange={(e) => setMoisturePercent(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold">
              Defeitos encontrados
              <input
                type="number"
                min="0"
                value={defects}
                onChange={(e) => setDefects(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold">
              Peneira/classificação
              <input
                value={screen}
                onChange={(e) => setScreen(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold">
              Pontuação
              <input
                type="number"
                step=".1"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              />
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              Decisão de qualidade
              <select
                value={qualityStatus}
                onChange={(e) => setQualityStatus(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              >
                <option value="APPROVED">Aprovado</option>
                <option value="APPROVED_WITH_RESTRICTION">
                  Aprovado com ressalva
                </option>
                <option value="REJECTED">Reprovado</option>
              </select>
            </label>
            <label className="text-xs font-semibold sm:col-span-2">
              Observações técnicas
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="mt-1 min-h-24 w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm"
              />
            </label>
          </div>
          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </main>
        <footer className="flex justify-end gap-3 border-t p-4">
          <Button
            onClick={close}
            className="border border-stone-200 bg-white text-stone-700"
          >
            Cancelar
          </Button>
          <Button disabled={busy} onClick={submit}>
            {busy ? "Salvando..." : "Concluir análise"}
          </Button>
        </footer>
      </aside>
    </div>
  );
}

export default function LaboratorioPage() {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<Sample | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    request<Sample[]>(`${api}/lab-samples`)
      .then(setSamples)
      .catch((e) =>
        setError(
          e instanceof Error
            ? e.message
            : "Não foi possível carregar o laboratório.",
        ),
      );
  useEffect(() => {
    void load();
  }, []);
  const visible = useMemo(
    () =>
      samples.filter((sample) => {
        if (filter === "pending") return sample.status === "PENDING";
        if (filter === "analysis") return sample.status === "IN_ANALYSIS";
        if (filter === "approved")
          return (
            sample.receipt.qualityStatus === "APPROVED" ||
            sample.receipt.qualityStatus === "APPROVED_WITH_RESTRICTION"
          );
        if (filter === "rejected")
          return sample.receipt.qualityStatus === "REJECTED";
        if (filter === "completed")
          return sample.status === "COMPLETED" || sample.status === "REJECTED";
        return true;
      }),
    [samples, filter],
  );
  const tabs = [
    ["pending", "Pendentes"],
    ["analysis", "Em análise"],
    ["completed", "Concluídas"],
    ["approved", "Aprovadas"],
    ["rejected", "Reprovadas"],
  ] as const;
  return (
    <div className="mx-auto max-w-[1480px]">
      <header>
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.14em] text-forest-700">
          <FlaskConical size={15} /> Qualidade do café verde
        </p>
        <h1 className="mt-2 text-3xl font-bold">Laboratório</h1>
        <p className="mt-2 text-sm text-stone-500">
          Amostras recebidas, comparação contratual e liberação de lotes.
        </p>
      </header>
      {error && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-7 flex flex-wrap gap-2">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`min-h-10 rounded-xl px-4 text-sm font-semibold ${filter === value ? "bg-forest-900 text-white" : "border bg-white text-stone-700"}`}
          >
            {label} ·{" "}
            {
              samples.filter((sample) =>
                value === "pending"
                  ? sample.status === "PENDING"
                  : value === "analysis"
                    ? sample.status === "IN_ANALYSIS"
                    : value === "approved"
                      ? ["APPROVED", "APPROVED_WITH_RESTRICTION"].includes(
                          sample.receipt.qualityStatus,
                        )
                      : value === "rejected"
                        ? sample.receipt.qualityStatus === "REJECTED"
                        : ["COMPLETED", "REJECTED"].includes(sample.status),
              ).length
            }
          </button>
        ))}
      </div>
      <section className="mt-6 space-y-3">
        {visible.map((sample) => (
          <button
            key={sample.id}
            onClick={() => setSelected(sample)}
            className="w-full text-left"
          >
            <Card className="p-5 transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-forest-700">
                    {sample.sampleNumber} · {sample.receipt.receiptNumber}
                  </p>
                  <h2 className="mt-1 text-lg font-bold">
                    {sample.supplier.name}
                  </h2>
                  <p className="mt-1 text-sm text-stone-500">
                    {sample.origin.farmName ?? "Fazenda não informada"} ·{" "}
                    {sample.origin.species} ·{" "}
                    {sample.origin.variety ?? "Cultivar não informada"} · Safra{" "}
                    {sample.origin.harvest ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-stone-500">
                    {new Date(sample.createdAt).toLocaleString("pt-BR")}
                  </span>
                  <Badge
                    tone={
                      sample.receipt.qualityStatus === "REJECTED"
                        ? "danger"
                        : sample.receipt.qualityStatus === "AWAITING_ANALYSIS"
                          ? "warning"
                          : "success"
                    }
                  >
                    {qualityLabel[sample.receipt.qualityStatus] ??
                      statusLabel[sample.status] ??
                      sample.status}
                  </Badge>
                </div>
              </div>
              <p className="mt-3 text-xs text-stone-500">
                Lote {sample.lot.code} · {sample.origin.municipality ?? "—"}/
                {sample.origin.state ?? "—"} ·{" "}
                {sample.receipt.netWeightKg.toLocaleString("pt-BR")} kg
              </p>
            </Card>
          </button>
        ))}
        {visible.length === 0 && (
          <HumanEmptyState title="Nenhuma amostra nesta fila." description="As próximas amostras aparecerão quando um recebimento for encaminhado para análise." />
        )}
      </section>
      {selected && (
        <SampleDrawer
          sample={selected}
          close={() => setSelected(null)}
          reload={load}
        />
      )}
    </div>
  );
}
