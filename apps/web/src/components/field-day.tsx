"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Coffee, Navigation, Play, RefreshCw, Square } from "lucide-react";
import { WhatsButton } from "@/components/whatsapp-sheet";
import { VisitOutcome } from "@/components/visit-outcome";
import { getApiBaseUrl } from "@/lib/api-url";
import { fieldNative } from "@/lib/field-native";

type Stop = { start: string; end: string; minutes: number; place: { id: string; name: string; kind: string } | null; kmFromPrevious: number | null; sold: number };
type Today = {
  consent: { version: number; accepted: boolean };
  day: { id: string; status: "ACTIVE" | "PAUSED" | "ENDED"; startedAt: string; endedAt: string | null } | null;
  summary: { km: number; totalMinutes: number; customerMinutes: number; drivingMinutes: number; stoppedMinutes: number; pauseMinutes: number; visits: number; visitsWithOrder: number; revenue: number; revenuePerKm: number | null; kmPerVisit: number | null; stops: Stop[] } | null;
  insights: string[];
  here: { id: string; name: string; kind: string; since: string | null } | null;
  route: Array<{ customerId: string; name: string; reason: string; value: number | null; distanceKm: number | null; visited: boolean }>;
};

const brl = (v: number) => `R$ ${Math.round(v).toLocaleString("pt-BR")}`;
const km = (v: number) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km`;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const hm = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const time = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const SEND_EVERY_MS = 60_000;

export function FieldDay({ firstName }: { firstName: string }) {
  const [data, setData] = useState<Today | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [agree, setAgree] = useState(false);
  const [arrived, setArrived] = useState<{ id: string; name: string } | null>(null);
  const [phones, setPhones] = useState<Record<string, string | null>>({});
  const buffer = useRef<Array<{ at: string; lat: number; lng: number; accuracy: number | null; speed: number | null }>>([]);
  const api = getApiBaseUrl();

  const load = useCallback(async () => {
    const r = await fetch(`${api}/field/today`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setError("Não foi possível carregar o seu dia agora.");
    setError("");
    setData((await r.json()) as Today);
  }, [api]);

  // Celular dos clientes da carteira, para o WhatsApp em 1 toque.
  useEffect(() => {
    void fetch(`${api}/seller-portfolio`, { credentials: "include", cache: "no-store" })
      .then(async (r) => r.ok && setPhones(Object.fromEntries(((await r.json()) as { customers: Array<{ id: string; phone: string | null }> }).customers.map((c) => [c.id, c.phone]))))
      .catch(() => undefined);
  }, [api]);

  useEffect(() => { void load(); const t = window.setInterval(() => void load(), 60_000); return () => window.clearInterval(t); }, [load]);

  const flush = useCallback(async () => {
    if (!buffer.current.length) return;
    const points = buffer.current.splice(0, buffer.current.length);
    await fetch(`${api}/field/points`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ points }) }).catch(() => { buffer.current.unshift(...points); });
  }, [api]);

  // GPS pelo navegador enquanto a tela está aberta (no app nativo, quem registra é o app).
  const active = data?.day?.status === "ACTIVE";
  useEffect(() => {
    if (active && fieldNative.available()) { void fieldNative.start(); return; } // app: GPS em segundo plano
    if (!active || !("geolocation" in navigator)) return;
    const watch = navigator.geolocation.watchPosition(
      (pos) => buffer.current.push({ at: new Date(pos.timestamp).toISOString(), lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy ?? null, speed: pos.coords.speed ?? null }),
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 15_000, timeout: 30_000 },
    );
    const timer = window.setInterval(() => void flush(), SEND_EVERY_MS);
    return () => { navigator.geolocation.clearWatch(watch); window.clearInterval(timer); void flush(); };
  }, [active, flush]);

  const dayAction = async (action: "START" | "PAUSE" | "RESUME" | "END") => {
    setBusy(true);
    setError("");
    if (action !== "START") await Promise.all([flush(), fieldNative.flush()]);
    const r = await fetch(`${api}/field/day`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) {
      const b = r ? ((await r.json().catch(() => ({}))) as { message?: string }) : {};
      if (r?.status === 403) setConsentOpen(true);
      return setError(b.message ?? "Não foi possível atualizar o dia.");
    }
    if (action === "PAUSE" || action === "END") await fieldNative.stop();
    await load();
  };

  const start = async () => {
    if (!data?.consent.accepted) return setConsentOpen(true);
    await dayAction("START");
  };

  const acceptAndStart = async () => {
    setBusy(true);
    const r = await fetch(`${api}/field/consent`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ version: data?.consent.version ?? 1 }) }).catch(() => null);
    setBusy(false);
    if (!r?.ok) return setError("Não foi possível registrar a concordância.");
    setConsentOpen(false);
    await load();
    await dayAction("START");
  };

  if (!data) return <p className="flex items-center gap-2 p-6 text-sm text-stone-500">{error || <><RefreshCw size={15} className="animate-spin" /> Preparando o seu dia…</>}</p>;

  const s = data.summary;
  const status = data.day?.status ?? null;
  const pending = data.route.filter((r) => !r.visited);
  const potential = pending.reduce((t, r) => t + (r.value ?? 0), 0);
  const hour = new Date().getHours();
  const greet = hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
  const here = data.here?.kind === "CUSTOMER" && status === "ACTIVE" ? { id: data.here.id, name: data.here.name } : null;
  const visiting = arrived ?? here;
  const plan = pending[0]
    ? `Comece por ${pending[0].name}: ${pending[0].reason.charAt(0).toLowerCase()}${pending[0].reason.slice(1)}.${pending[1] ? ` Depois, ${pending[1].name}.` : ""}`
    : "Nenhum cliente da carteira pede visita hoje. Bom dia para prospectar.";

  return (
    <div className="mx-auto max-w-[820px] pb-28">
      <header className="mb-3 mt-1 flex items-end justify-between gap-3 px-1">
        <div><h1 className="text-[22px] font-bold tracking-tight">Meu dia</h1>
          <p className="text-[13px] text-stone-500">{new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Sao_Paulo" })}</p></div>
        <span className={`rounded-full px-3 py-1 text-[11px] font-extrabold ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : status === "PAUSED" ? "bg-amber-50 text-amber-800" : "bg-stone-100 text-stone-600"}`}>
          {status === "ACTIVE" ? (fieldNative.available() ? "● GPS ativo" : "● GPS com a tela aberta") : status === "PAUSED" ? "pausado" : status === "ENDED" ? "dia encerrado" : "GPS pronto"}
        </span>
      </header>

      {/* Cartão preto: a ação do dia */}
      <section className="rounded-[22px] bg-black p-4 text-white">
        {(!status || status === "ENDED") && !(status === "ENDED" && s) && (<>
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-stone-400">{greet}{firstName ? `, ${firstName}` : ""} · rota de hoje</p>
          <p className="mt-1.5 text-[42px] font-light leading-none tracking-[-.04em]">{potential ? brl(potential) : `${pending.length}`}<span className="ml-2 text-[15px] text-stone-400">{potential ? "em jogo" : pending.length === 1 ? "parada" : "paradas"}</span></p>
          <p className="mt-1 text-[13px] text-stone-400">{pending.length ? plural(pending.length, "parada", "paradas") : "Sem paradas sugeridas"} · prioridade da carteira + distância</p>
        </>)}
        {status === "ENDED" && s && (<>
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-stone-400">Fim do dia</p>
          <p className="mt-1 text-[26px] font-bold tracking-tight">Belo dia{firstName ? `, ${firstName}` : ""}</p>
          <p className="text-[13px] text-stone-400">{plural(s.visits, "visita", "visitas")} · {s.visitsWithOrder} com pedido · {hm(s.totalMinutes)} em campo</p>
          <div className="mt-3 grid grid-cols-4 gap-2 border-t border-[#1f2a27] pt-3">
            {[[km(s.km), "rodados"], [hm(s.customerMinutes), "com clientes"], [s.revenue ? brl(s.revenue) : "—", "vendido"], [s.revenuePerKm !== null ? brl(s.revenuePerKm) : "—", "por km"]].map(([v, l]) => (
              <div key={l}><b className="block text-[15px]">{v}</b><span className="text-[11px] text-stone-400">{l}</span></div>
            ))}
          </div>
          {data.insights.map((i) => <p key={i} className="mt-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 p-2.5 text-[13px] text-emerald-50">{i}</p>)}
        </>)}
        {(status === "ACTIVE" || status === "PAUSED") && s && (<>
          <p className={`text-[11px] font-extrabold uppercase tracking-[.1em] ${status === "ACTIVE" ? "text-emerald-300" : "text-amber-300"}`}>{status === "ACTIVE" ? `Dia em andamento desde ${time(data.day!.startedAt)}` : "Dia pausado"}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[[km(s.km), "rodados hoje"], [`${s.visits}`, `${s.visits === 1 ? "visita" : "visitas"} · ${s.visitsWithOrder} c/ pedido`], [hm(Math.max(0, s.totalMinutes - s.pauseMinutes)), "em rota"]].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-[#111916] p-3"><b className="block text-2xl font-light tracking-tight">{v}</b><span className="text-[11px] text-stone-400">{l}</span></div>
            ))}
          </div>
        </>)}
        {status === "ACTIVE" || status === "PAUSED" ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            {status === "ACTIVE"
              ? <button type="button" disabled={busy} onClick={() => void dayAction("PAUSE")} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-stone-700 font-bold text-stone-200"><Coffee size={18} /> Pausar</button>
              : <button type="button" disabled={busy} onClick={() => void dayAction("RESUME")} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-emerald-500 font-bold text-emerald-300"><Play size={18} /> Retomar</button>}
            <button type="button" disabled={busy} onClick={() => void dayAction("END")} className="flex min-h-[52px] items-center justify-center gap-2 rounded-2xl bg-white font-extrabold text-black"><Square size={16} /> Encerrar dia</button>
          </div>
        ) : (
          <button type="button" disabled={busy} onClick={() => void start()} className="mt-3 flex w-full items-center gap-3 rounded-2xl bg-[#0d1a17] p-2.5 text-left disabled:opacity-60">
            <span className="grid size-[52px] place-items-center rounded-full bg-white text-black"><Play size={20} fill="currentColor" /></span>
            <span><b className="block">{status === "ENDED" ? "Iniciar outro dia" : "Iniciar dia"}</b><span className="text-xs text-stone-400">o trajeto só conta até Encerrar dia</span></span>
          </button>
        )}
      </section>

      {/* Chegou no cliente: "Como foi?" */}
      {visiting && <VisitOutcome key={visiting.id} customer={visiting} phone={phones[visiting.id] ?? null} onDone={() => { setArrived(null); void load(); }} />}

      {/* Leitura do BBOS */}
      {status !== "ENDED" && (
        <section className="mt-2.5 rounded-[22px] bg-[linear-gradient(135deg,#032d60,#0b5cab)] p-4 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-sky-200">✦ BBOS · plano do dia</p>
          <p className="mt-1.5 text-[17px] font-bold leading-snug">{plan}</p>
        </section>
      )}

      {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Rota em linha do tempo */}
      {data.route.length > 0 && (
        <ol className="relative mt-2 space-y-2 pl-6 before:absolute before:bottom-3 before:left-2 before:top-3 before:w-0.5 before:bg-slate-200">
          {data.route.map((r) => {
            const next = !r.visited && r.customerId === pending[0]?.customerId;
            return (
              <li key={r.customerId} className={`relative rounded-2xl border bg-white p-3 before:absolute before:-left-[21px] before:top-4 before:size-3 before:rounded-full before:border-[2.5px] ${r.visited ? "border-slate-200 opacity-60 before:border-emerald-600 before:bg-emerald-600" : next ? "border-sky-300 shadow-[0_0_0_3px_#dbeafe] before:border-[#0b5cab] before:bg-[#0b5cab]" : "border-slate-200 before:border-[#0b5cab] before:bg-white"}`}>
                <p className="text-[10.5px] font-extrabold uppercase tracking-wider text-[#0b5cab]">{r.visited ? "✓ visitado" : `${pending.findIndex((x) => x.customerId === r.customerId) + 1}ª parada`}{r.distanceKm !== null ? ` · a ${km(r.distanceKm)}` : ""}</p>
                <b className="text-[14.5px]">{r.name}{r.value ? ` · ~${brl(r.value)}` : ""}</b>
                <p className="text-xs text-slate-500">{r.reason}</p>
                {!r.visited && (
                  <div className="mt-2 flex gap-1.5">
                    <WhatsButton compact target={{ customerId: r.customerId, customerName: r.name, phone: phones[r.customerId] ?? null, kinds: ["VISIT", "RESTOCK", "FREE"] }} />
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name)}`} target="_blank" rel="noreferrer" aria-label={`Navegar até ${r.name}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 text-[13px] font-extrabold"><Navigation size={15} /> Ir</a>
                    {status === "ACTIVE"
                      ? <button type="button" onClick={() => setArrived({ id: r.customerId, name: r.name })} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0b5cab] text-[13px] font-extrabold text-white"><CheckCircle2 size={15} /> Cheguei</button>
                      : <Link href={`/pedidos?novo=1&cliente=${encodeURIComponent(r.customerId)}`} className="inline-flex min-h-11 flex-1 items-center justify-center gap-1 rounded-xl bg-[#0b5cab] text-[13px] font-extrabold text-white">+ Pedido</Link>}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {/* Paradas do dia */}
      {s && s.stops.length > 0 && (
        <section className="mt-3 rounded-[22px] border border-stone-200 bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-[.1em] text-stone-500">Suas paradas</p>
          <ul className="mt-1 divide-y divide-stone-100 text-sm">
            {s.stops.map((stop) => (
              <li key={stop.start} className="flex justify-between gap-3 py-2.5">
                <span><b>{stop.place?.name ?? "Parada"}</b><span className="text-stone-500"> · {time(stop.start)} · {stop.minutes} min{stop.kmFromPrevious !== null ? ` · ${km(stop.kmFromPrevious)}` : ""}</span></span>
                {stop.sold > 0 && <span className="font-bold text-emerald-700">{brl(stop.sold)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {consentOpen && typeof document !== "undefined" && createPortal(
        // Portal no <body>: fica por cima da barra inferior do BBOS em qualquer tela.
        <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-[200] flex items-end justify-center bg-black/45 sm:items-center sm:p-4">
          <div className="flex max-h-[100dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[28px] bg-white sm:max-h-[92dvh] sm:rounded-[28px]">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 pb-3">
            <div className="grid size-12 place-items-center rounded-2xl bg-emerald-50 text-2xl">📍</div>
            <h2 id="consent-title" className="mt-3 text-2xl font-bold">Antes de começar o seu dia</h2>
            <p className="mt-1 text-[15px] text-stone-700">Para ajudar você a vender mais com menos tempo na estrada, o BBOS Campo registra a localização do tablet <b>somente entre &quot;Iniciar dia&quot; e &quot;Encerrar dia&quot;</b>.</p>
            <h3 className="mt-4 text-xs font-bold uppercase tracking-[.1em] text-emerald-700">Para que usamos</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm"><li>Calcular os km rodados e o tempo em cada cliente.</li><li>Sugerir a melhor rota e a ordem das visitas.</li><li>Gerar relatórios para melhorar o desempenho e deixar o dia mais eficiente.</li></ul>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-emerald-700">O que não fazemos</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm"><li>Não registramos nada fora do dia iniciado nem durante a pausa.</li><li>Não usamos a localização para nenhuma outra finalidade.</li></ul>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-emerald-700">Quem vê e por quanto tempo</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm"><li>Você vê o seu dia e o seu histórico; José e Suzi veem os relatórios de desempenho.</li><li>O trajeto fica guardado por 12 meses; os totais de km e visitas ficam no histórico.</li></ul>
            <h3 className="mt-3 text-xs font-bold uppercase tracking-[.1em] text-emerald-700">Seus direitos</h3>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm"><li>Pausar ou encerrar o registro a qualquer momento.</li><li>Ver os seus dados e retirar a concordância. Depois disso, o trajeto deixa de ser registrado.</li></ul>
            <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl bg-stone-50 p-3 text-sm font-semibold">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 size-5 accent-emerald-600" />
              Li e concordo com o registro da localização do tablet durante o meu dia de trabalho, para as finalidades acima.
            </label>
            </div>
            <div className="border-t border-stone-100 bg-white px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <button type="button" disabled={!agree || busy} onClick={() => void acceptAndStart()} className="w-full rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-emerald-950 disabled:opacity-40">{agree ? "Concordo e iniciar dia" : "Marque \"Li e concordo\" para continuar"}</button>
              <button type="button" onClick={() => setConsentOpen(false)} className="mt-1 w-full py-2 text-sm font-bold text-stone-500">Agora não</button>
              <p className="text-center text-[11px] text-stone-400">Versão {data.consent.version} · Bispo Coffees</p>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <p className="mt-4 text-center text-xs text-stone-400">Para retirar a concordância, fale com José ou Suzi ou use Configurações no app.</p>
    </div>
  );
}
