"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@bbos/ui";
import { SensoryWheelHint } from "@/components/sensory-illustrated-wheel";
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";
export default function NewCuppingSessionPage() {
  const router = useRouter();
  const [context, setContext] = React.useState<any>(null);
  const [code, setCode] = React.useState("");
  const [mode, setMode] = React.useState<"CUPPING" | "TRAINING">("CUPPING");
  const [sampleIds, setSampleIds] = React.useState<string[]>([]);
  const [coordinatorId, setCoordinatorId] = React.useState("");
  const [participantUserIds, setParticipantUserIds] = React.useState<string[]>([]);
  const [purpose, setPurpose] = React.useState("");
  const [error, setError] = React.useState("");
  React.useEffect(() => {
    fetch(`${API}/laboratory/sessions/context`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Contexto indisponível");
        return response.json();
      })
      .then((sessionContext) => {
        const queue = sessionContext.samples ?? [];
        const users = sessionContext.users ?? [];
        const requested = new URLSearchParams(window.location.search).get(
          "sampleId",
        );
        setContext({ ...sessionContext, companyId: sessionContext.company?.id, samples: queue, users });
        const initialCoordinator = users[0]?.id ?? "";
        setCoordinatorId(initialCoordinator);
        setParticipantUserIds(initialCoordinator ? [initialCoordinator] : []);
        setSampleIds(
          requested && queue.some((sample: any) => sample.id === requested)
            ? [requested]
            : queue[0]?.id
              ? [queue[0].id]
              : [],
        );
      })
      .catch(() =>
        setError("Não foi possível carregar o contexto do laboratório."),
      );
  }, []);
  async function create() {
    if (
      !context?.companyId ||
      !coordinatorId ||
      !code.trim() ||
      !sampleIds.length ||
      !participantUserIds.length
    ) {
      setError(
        "Informe o código, selecione ao menos uma amostra e mantenha o laboratório configurado.",
      );
      return;
    }
    const response = await fetch(`${API}/laboratory/sessions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        companyId: context.companyId,
        coordinatorId,
        code: code.trim(),
        mode,
        protocol: "TRADITIONAL_100",
        protocolVersion: context.protocolVersion ?? "1.0",
        notes: purpose.trim() || undefined,
        sampleIds,
        participantUserIds,
      }),
    });
    if (!response.ok) {
      setError("Não foi possível criar a sessão.");
      return;
    }
    const session = await response.json();
    router.push(`/laboratorio/sessoes/${session.id}`);
  }
  return (
    <div className="mx-auto max-w-[760px]">
      <Link
        href="/laboratorio/sessoes"
        className="text-xs font-bold text-forest-700"
      >
        ← Sessões
      </Link>
      <h1 className="mt-5 text-3xl font-bold">Nova sessão de cupping</h1>
      <p className="mt-2 text-sm text-stone-500">
        Selecione as amostras e prepare a sessão antes de iniciar a prova.
      </p>
      <Card className="mt-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-xs font-bold text-stone-600">
            Código da sessão
            <input
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="CUP-2026-001"
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-stone-600">
            Data
            <input
              readOnly
              value={new Date().toLocaleDateString("pt-BR")}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
            />
          </label>
          <label className="text-xs font-bold text-stone-600">
            Responsável
            <select
              value={coordinatorId}
              onChange={(event) => {
                const next = event.target.value;
                setCoordinatorId(next);
                setParticipantUserIds((current) => current.includes(next) ? current : [...current, next]);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
            >{context?.users?.map((user: any) => <option key={user.id} value={user.id}>{user.name} · {user.role}</option>)}</select>
          </label>
          <label className="text-xs font-bold text-stone-600">
            Método / protocolo
            <input
              readOnly
              value="Traditional 100 · v1.0"
              className="mt-2 min-h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm"
            />
          </label>
        </div>
        <label className="mt-4 block text-xs font-bold text-stone-600">
          Finalidade
          <textarea
            value={purpose}
            onChange={(event) => setPurpose(event.target.value)}
            placeholder="Recebimento, controle, reanálise ou pré-produção"
            className="mt-2 min-h-20 w-full rounded-xl border border-stone-200 p-3 text-sm"
          />
        </label>
        <p className="mt-5 text-[10px] font-bold uppercase tracking-widest text-forest-700">
          Modo da sessão
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(
            [
              [
                "CUPPING",
                "Cupping oficial",
                "Avaliação sensorial com revelação progressiva dos estímulos visuais.",
              ],
              [
                "TRAINING",
                "Treinamento sensorial",
                "Experiência visual ampliada para calibração e memória sensorial.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <button
              type="button"
              key={value}
              onClick={() => setMode(value)}
              className={`rounded-2xl border p-4 text-left transition ${mode === value ? "border-forest-600 bg-forest-50 ring-2 ring-forest-100" : "border-stone-200 bg-white"}`}
            >
              <div className="flex items-center justify-between">
                <strong className="text-sm">{title}</strong>
                <SensoryWheelHint mode={value} />
              </div>
              <p className="mt-2 text-xs leading-5 text-stone-500">
                {description}
              </p>
            </button>
          ))}
        </div>
        <fieldset className="mt-5">
          <legend className="text-xs font-bold text-stone-600">
            Amostras selecionadas
          </legend>
          <div className="mt-2 space-y-2">
            {context?.samples?.length ? (
              context.samples.map((sample: any) => (
                <label
                  key={sample.id}
                  className="flex items-center gap-3 rounded-xl border border-stone-200 p-3 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={sampleIds.includes(sample.id)}
                    onChange={(event) =>
                      setSampleIds((current) =>
                        event.target.checked
                          ? [...current, sample.id]
                          : current.filter((id) => id !== sample.id),
                      )
                    }
                  />
                  <span>
                    <strong>{sample.sampleCode}</strong>
                    <span className="ml-2 text-stone-500">
                      Lote {sample.lot?.code} · {sample.sampleType}
                    </span>
                  </span>
                </label>
              ))
            ) : (
              <p className="rounded-xl border border-dashed p-5 text-center text-xs text-stone-500">
                Nenhuma amostra disponível para preparar.
              </p>
            )}
          </div>
        </fieldset>
        <fieldset className="mt-5"><legend className="text-xs font-bold text-stone-600">Provadores ativos autorizados</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{context?.users?.length ? context.users.map((user: any) => <label key={user.id} className="flex min-h-11 items-center gap-3 rounded-xl border border-stone-200 p-3 text-xs"><input type="checkbox" checked={participantUserIds.includes(user.id)} disabled={user.id === coordinatorId} onChange={(event) => setParticipantUserIds((current) => event.target.checked ? [...new Set([...current, user.id])] : current.filter((id) => id !== user.id))}/><span><strong>{user.name}</strong><small className="ml-2 text-stone-400">{user.role}{user.id === coordinatorId ? " · coordenador" : ""}</small></span></label>) : <p className="text-xs text-stone-500">Nenhum usuário ativo autorizado está disponível nesta empresa.</p>}</div></fieldset>
        {error && (
          <p className="mt-4 text-xs font-semibold text-red-600">{error}</p>
        )}
        <button
          onClick={create}
          className="mt-6 min-h-12 w-full rounded-xl bg-forest-900 text-xs font-bold text-white"
        >
          Criar sessão {mode === "TRAINING" ? "de treinamento" : "oficial"}
        </button>
      </Card>
    </div>
  );
}
