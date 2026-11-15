"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Clock3,
  History,
  Search,
  Send,
  UserRound,
} from "lucide-react";

type Customer = {
  id: string;
  name: string;
  tradeName?: string | null;
  city?: string | null;
  state?: string | null;
  segment?: string | null;
  active: boolean;
};

type CustomerVisit = {
  id: string;
  customerId: string;
  customerName: string;
  customerTradeName?: string | null;
  recordedByName: string;
  visitAt: string;
  contactName?: string | null;
  purpose: string;
  outcome: string;
  facts: string;
  nextAction?: string | null;
  nextActionAt?: string | null;
};

const purposeOptions = [
  ["PROSPECCAO", "Prospecção"],
  ["APRESENTACAO", "Apresentação de produtos"],
  ["NEGOCIACAO", "Negociação"],
  ["POS_VENDA", "Pós-venda"],
  ["COBRANCA", "Cobrança"],
  ["OUTRO", "Outro"],
] as const;

const outcomeOptions = [
  ["ACOMPANHAR", "Acompanhar"],
  ["INTERESSADO", "Cliente interessado"],
  ["COTACAO", "Solicitou cotação"],
  ["PEDIDO", "Pedido encaminhado"],
  ["SEM_INTERESSE", "Sem interesse agora"],
  ["NAO_LOCALIZADO", "Contato não localizado"],
] as const;

const purposeLabel = Object.fromEntries(purposeOptions);
const outcomeLabel = Object.fromEntries(outcomeOptions);

function localDateTimeInput(date = new Date()) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

const dateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export default function AtendimentoPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [visits, setVisits] = useState<CustomerVisit[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [visitAt, setVisitAt] = useState(localDateTimeInput());
  const [contactName, setContactName] = useState("");
  const [purpose, setPurpose] = useState("PROSPECCAO");
  const [outcome, setOutcome] = useState("ACOMPANHAR");
  const [facts, setFacts] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionAt, setNextActionAt] = useState("");
  const [search, setSearch] = useState("");
  const [activePanel, setActivePanel] = useState<"form" | "history">("form");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [customersResponse, visitsResponse] = await Promise.all([
        fetch("/api/customers", { credentials: "include", cache: "no-store" }),
        fetch("/api/customers/visits/recent", {
          credentials: "include",
          cache: "no-store",
        }),
      ]);
      const customerPayload = await customersResponse.json().catch(() => []);
      const visitsPayload = await visitsResponse.json().catch(() => []);
      if (!customersResponse.ok) {
        throw new Error(
          customerPayload?.message ?? "Não foi possível carregar os clientes.",
        );
      }
      if (!visitsResponse.ok) {
        throw new Error(
          visitsPayload?.message ??
            "Não foi possível carregar os atendimentos.",
        );
      }
      setCustomers(
        (customerPayload as Customer[]).filter((customer) => customer.active),
      );
      setVisits(visitsPayload as CustomerVisit[]);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os atendimentos.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const selected = new URLSearchParams(window.location.search).get("cliente");
    if (selected) setCustomerId(selected);
    void load();
  }, [load]);

  const save = async () => {
    setError("");
    setNotice("");
    if (!customerId) return setError("Escolha o cliente atendido.");
    const parsedVisitAt = new Date(visitAt);
    if (!visitAt || Number.isNaN(parsedVisitAt.getTime())) {
      return setError("Informe a data e a hora do atendimento.");
    }
    if (facts.trim().length < 3) {
      return setError("Registre os principais fatos do atendimento.");
    }
    if (nextActionAt && !nextAction.trim()) {
      return setError("Descreva a próxima ação antes de definir a data.");
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/visits`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          visitAt: parsedVisitAt.toISOString(),
          contactName,
          purpose,
          outcome,
          facts,
          nextAction,
          nextActionAt: nextActionAt
            ? new Date(nextActionAt).toISOString()
            : null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          payload?.message ?? "Não foi possível salvar o relato.",
        );
      }
      setContactName("");
      setPurpose("PROSPECCAO");
      setOutcome("ACOMPANHAR");
      setFacts("");
      setNextAction("");
      setNextActionAt("");
      setVisitAt(localDateTimeInput());
      setNotice("Atendimento registrado no histórico do cliente.");
      await load();
      setActivePanel("history");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o relato.",
      );
    } finally {
      setSaving(false);
    }
  };

  const visibleVisits = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return visits;
    return visits.filter((visit) =>
      [
        visit.customerTradeName,
        visit.customerName,
        visit.contactName,
        visit.recordedByName,
        visit.facts,
        visit.nextAction,
      ].some((value) =>
        String(value ?? "")
          .toLowerCase()
          .includes(term),
      ),
    );
  }, [search, visits]);

  const today = new Date();
  const lastThirtyDays = visits.filter(
    (visit) =>
      new Date(visit.visitAt).getTime() >= today.getTime() - 30 * 86_400_000,
  ).length;
  const nextActions = visits.filter(
    (visit) => visit.nextAction && visit.nextActionAt,
  );
  const overdueActions = nextActions.filter(
    (visit) => new Date(visit.nextActionAt!).getTime() < today.getTime(),
  ).length;

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[.18em] text-blue-700">
            Relacionamento comercial
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Atendimento e visitas
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-stone-500">
            Registre o que aconteceu, o resultado e a próxima ação. O relato
            entra automaticamente no histórico do cliente com autor e data.
          </p>
        </div>
        <Link
          href="/clientes"
          className="inline-flex min-h-12 items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700"
        >
          Abrir cadastro de clientes
        </Link>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={ClipboardList}
          label="Relatos nos últimos 30 dias"
          value={lastThirtyDays}
          tone="blue"
        />
        <SummaryCard
          icon={CalendarClock}
          label="Próximas ações registradas"
          value={nextActions.length}
          tone="green"
        />
        <SummaryCard
          icon={Clock3}
          label="Ações com data vencida"
          value={overdueActions}
          tone={overdueActions > 0 ? "amber" : "neutral"}
        />
      </section>

      {notice && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 size={19} className="shrink-0" />
          <span className="flex-1 font-semibold">{notice}</span>
          <button
            type="button"
            onClick={() => setNotice("")}
            className="min-h-11 rounded-xl px-3 text-xs font-semibold"
          >
            Fechar
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm xl:hidden">
        <button
          type="button"
          aria-pressed={activePanel === "form"}
          onClick={() => setActivePanel("form")}
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${activePanel === "form" ? "bg-stone-950 text-white shadow-sm" : "text-stone-600"}`}
        >
          <ClipboardList size={17} /> Registrar
        </button>
        <button
          type="button"
          aria-pressed={activePanel === "history"}
          onClick={() => setActivePanel("history")}
          className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${activePanel === "history" ? "bg-stone-950 text-white shadow-sm" : "text-stone-600"}`}
        >
          <History size={17} /> Histórico
        </button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <section
          className={`${activePanel === "form" ? "block" : "hidden"} rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6 xl:block`}
        >
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700">
              <UserRound size={20} />
            </span>
            <div>
              <h2 className="font-semibold">Novo relato</h2>
              <p className="text-xs text-stone-500">
                Os campos operacionais são simples e auditáveis.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="Cliente *" wide>
              <select
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
              >
                <option value="">Selecione o cliente</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.tradeName || customer.name}
                    {customer.city
                      ? ` · ${customer.city}/${customer.state ?? ""}`
                      : ""}
                  </option>
                ))}
              </select>
            </Field>
            {customerId && (
              <Link
                href={`/clientes?cliente=${encodeURIComponent(customerId)}`}
                className="inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800 sm:col-span-2"
              >
                Ver histórico de vendas e pagamentos deste cliente
              </Link>
            )}
            <Field label="Data e hora *">
              <input
                type="datetime-local"
                value={visitAt}
                onChange={(event) => setVisitAt(event.target.value)}
              />
            </Field>
            <Field label="Pessoa atendida">
              <input
                value={contactName}
                onChange={(event) => setContactName(event.target.value)}
                placeholder="Nome do contato"
              />
            </Field>
            <Field label="Objetivo *">
              <select
                value={purpose}
                onChange={(event) => setPurpose(event.target.value)}
              >
                {purposeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Resultado *">
              <select
                value={outcome}
                onChange={(event) => setOutcome(event.target.value)}
              >
                {outcomeOptions.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="O que aconteceu *" wide>
              <textarea
                rows={5}
                value={facts}
                onChange={(event) => setFacts(event.target.value)}
                placeholder="Necessidade, volume, produtos apresentados, objeções e acordos feitos..."
              />
            </Field>
            <Field label="Próxima ação" wide>
              <input
                value={nextAction}
                onChange={(event) => setNextAction(event.target.value)}
                placeholder="Ex.: enviar proposta, ligar, agendar degustação"
              />
            </Field>
            <Field label="Data da próxima ação">
              <input
                type="datetime-local"
                value={nextActionAt}
                onChange={(event) => setNextActionAt(event.target.value)}
              />
            </Field>
          </div>

          {error && (
            <div
              role="alert"
              className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </div>
          )}
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void save()}
            className="sticky bottom-3 z-10 mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-sm font-semibold text-white shadow-lg disabled:opacity-50 xl:static xl:shadow-none"
          >
            <Send size={16} />
            {saving ? "Salvando…" : "Registrar no histórico do cliente"}
          </button>
        </section>

        <section
          className={`${activePanel === "history" ? "block" : "hidden"} overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm xl:block`}
        >
          <div className="border-b border-stone-100 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid size-11 place-items-center rounded-2xl bg-stone-100 text-stone-700">
                <History size={20} />
              </span>
              <div>
                <h2 className="font-semibold">Histórico de atendimento</h2>
                <p className="text-xs text-stone-500">
                  Visível também dentro do cadastro de cada cliente.
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 text-stone-500">
              <Search size={16} />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente, contato, vendedor ou assunto..."
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
          </div>

          {loading ? (
            <p className="p-8 text-sm text-stone-500">Carregando histórico…</p>
          ) : visibleVisits.length === 0 ? (
            <div className="p-10 text-center">
              <History className="mx-auto text-stone-300" />
              <p className="mt-3 font-semibold">
                Nenhum atendimento registrado
              </p>
              <p className="mt-1 text-sm text-stone-500">
                O primeiro relato aparecerá aqui e na ficha do cliente.
              </p>
            </div>
          ) : (
            <div className="max-h-[820px] divide-y overflow-y-auto">
              {visibleVisits.map((visit) => (
                <article key={visit.id} className="p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {visit.customerTradeName || visit.customerName}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {dateTime(visit.visitAt)} · {visit.recordedByName}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-semibold text-blue-700">
                      {purposeLabel[visit.purpose] ?? visit.purpose}
                    </span>
                  </div>
                  <p className="mt-3 text-xs font-semibold text-stone-600">
                    {outcomeLabel[visit.outcome] ?? visit.outcome}
                    {visit.contactName
                      ? ` · Contato: ${visit.contactName}`
                      : ""}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                    {visit.facts}
                  </p>
                  {visit.nextAction && (
                    <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-xs leading-5 text-emerald-900">
                      <strong>Próxima ação:</strong> {visit.nextAction}
                      {visit.nextActionAt
                        ? ` · ${dateTime(visit.nextActionAt)}`
                        : ""}
                    </div>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`block text-sm font-semibold text-stone-700 ${wide ? "sm:col-span-2" : ""}`}
    >
      <span>{label}</span>
      <div className="mt-1 [&_input]:min-h-12 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-stone-200 [&_input]:px-3 [&_input]:py-3 [&_input]:text-base [&_input]:font-normal [&_input]:outline-none [&_select]:min-h-12 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:border-stone-200 [&_select]:px-3 [&_select]:py-3 [&_select]:text-base [&_select]:font-normal [&_select]:outline-none [&_textarea]:w-full [&_textarea]:rounded-xl [&_textarea]:border [&_textarea]:border-stone-200 [&_textarea]:px-3 [&_textarea]:py-3 [&_textarea]:text-base [&_textarea]:font-normal [&_textarea]:outline-none sm:[&_input]:text-sm sm:[&_select]:text-sm sm:[&_textarea]:text-sm">
        {children}
      </div>
    </label>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof ClipboardList;
  label: string;
  value: number;
  tone: "blue" | "green" | "amber" | "neutral";
}) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-800",
    neutral: "bg-stone-100 text-stone-600",
  };
  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span
          className={`grid size-10 place-items-center rounded-xl ${tones[tone]}`}
        >
          <Icon size={18} />
        </span>
        <div>
          <p className="text-2xl font-semibold">{value}</p>
          <p className="text-xs text-stone-500">{label}</p>
        </div>
      </div>
    </div>
  );
}
