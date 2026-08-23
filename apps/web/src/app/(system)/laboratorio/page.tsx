"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Coffee, FlaskConical, GraduationCap, Layers, Plus, X } from "lucide-react";
import { Badge, Button, Card } from "@bbos/ui";
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
const professionalApi = `${getApiBaseUrl()}/professional-samples`;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "include", ...init });
  const body = await response.json().catch(() => ({}));
  if (!response.ok)
    throw new Error(body.message ?? "Não foi possível carregar as amostras.");
  return body as T;
}

type SupplierOption = { id: string; name: string; originUnits: { id: string; name: string; state: string; municipality?: string | null; coffeeRegion?: { name: string } | null }[] };
type ProfessionalSample = { id: string; code: string; source: string; status: string; supplier?: { name: string } | null; originUnit?: { name: string } | null; harvest?: string | null; species?: string | null; cultivar?: string | null; process?: string | null; evaluations: { score?: number | null }[] };

function NewSessionChooser({ close, offer, professional, training }: { close: () => void; offer: () => void; professional: () => void; training: () => void }) {
  const choices = [
    { title: "Amostra de oferta", text: "Avaliar um café antes da compra.", flow: "Oferta → Cupping → Resultado → Aprovar para compra", icon: Coffee, action: offer, tone: "border-amber-200 bg-amber-50" },
    { title: "Lote / avaliação profissional", text: "Avaliar um café ligado à operação.", flow: "Recebimento → Cupping → Decisão operacional", icon: Layers, action: professional, tone: "border-sky-200 bg-sky-50" },
    { title: "Treinamento & calibração", text: "Treinar percepção e comparar resultados.", flow: "Sessão → Prova → Comparação → Aprendizado", icon: GraduationCap, action: training, tone: "border-violet-200 bg-violet-50" },
  ];
  return <div className="fixed inset-0 z-50 bg-black/30 p-3"><section role="dialog" aria-modal="true" className="mx-auto mt-8 max-h-[calc(100%-4rem)] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-xl sm:p-7"><div className="flex items-start justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Nova sessão</p><h2 className="mt-2 text-2xl font-bold">O que vamos avaliar hoje?</h2><p className="mt-1 text-sm text-stone-500">Escolha o caminho. O BBOS conduz o restante.</p></div><button type="button" onClick={close} aria-label="Fechar"><X /></button></div><div className="mt-6 grid gap-3">{choices.map(({ title, text, flow, icon: Icon, action, tone }) => <button type="button" key={title} onClick={action} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${tone}`}><div className="flex items-start gap-3"><span className="rounded-xl bg-white p-2"><Icon size={20} /></span><span><strong className="block text-base">{title}</strong><span className="mt-1 block text-sm text-stone-600">{text}</span><span className="mt-3 block text-xs font-semibold text-stone-500">{flow}</span></span></div></button>)}</div><p className="mt-5 text-center text-xs text-stone-500">Training não aprova lotes nem movimenta estoque.</p></section></div>;
}

function SessionEntryCards({ offer, professional, training }: { offer: () => void; professional: () => void; training: () => void }) {
  return <section aria-label="Escolha o tipo de sessão" className="mt-6 grid gap-3 md:grid-cols-3"><button type="button" onClick={offer} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center gap-2 font-bold"><Coffee size={18} /> Amostra de oferta</div><p className="mt-2 text-sm text-stone-600">Avaliar um café antes da compra.</p></button><button type="button" onClick={professional} className="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center gap-2 font-bold"><Layers size={18} /> Lote / avaliação profissional</div><p className="mt-2 text-sm text-stone-600">Avaliar um café ligado à operação.</p></button><button type="button" onClick={training} className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md"><div className="flex items-center gap-2 font-bold"><GraduationCap size={18} /> Training & calibração</div><p className="mt-2 text-sm text-stone-600">Treinar percepção e calibrar a equipe.</p></button></section>;
}

