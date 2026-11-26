"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, CalendarClock, Check, FileText, Globe2, Package, Plus, Ship, TriangleAlert, Truck, UsersRound, type LucideIcon } from "lucide-react";
import { ExportWorldMap } from "@/components/export-world-map";
import { buildDestinations } from "@/lib/export-map";
import { BUYER_STATUS_LABEL, CARRIER_LABEL, SAMPLE_STATUS_LABEL, alertText, contractValue, countryName, exportsApi, flag, journeyIndex } from "@/lib/exports";

/**
 * Exportações · Visão geral (approved draft, 26/11): headlines, the world map
 * of samples and deals, four numbers, the export path, samples on the way,
 * what needs a decision, buyers abroad and the portfolio per currency.
 * Deals are the export contracts registered here; orders of the domestic
 * sales flow are not counted.
 */

type Overview = { trackingEnabled?: boolean; inTransit: number; awaitingAnswer: number; approvalRate: number | null; evaluated: number; becameContract: number; alerts: Array<{ id: string; buyerName: string; lotReference: string; kind: string; days: number }> };
type Buyer = { id: string; name: string; country: string; city: string | null; contactName: string | null; currency: string; status: string; sampleCount: number; contractCount: number };
type Sample = { id: string; buyerId: string; buyerName: string; buyerCountry: string; reference: string | null; coffeeType: string; lotReference: string; weightGrams: number; carrier: string | null; trackingCode: string | null; status: string; result: string | null; trackingStatusText?: string | null; trackingProblem?: string | null };
type Contract = { id: string; buyerId: string; buyerName: string; code: string; quantityKg: number; unitPrice: number; priceUnit: string; currency: string; status: string };

const card = "rounded-[var(--bbos-radius-card,14px)] border border-[var(--bbos-border)] bg-white";
const label = "text-xs font-semibold uppercase tracking-[.08em] text-[var(--bbos-text-secondary)]";
const ON_THE_WAY = ["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS"];
const OPEN_CONTRACT = ["NEGOTIATING", "SIGNED", "SHIPPED"];
const kg = (grams: number) => `${(grams / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kg`;

const money = (currency: string, value: number) => {
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency, maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
  }
};

