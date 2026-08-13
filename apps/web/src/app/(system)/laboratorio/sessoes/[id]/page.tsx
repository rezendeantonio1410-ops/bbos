"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import {
  Check,
  Copy,
  ExternalLink,
  FlaskConical,
  Lock,
  QrCode,
  ShieldCheck,
} from "lucide-react";
import { Badge, Card } from "@bbos/ui";
import { SensoryWheelHint } from "@/components/sensory-illustrated-wheel";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export default function SessionDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = React.useState<any>(null);
  const [busy, setBusy] = React.useState(false);
  const [notice, setNotice] = React.useState("");
  const [decisionNotes, setDecisionNotes] = React.useState<Record<string, string>>({});
  const [invitations, setInvitations] = React.useState<any[]>([]);

  const load = React.useCallback(() => {
    if (params.id)
      fetch(`${API}/laboratory/sessions/${params.id}`)
        .then((response) => (response.ok ? response.json() : null))
        .then(setData)
        .catch(() => setData(null));
  }, [params.id]);
  React.useEffect(() => {
    load();
  }, [load]);

  if (!data)
    return (
      <div className="mx-auto max-w-[1200px]">
        <p className="text-sm text-stone-500">Carregando sessão...</p>
      </div>
    );
  const progress = data.progress;
  const completed = progress?.participants?.filter((item: any) => item.state === "COMPLETED").length ?? 0;
  const allCompleted =
    data.status === "CONSOLIDATING" ||
    data.status === "CLOSED" ||
    progress?.overall?.state === "COMPLETED";

  async function copyLink(link: string) {
    await navigator.clipboard?.writeText(link);
    setNotice("Link copiado para a área de transferência.");
    window.setTimeout(() => setNotice(""), 2600);
  }
  async function release() {
    setBusy(true);
    setNotice("");
    const response = await fetch(`${API}/cupping/sessions/${data.id}/release`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": data.coordinatorId },
      body: JSON.stringify({ baseUrl: window.location.origin }),
    });
    const result = await response.json().catch(() => null);
    setBusy(false);
    if (!response.ok) {
      setNotice(result?.message ?? "Não foi possível liberar a sessão.");
      return;
    }
    setInvitations(Array.isArray(result) ? result : []);
    setNotice("Sessão liberada. Os links abertos são exibidos somente agora.");
    load();
  }
  async function consolidate() {
    setBusy(true);
    setNotice("");
    const response = await fetch(
      `${API}/laboratory/sessions/${data.id}/consolidate`,
      { method: "POST" },
    );
    setBusy(false);
    if (!response.ok) {
      setNotice("Não foi possível consolidar. Verifique se todos concluíram.");
      return;
    }
    setNotice(
      "Avaliações consolidadas. Escolha a decisão operacional do lote.",
    );
    load();
  }
  async function decide(
    sample: any,
    decision:
      "APPROVED" | "APPROVED_WITH_OBSERVATION" | "RETEST_REQUIRED" | "REJECTED",
  ) {
    const notes = decisionNotes[sample.id]?.trim() ?? "";
    if (decision !== "APPROVED" && !notes) {
      setNotice(
        "Informe o motivo ou observação antes de registrar esta decisão.",
      );
      return;
    }
    setBusy(true);
    await fetch(`${API}/laboratory/sessions/${data.id}/decision`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sampleId: sample.id,
        lotId: sample.lotId,
        companyId: data.companyId,
        decision,
        decisionById: data.coordinatorId,
        notes:
          decision === "APPROVED"
            ? "Liberado após consolidação da sessão."
            : notes,
      }),
    });
    setBusy(false);
    setNotice("Decisão registrada com rastreabilidade.");
    load();
  }

  return (
    <div className="mx-auto max-w-[1200px] pb-10">
      <Link
        href="/laboratorio/sessoes"
        className="text-xs font-bold text-forest-700"
      >
        ← Sessões
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.16em] text-forest-700">
            Sessão do coordenador
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{data.code}</h1>
            <SensoryWheelHint
              mode={data.mode === "TRAINING" ? "TRAINING" : "CUPPING"}
            />
          </div>
          <p className="mt-2 text-sm text-stone-500">
            Protocolo {data.protocol} · avaliações individuais protegidas até a
            consolidação.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-stone-500">
            {completed} de {data.participants?.length ?? 0} provadores
            concluíram
          </span>
          <Badge tone={data.status === "CLOSED" ? "success" : "warning"}>
            {data.status}
          </Badge>
        </div>
      </header>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                Amostra selecionada
              </p>
              <h2 className="mt-1 text-lg font-bold">Amostras da sessão</h2>
            </div>
            <FlaskConical size={19} className="text-forest-700" />
          </div>
          <div className="mt-4 space-y-2">
            {data.samples.map((item: any) => (
              <div
                key={item.id}
                className="rounded-xl border border-stone-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <strong className="text-sm">{item.sample.sampleCode}</strong>
                  <Badge
                    tone={
                      item.sample.status === "APPROVED" ? "success" : "neutral"
                    }
                  >
                    {item.sample.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-stone-500">
                  Lote {item.sample.lot?.code ?? "—"} ·{" "}
                  {item.sample.lot?.origin ?? "Origem não informada"} ·{" "}
                  {item.sample.lot?.variety ?? "Variedade não informada"}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  Processo: {item.sample.lot?.process ?? "Não informado"} ·
                  Safra: {item.sample.lot?.harvest ?? "—"}
                </p>
                {(() => {
                  const itemProgress = progress?.samples?.find((row: any) => row.sampleId === item.sampleId);
                  return <div className="mt-3"><div className="flex justify-between text-[10px] font-bold text-stone-500"><span>{itemProgress?.completed ?? 0}/{itemProgress?.total ?? 0} avaliações concluídas</span><span>{itemProgress?.percent ?? 0}%</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-forest-700" style={{ width: `${itemProgress?.percent ?? 0}%` }} /></div></div>;
                })()}
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
                Acesso mobile
              </p>
              <h2 className="mt-1 text-lg font-bold">Liberar para prova</h2>
            </div>
            <QrCode size={19} className="text-forest-700" />
          </div>
          <p className="mt-3 text-xs leading-5 text-stone-500">
            É criado um convite individual, expirável e revogável. Somente o
            hash permanece no banco.
          </p>
          <button
            disabled={busy || !data.participants?.length}
            onClick={release}
            className="mt-4 min-h-11 w-full rounded-xl bg-forest-900 px-4 text-xs font-bold text-white disabled:opacity-40"
          >
            Liberar para prova
          </button>
          <div className="mt-4 space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="rounded-xl border border-stone-200 p-3"
              >
                <div className="flex gap-3">
                  <Image
                    src={invitation.qrCode}
                    alt={`QR de ${invitation.participant}`}
                    width={96}
                    height={96}
                    unoptimized
                    className="h-24 w-24 rounded-lg"
                  />
                  <div className="min-w-0 flex-1">
                    <strong className="text-xs">
                      {invitation.participant}
                    </strong>
                    <p className="mt-1 truncate text-[10px] text-stone-500">
                      {invitation.link}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => copyLink(invitation.link)}
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold"
                      >
                        <Copy size={12} /> Copiar
                      </button>
                      <a
                        href={invitation.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex min-h-9 items-center gap-1 rounded-lg border px-2 text-[10px] font-bold"
                      >
                        <ExternalLink size={12} /> Abrir
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {notice && (
            <p className="mt-3 text-xs font-semibold text-forest-700">
              {notice}
            </p>
          )}
        </Card>
      </div>

      <Card className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
              Provadores e progresso
            </p>
            <h2 className="mt-1 text-lg font-bold">Acompanhamento protegido</h2>
          </div>
          <ShieldCheck size={19} className="text-forest-700" />
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2">
          {data.participants.map((participant: any) => {
            const itemProgress = progress?.participants?.find((item: any) => item.participantId === participant.id);
            const done = itemProgress?.state === "COMPLETED";
            const started = itemProgress?.state === "IN_PROGRESS";
            return (
              <div
                key={participant.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 p-3 text-xs"
              >
                <span>
                  <strong>{participant.user.name}</strong>
                  <span className="ml-2 text-stone-500">
                    {participant.role}
                  </span>
                </span>
                <span className="flex items-center gap-2"><span className="text-stone-500">{itemProgress?.completed ?? 0}/{itemProgress?.total ?? 0}</span><Badge tone={done ? "success" : started ? "warning" : "neutral"}>
                  {done
                    ? "CONCLUÍDO"
                    : started
                      ? "EM ANDAMENTO"
                      : "NÃO INICIADO"}
                </Badge></span>
              </div>
            );
          })}
        </div>
        <p className="mt-4 flex items-center gap-2 text-xs text-stone-500">
          <Lock size={13} /> Notas individuais permanecem privadas enquanto a
          sessão estiver aberta.
        </p>
      </Card>

      <Card className="mt-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-forest-700">
              Encerramento
            </p>
            <h2 className="mt-1 text-lg font-bold">Consolidar e decidir</h2>
            <div className="mt-3 flex items-center gap-3"><div className="h-2 w-48 overflow-hidden rounded-full bg-stone-100"><div className="h-full bg-forest-700" style={{ width: `${progress?.overall?.percent ?? 0}%` }} /></div><strong className="text-xs">{progress?.overall?.completed ?? 0}/{progress?.overall?.total ?? 0} · {progress?.overall?.percent ?? 0}%</strong></div>
            <p className="mt-1 text-xs text-stone-500">
              {["OPEN", "IN_PROGRESS"].includes(data.status) && !allCompleted
                ? `Aguarde ${Math.max((data.participants?.length ?? 0) - completed, 0)} provador(es) concluírem.`
                : data.status === "CLOSED"
                  ? "Sessão encerrada e auditável."
                  : "Todos os provadores concluíram. A consolidação está disponível."}
            </p>
          </div>
          <button
            disabled={busy || !["OPEN", "IN_PROGRESS"].includes(data.status) || !allCompleted}
            onClick={consolidate}
            className="inline-flex items-center gap-2 rounded-xl bg-forest-900 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={14} /> Encerrar e consolidar sessão
          </button>
        </div>
        {data.status === "CONSOLIDATING" && (
          <div className="mt-5 space-y-4 border-t border-stone-100 pt-4">
            {data.samples.map((item: any) => {
              const decided = data.decisions?.find((decision: any) => decision.sampleId === item.sampleId);
              return <div key={item.sampleId} className="rounded-xl border border-stone-200 p-4"><div className="flex items-center justify-between"><strong>{item.sample.sampleCode}</strong>{decided && <Badge tone="success">{decided.decision}</Badge>}</div>{!decided && <><textarea value={decisionNotes[item.sampleId] ?? ""} onChange={(event) => setDecisionNotes((current) => ({ ...current, [item.sampleId]: event.target.value }))} className="mt-3 min-h-20 w-full rounded-xl border border-stone-200 p-3 text-xs" placeholder="Motivo/observação para decisão condicionada, reanálise ou bloqueio." /><div className="mt-3 flex flex-wrap gap-2">
              <button
                disabled={busy}
                onClick={() => decide(item.sample, "APPROVED")}
                className="rounded-lg bg-forest-700 px-3 py-2 text-xs font-bold text-white"
              >
                Liberar para produção
              </button>
              <button
                disabled={busy}
                onClick={() => decide(item.sample, "APPROVED_WITH_OBSERVATION")}
                className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"
              >
                Liberar com observação
              </button>
              <button
                disabled={busy}
                onClick={() => decide(item.sample, "RETEST_REQUIRED")}
                className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-bold text-amber-800"
              >
                Manter em análise
              </button>
              <button
                disabled={busy}
                onClick={() => decide(item.sample, "REJECTED")}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700"
              >
                Bloquear/Reprovar
              </button>
            </div></>}</div>;})}
          </div>
        )}
      </Card>
    </div>
  );
}