function OfferSampleForm({ close, saved }: { close: () => void; saved: () => void }) {
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [originUnitId, setOriginUnitId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void request<SupplierOption[]>(`${professionalApi}/options`).then(setSuppliers).catch((e) => setError(e instanceof Error ? e.message : "Não foi possível carregar fornecedores.")); }, []);
  const supplier = suppliers.find((item) => item.id === supplierId);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const payload = {
        source: "OFFER", supplierId, originUnitId: originUnitId || undefined,
        contactName: data.get("contactName"), country: data.get("country"), state: data.get("state"), municipality: data.get("municipality"), region: data.get("region"), harvest: data.get("harvest"), species: data.get("species"), cultivar: data.get("cultivar"), process: data.get("process"), screen: data.get("screen"),
        informedDefects: data.get("informedDefects") ? Number(data.get("informedDefects")) : undefined,
        informedMoisture: data.get("informedMoisture") ? Number(data.get("informedMoisture")) : undefined,
        supplierLotCode: data.get("supplierLotCode"), receivedAt: data.get("receivedAt") || undefined, notes: data.get("notes"),
      };
      await request(`${professionalApi}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      saved(); close();
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível registrar a amostra."); } finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 bg-black/30 p-3"><form onSubmit={submit} className="mx-auto flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl"><header className="flex items-center justify-between border-b p-5"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Amostra de oferta</p><h2 className="mt-1 text-xl font-bold">Registrar café antes da compra</h2></div><button type="button" onClick={close} aria-label="Fechar"><X /></button></header><main className="grid flex-1 gap-3 overflow-y-auto p-5 sm:grid-cols-2"><label className="text-sm font-semibold sm:col-span-2">Fornecedor<select required value={supplierId} onChange={(e) => { setSupplierId(e.target.value); setOriginUnitId(""); }} className="mt-1 w-full rounded-xl border p-3"><option value="">Selecione</option>{suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Fazenda/unidade<select value={originUnitId} onChange={(e) => setOriginUnitId(e.target.value)} className="mt-1 w-full rounded-xl border p-3"><option value="">Não informada</option>{supplier?.originUnits.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className="text-sm font-semibold">Contato<input name="contactName" className="mt-1 w-full rounded-xl border p-3" /></label>{["country:País", "state:Estado", "municipality:Município", "region:Região cafeeira", "harvest:Safra", "species:Espécie", "cultivar:Cultivar", "process:Processo", "screen:Peneira", "supplierLotCode:Lote do fornecedor", "receivedAt:Data de recebimento"].map((entry) => { const [name, label] = entry.split(":"); return <label key={name} className="text-sm font-semibold">{label}<input name={name} type={name === "receivedAt" ? "date" : "text"} className="mt-1 w-full rounded-xl border p-3" /></label>; })}<label className="text-sm font-semibold">Defeitos informados<input name="informedDefects" type="number" min="0" className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm font-semibold">Umidade informada (%)<input name="informedMoisture" type="number" step=".1" min="0" className="mt-1 w-full rounded-xl border p-3" /></label><label className="text-sm font-semibold sm:col-span-2">Observações<textarea name="notes" className="mt-1 min-h-20 w-full rounded-xl border p-3" /></label>{error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">{error}</p>}</main><footer className="flex justify-end gap-2 border-t p-4"><Button type="button" onClick={close} className="border bg-white text-stone-700">Cancelar</Button><Button type="submit" disabled={busy}>{busy ? "Salvando..." : "Registrar amostra"}</Button></footer></form></div>;
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
  const [professionalSamples, setProfessionalSamples] = useState<ProfessionalSample[]>([]);
  const [offerForm, setOfferForm] = useState(false);
  const [newSessionChooser, setNewSessionChooser] = useState(false);
  const [filter, setFilter] = useState("pending");
  const [selected, setSelected] = useState<Sample | null>(null);
  const [error, setError] = useState("");
  const load = () =>
    Promise.all([request<Sample[]>(`${api}/lab-samples`), request<ProfessionalSample[]>(professionalApi)])
      .then(([received, professional]) => { setSamples(received); setProfessionalSamples(professional); })
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
        <h1 className="mt-2 text-3xl font-bold">Laboratório &amp; Cupping</h1>
      <p className="mt-2 text-sm text-stone-500">
        Avalie cafés, tome decisões de qualidade ou treine sua percepção.
      </p>
      <Button onClick={() => setNewSessionChooser(true)} className="mt-4"><Plus size={16} /> Nova sessão</Button>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href="/laboratorio/cupping" className="inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold">Histórico</Link>
        <Link href="/laboratorio/cupping-training" className="inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold">Training & calibração</Link>
      </div>
      <SessionEntryCards offer={() => setOfferForm(true)} professional={() => { window.location.href = "/laboratorio/cupping"; }} training={() => { window.location.href = "/laboratorio/cupping-training"; }} />
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
          <Card className="p-10 text-center text-sm text-stone-500">
            <Check className="mx-auto text-forest-700" />
            <p className="mt-3 font-semibold">Nenhuma amostra esperando por você.</p>
            <p className="mt-1">Você pode avaliar uma oferta, analisar um lote recebido ou iniciar uma sessão de treinamento.</p>
          </Card>
        )}
      </section>
      <section className="mt-8">
        <div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-bold uppercase tracking-[.14em] text-forest-700">Cupping profissional</p><h2 className="mt-1 text-xl font-bold">Amostras de oferta</h2></div><span className="text-sm text-stone-500">{professionalSamples.length} registradas</span></div>
        {professionalSamples.length === 0 ? <Card className="p-8 text-center text-sm text-stone-500"><p className="font-semibold">Nenhuma amostra esperando por você.</p><p className="mt-1">Registre uma oferta antes da compra ou analise um lote recebido.</p></Card> : <div className="grid gap-3 lg:grid-cols-2">{professionalSamples.filter((item) => item.source === "OFFER").map((item) => <Card key={item.id} className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-forest-700">{item.code} · Amostra de oferta</p><h3 className="mt-1 font-bold">{item.supplier?.name ?? "Fornecedor não informado"}</h3><p className="mt-1 text-sm text-stone-500">{item.originUnit?.name ?? "Origem não informada"} · {item.species ?? "—"} · {item.cultivar ?? "—"} · Safra {item.harvest ?? "—"}</p></div><Badge tone={item.status === "APPROVED_FOR_PURCHASE" ? "success" : item.status === "REJECTED" ? "danger" : "warning"}>{item.status === "APPROVED_FOR_PURCHASE" ? "Aprovada para compra" : item.status === "IN_ANALYSIS" ? "Em análise" : item.status === "EVALUATED" ? "Avaliada" : item.status === "REJECTED" ? "Reprovada" : "Recebida"}</Badge></div><div className="mt-3 flex flex-wrap gap-2"><Link href={`/laboratorio/cupping-profissional/${encodeURIComponent(item.id)}`} className="inline-flex min-h-10 items-center rounded-xl border px-4 text-sm font-semibold">Abrir cupping</Link>{item.status === "APPROVED_FOR_PURCHASE" && <Link href={`/compras-cafe-verde-v2?sampleId=${encodeURIComponent(item.id)}`} className="inline-flex min-h-10 items-center rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">Usar em nova compra</Link>}</div></Card>)}</div>}
      </section>
      {selected && (
        <SampleDrawer
          sample={selected}
          close={() => setSelected(null)}
          reload={load}
        />
      )}
      {offerForm && <OfferSampleForm close={() => setOfferForm(false)} saved={() => setError("")} />}
      {newSessionChooser && <NewSessionChooser close={() => setNewSessionChooser(false)} offer={() => { setNewSessionChooser(false); setOfferForm(true); }} professional={() => { window.location.href = "/laboratorio/cupping"; }} training={() => { window.location.href = "/laboratorio/cupping-training"; }} />}
    </div>
  );
}