export default function ExportsPage() {
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [buyers, setBuyers] = React.useState<Buyer[]>([]);
  const [samples, setSamples] = React.useState<Sample[]>([]);
  const [contracts, setContracts] = React.useState<Contract[]>([]);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    void Promise.all([
      exportsApi<Overview>("/overview"),
      exportsApi<Buyer[]>("/buyers"),
      exportsApi<Sample[]>("/samples"),
      exportsApi<Contract[]>("/contracts"),
    ])
      .then(([o, b, s, c]) => {
        setOverview(o);
        setBuyers(Array.isArray(b) ? b : []);
        setSamples(Array.isArray(s) ? s : []);
        setContracts(Array.isArray(c) ? c : []);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Não foi possível carregar Exportações."));
  }, []);

  const onTheWay = samples.filter((s) => ON_THE_WAY.includes(s.status));
  const delivered = samples.filter((s) => s.status === "DELIVERED");
  const approved = samples.filter((s) => s.result === "APPROVED");
  const openContracts = contracts.filter((c) => OPEN_CONTRACT.includes(c.status));
  const shipped = contracts.filter((c) => c.status === "SHIPPED" || c.status === "COMPLETED");
  const countries = [...new Set(buyers.map((b) => b.country))];
  const destinations = React.useMemo(() => buildDestinations({ buyers, samples, contracts, orders: [] }), [buyers, samples, contracts]);
  const byCurrency = openContracts.reduce<Record<string, { value: number; count: number }>>((acc, c) => {
    const entry = (acc[c.currency] ??= { value: 0, count: 0 });
    entry.value += contractValue(c);
    entry.count += 1;
    return acc;
  }, {});
  const carriers = [...new Set(onTheWay.map((s) => (s.carrier ? CARRIER_LABEL[s.carrier] : null)).filter(Boolean))];
  const problems = samples.filter((s) => s.trackingProblem);
  const tasks = [
    ...(overview?.alerts ?? []).map((a) => ({ key: a.id + a.kind, tone: a.kind === "CUSTOMS_STUCK" ? "attention" : "critical", title: `${a.buyerName}: ${alertText(a)}`, detail: a.lotReference, href: "/exportacoes/amostras", action: "Abrir amostra" })),
    ...problems.map((s) => ({ key: `p-${s.id}`, tone: "critical", title: `${s.buyerName}: ocorrência no envio`, detail: s.trackingProblem ?? "", href: "/exportacoes/amostras", action: "Ver rastreio" })),
  ];
  const headlines: Array<{ key: string; icon: LucideIcon; title: string; detail: string; warn?: boolean }> = [];
  if (onTheWay.length) headlines.push({ key: "way", icon: Truck, title: `${onTheWay.length} ${onTheWay.length === 1 ? "amostra a caminho" : "amostras a caminho"}`, detail: `${onTheWay.map((s) => `${countryName(s.buyerCountry)}${s.carrier ? ` (${CARRIER_LABEL[s.carrier]})` : ""}`).join(" e ")}${overview?.trackingEnabled ? " · rastreio automático ligado" : ""}` });
  if (countries.length) headlines.push({ key: "countries", icon: Globe2, title: `${countries.length} ${countries.length === 1 ? "país" : "países"} em prospecção`, detail: `${countries.map((c) => countryName(c)).join(", ")} · ${buyers.length} ${buyers.length === 1 ? "cliente externo" : "clientes externos"}` });
  if (tasks.length) headlines.push({ key: "tasks", icon: TriangleAlert, warn: true, title: `${tasks.length} ${tasks.length === 1 ? "amostra pede atenção" : "amostras pedem atenção"}`, detail: tasks[0]!.title });
  else if (openContracts.length) headlines.push({ key: "contracts", icon: FileText, title: `${openContracts.length} ${openContracts.length === 1 ? "contrato em aberto" : "contratos em aberto"}`, detail: Object.entries(byCurrency).map(([cur, v]) => money(cur, v.value)).join(" · ") });

  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-4 pb-24 sm:pb-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold leading-tight">Exportações</h1>
          <p className="mt-0.5 text-sm text-[var(--bbos-text-secondary)]">Do primeiro contato com o importador ao embarque · separado do mercado interno</p>
        </div>
        <div className="flex gap-2">
          <Link href="/exportacoes/amostras?novo=1" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[var(--bbos-border)] bg-white px-3.5 text-sm font-semibold hover:bg-[var(--bbos-surface-subtle)]"><Plus size={15} /> Nova amostra</Link>
          <Link href="/exportacoes/contratos?novo=1" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--bbos-action-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--bbos-action-primary-hover)]"><Plus size={15} /> Novo contrato</Link>
        </div>
      </section>

      {error && <p role="alert" className="rounded-xl bg-[#fdecea] px-3 py-2 text-sm text-[var(--bbos-danger)]">{error}</p>}

      {headlines.length > 0 && (
        <section aria-label="Destaques" className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(250px,1fr))]">
          {headlines.map(({ key, icon: Icon, title, detail, warn }) => (
            <div key={key} className={`${card} flex items-start gap-3 p-3.5`}>
              <span className={`grid size-9 shrink-0 place-items-center rounded-[10px] ${warn ? "bg-[#fdecea] text-[var(--bbos-danger)]" : "bg-[var(--bbos-surface-subtle)] text-[var(--bbos-coffee-green)]"}`}><Icon size={18} /></span>
              <div className="min-w-0">
                <p className={`text-[14.5px] font-semibold leading-snug ${warn ? "text-[var(--bbos-danger)]" : ""}`}>{title}</p>
                <p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{detail}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      <ExportWorldMap destinations={destinations} />

      <section aria-label="Números" className="grid grid-cols-1 gap-3 sm:grid-cols-2 min-[1360px]:grid-cols-4">
        <div className={`${card} p-4`}>
          <p className={label}>Amostras a caminho</p>
          <p className="mt-1.5 text-[26px] font-bold tabular-nums">{onTheWay.length}</p>
          <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">
            {["SENT", "IN_TRANSIT", "CUSTOMS"].map((st) => `${SAMPLE_STATUS_LABEL[st]?.toLowerCase()} ${onTheWay.filter((s) => s.status === st).length}`).join(" · ")}
            {carriers.length ? ` · ${carriers.join(", ")}` : ""}
          </p>
          <Link href="/exportacoes/amostras" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">Ver amostras →</Link>
        </div>
        <div className={`${card} p-4`}>
          <p className={label}>Aguardando resposta</p>
          <p className="mt-1.5 text-[26px] font-bold tabular-nums">{overview?.awaitingAnswer ?? 0}</p>
          <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">amostras entregues sem avaliação do comprador</p>
        </div>
        <div className={`${card} p-4`}>
          <p className={label}>Taxa de aprovação</p>
          <p className={`mt-1.5 text-[26px] font-bold tabular-nums ${overview?.approvalRate == null ? "text-[#9aa3a0]" : ""}`}>{overview?.approvalRate == null ? "—" : `${Math.round(overview.approvalRate * 100)}%`}</p>
          <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">{overview?.evaluated ? `${overview.evaluated} avaliada(s) em 12 meses` : "aparece depois da primeira resposta de um comprador"}</p>
        </div>
        <div className={`${card} p-4`}>
          <p className={label}>Contratos em aberto</p>
          <p className="mt-1.5 text-[26px] font-bold tabular-nums">{openContracts.length}</p>
          <p className="mt-1 text-[12.5px] text-[var(--bbos-text-secondary)]">{Object.keys(byCurrency).length ? Object.entries(byCurrency).map(([cur, v]) => money(cur, v.value)).join(" · ") : "nenhum contrato ainda"}</p>
          <Link href="/exportacoes/contratos" className="mt-2 inline-block text-[13px] font-bold text-[var(--bbos-coffee-green)]">Ver contratos →</Link>
        </div>
      </section>

      <ExportPath steps={[
        { key: "buyers", name: "Clientes externos", sub: countries.map((c) => countryName(c)).slice(0, 2).join(" · ") || "nenhum ainda", value: buyers.length, icon: UsersRound, href: "/exportacoes/clientes" },
        { key: "way", name: "Amostras a caminho", sub: carriers.join(" · ") || "nenhuma", value: onTheWay.length, icon: Truck, href: "/exportacoes/amostras", next: onTheWay.length > 0 },
        { key: "delivered", name: "Entregues", sub: "aguardando resposta", value: delivered.length, icon: Package, href: "/exportacoes/amostras" },
        { key: "approved", name: "Aprovadas", sub: "pelo comprador", value: approved.length, icon: Check, href: "/exportacoes/amostras" },
        { key: "contracts", name: "Contratos", sub: "negociação · assinado", value: openContracts.filter((c) => c.status !== "SHIPPED").length, icon: FileText, href: "/exportacoes/contratos" },
        { key: "shipped", name: "Embarques", sub: "porto de Santos", value: shipped.length, icon: Ship, href: "/exportacoes/contratos" },
      ]} />

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-1 flex items-center text-[16.5px] font-semibold">Amostras a caminho<Link href="/exportacoes/amostras" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Todas as amostras →</Link></h2>
          {onTheWay.length === 0 ? <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nenhuma amostra a caminho agora.</p> : (
            <ul className="divide-y divide-[#eef1ed]">
              {onTheWay.map((s) => (
                <li key={s.id} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1.3fr)_140px_minmax(0,1fr)] sm:items-center">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold"><span className="mr-1">{flag(s.buyerCountry)}</span>{s.buyerName}</p>
                    <p className="text-xs text-[var(--bbos-text-secondary)]">{[s.reference, s.coffeeType === "GREEN" ? "café verde" : "café torrado", kg(s.weightGrams)].filter(Boolean).join(" · ")}</p>
                  </div>
                  <MiniJourney status={s.status} />
                  <div className="min-w-0 text-xs">
                    <p className="font-semibold">{s.carrier ? CARRIER_LABEL[s.carrier] : "Transportadora"} {s.trackingCode ?? ""}</p>
                    <p className={s.trackingProblem ? "text-[var(--bbos-danger)]" : "text-[var(--bbos-text-secondary)]"}>{s.trackingProblem ?? s.trackingStatusText ?? SAMPLE_STATUS_LABEL[s.status]}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-1 flex items-center gap-2 text-[16.5px] font-semibold">Para resolver agora{tasks.length > 0 && <span className="rounded-full bg-[var(--bbos-text-primary)] px-2 text-xs font-semibold text-white">{tasks.length}</span>}</h2>
          {tasks.length === 0 ? (
            <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nada pendente. Quando uma amostra parar na alfândega por 3 dias, ficar sem movimento ou o comprador passar do prazo de resposta, o aviso aparece aqui.</p>
          ) : (
            <ul className="divide-y divide-[#eef1ed]">
              {tasks.map((task) => (
                <li key={task.key} className="grid grid-cols-[5px_38px_1fr] items-center gap-x-3 gap-y-2 py-3 sm:grid-cols-[5px_38px_1fr_auto]">
                  <span aria-hidden className="self-stretch rounded" style={{ background: task.tone === "attention" ? "var(--bbos-warning)" : "var(--bbos-danger)" }} />
                  <span aria-hidden className="grid size-[38px] place-items-center rounded-xl bg-[var(--bbos-surface-subtle)] text-[var(--bbos-text-secondary)]"><CalendarClock size={18} /></span>
                  <div className="min-w-0"><p className="text-[14.5px] font-semibold">{task.title}</p><p className="text-[12.5px] text-[var(--bbos-text-secondary)]">{task.detail}</p></div>
                  <Link href={task.href} className="col-start-3 inline-flex min-h-10 items-center justify-self-start rounded-xl border border-[var(--bbos-border)] px-3.5 text-[13px] font-bold sm:col-start-4">{task.action}</Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(340px,1fr))]">
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-1 flex items-center text-[16.5px] font-semibold">Clientes externos<Link href="/exportacoes/clientes" className="ml-auto text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver todos →</Link></h2>
          {buyers.length === 0 ? <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Nenhum cliente externo ainda.</p> : (
            <ul className="divide-y divide-[#eef1ed]">
              {buyers.slice(0, 6).map((b) => (
                <li key={b.id} className="grid grid-cols-[28px_1fr_auto] items-center gap-x-2.5 py-2.5">
                  <span className="text-xl" aria-hidden>{flag(b.country)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{b.name}</p>
                    <p className="text-xs text-[var(--bbos-text-secondary)]">{[b.city, b.contactName, b.currency].filter(Boolean).join(" · ")} · {b.sampleCount} amostra(s) · {b.contractCount} contrato(s)</p>
                  </div>
                  <span className="rounded-full bg-[var(--bbos-surface-subtle)] px-2 py-0.5 text-[11px] font-bold text-[var(--bbos-text-secondary)]">{BUYER_STATUS_LABEL[b.status] ?? b.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className={`${card} p-4 sm:p-5`}>
          <h2 className="mb-1 text-[16.5px] font-semibold">Carteira por moeda</h2>
          {Object.keys(byCurrency).length === 0 ? (
            <p className="py-4 text-sm text-[var(--bbos-text-secondary)]">Os contratos em aberto aparecem aqui, cada um na sua moeda.</p>
          ) : (
            <ul>
              {Object.entries(byCurrency).map(([currency, v]) => {
                const max = Math.max(...Object.values(byCurrency).map((x) => x.value), 1);
                return (
                  <li key={currency} className="grid grid-cols-[48px_1fr_auto] items-center gap-2.5 py-2.5">
                    <span className="rounded-lg bg-[var(--bbos-surface-subtle)] py-1 text-center text-xs font-bold">{currency}</span>
                    <div><div className="h-2.5 rounded-sm bg-[var(--bbos-surface-subtle)]"><i className="block h-full rounded-sm bg-[#7fa894]" style={{ width: `${(v.value / max) * 100}%` }} /></div>
                      <p className="mt-1 text-xs text-[var(--bbos-text-secondary)]">{v.count} {v.count === 1 ? "contrato" : "contratos"}</p></div>
                    <b className="tabular-nums">{money(currency, v.value)}</b>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs text-[var(--bbos-text-secondary)]">Cada valor fica na moeda do contrato; o BBOS não converte para real sem uma cotação registrada.</p>
        </section>
      </div>
    </div>
  );
}

function MiniJourney({ status }: { status: string }) {
  const current = journeyIndex(status);
  return (
    <div aria-label={`Etapa: ${SAMPLE_STATUS_LABEL[status] ?? status}`} className="flex items-center">
      {[0, 1, 2, 3, 4].map((index) => (
        <React.Fragment key={index}>
          {index > 0 && <span className={`h-[3px] flex-1 ${index <= current ? "bg-[var(--bbos-success)]" : "bg-[#d6dcd6]"}`} />}
          <span className={`shrink-0 rounded-full ${index < current ? "size-2.5 bg-[var(--bbos-success)]" : index === current ? `size-3.5 border-[3px] bg-white ${status === "CUSTOMS" ? "border-[var(--bbos-warning)]" : "border-[var(--bbos-success)]"}` : "size-2.5 bg-[#d6dcd6]"}`} />
        </React.Fragment>
      ))}
    </div>
  );
}

function ExportPath({ steps }: { steps: Array<{ key: string; name: string; sub: string; value: number; icon: LucideIcon; href: string; next?: boolean }> }) {
  return (
    <section aria-labelledby="export-path" className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 id="export-path" className="text-[16.5px] font-semibold">O caminho da exportação</h2>
        <Link href="/exportacoes/amostras" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--bbos-coffee-green)]">Ver amostras <ArrowRight size={13} /></Link>
      </div>
      <ol className="relative grid grid-cols-[repeat(6,112px)] overflow-x-auto pb-1 sm:grid-cols-6 sm:overflow-visible">
        <span aria-hidden className="absolute left-[8%] right-[8%] top-[28px] h-[3px] rounded bg-[#d6dcd6]" />
        {steps.map(({ key, name, sub, value, icon: Icon, href, next }) => (
          <li key={key} className={`relative text-center ${value === 0 ? "opacity-50" : ""}`}>
            <Link href={href} className="block rounded-xl px-1 pb-1 hover:bg-[var(--bbos-surface-subtle)]">
              <span className={`relative mx-auto grid size-14 place-items-center rounded-full border-2 bg-white ${next ? "border-[var(--bbos-coffee-green)] text-[var(--bbos-coffee-green)] shadow-[0_0_0_4px_rgba(46,138,100,.12)]" : "border-[#d6dcd6] text-[var(--bbos-text-secondary)]"}`}>
                <Icon size={22} />
                <span className={`absolute -right-2 -top-1.5 rounded-full px-1.5 text-xs font-bold text-white ${next ? "bg-[var(--bbos-coffee-green)]" : "bg-[#5d6b64]"}`}>{value}</span>
              </span>
              <span className="mt-2 block text-[13.5px] font-semibold">{name}</span>
              <span className="block text-xs text-[var(--bbos-text-secondary)]">{sub}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
