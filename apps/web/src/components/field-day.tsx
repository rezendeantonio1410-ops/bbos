"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ClipboardCheck, Coffee, MapPin, MessageCircle, Navigation, Play, RefreshCw, Square } from "lucide-react";
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
  const buffer = useRef<Array<{ at: string; lat: number; lng: number; accuracy: number | null; speed: number | null }>>([]);
  const api = getApiBaseUrl();

  const load = useCallback(async () => {
    const r = await fetch(`${api}/field/today`, { credentials: "include", cache: "no-store" }).catch(() => null);
    if (!r?.ok) return setError("Não foi possível carregar o seu dia agora.");
    setError("");
    setData((await r.json()) as Today);
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

  return (
    <div className="mx-auto max-w-[820px] pb-24">
      {/* Manhã: rota sugerida e Iniciar dia */}
      {(!status || status === "ENDED") && (
        <section className="overflow-hidden rounded-[28px] bg-[radial-gradient(120%_80%_at_80%_0%,#134e44_0%,#0b1f1b_55%,#070b0a_100%)] p-6 text-white">
          <p className="text-xs font-bold uppercase tracking-[.12em] text-emerald-300">{status === "ENDED" ? "Dia encerrado" : `Bom dia${firstName ? `, ${firstName}` : ""}`}</p>
          {status === "ENDED" && s ? (
            <>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Belo dia{firstName ? `, ${firstName}` : ""}</h1>
              <p className="text-sm text-stone-300">{plural(s.visits, "visita", "visitas")} · {s.visitsWithOrder} com pedido · {hm(s.totalMinutes)} em campo</p>
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[[km(s.km), "rodados"], [s.revenuePerKm !== null ? brl(s.revenuePerKm) : "—", "vendidos por km"], [hm(s.customerMinutes), "com clientes"], [s.kmPerVisit !== null ? km(s.kmPerVisit) : "—", "por visita"]].map(([v, l]) => (
                  <div key={l} className="rounded-2xl border border-white/10 bg-white/5 p-3"><b className="block text-xl">{v}</b><span className="text-xs text-stone-300">{l}</span></div>
                ))}
              </div>
              {data.insights.map((i) => <p key={i} className="mt-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-3 text-sm text-emerald-50">{i}</p>)}
            </>
          ) : (
            <>
              <h1 className="mt-1 text-3xl font-bold leading-tight tracking-tight">{pending.length ? `Seu dia tem ${pending.length} ${pending.length === 1 ? "parada" : "paradas"}${potential ? ` e ${brl(potential)} em jogo` : ""}` : "Pronto para começar"}</h1>
              <p className="mt-1 text-sm text-stone-300">Rota montada pela prioridade da sua carteira e pela distância.</p>
            </>
          )}
          {status !== "ENDED" && (
            <button type="button" disabled={busy} onClick={() => void start()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-4 text-lg font-extrabold text-emerald-950 shadow-[0_12px_30px_-8px_rgba(16,185,129,.6)] disabled:opacity-60"><Play size={20} /> Iniciar dia</button>
          )}
          <p className="mt-2 text-center text-xs text-stone-400">🔒 O trajeto só é registrado entre Iniciar dia e Encerrar dia.</p>
        </section>
      )}

      {/* Em rota */}
      {(status === "ACTIVE" || status === "PAUSED") && s && (
        <section className="rounded-[28px] bg-stone-950 p-5 text-white">
          <div className="flex items-center justify-between text-sm">
            <span className={`inline-flex items-center gap-2 font-bold ${status === "ACTIVE" ? "text-emerald-300" : "text-amber-300"}`}>
              <span className={`size-2.5 rounded-full ${status === "ACTIVE" ? "bg-emerald-400 shadow-[0_0_0_6px_rgba(52,211,153,.2)]" : "bg-amber-400"}`} />
              {status === "ACTIVE" ? `Dia em andamento desde ${time(data.day!.startedAt)}` : "Pausado"}
            </span>
            <span className="text-xs text-stone-400">{fieldNative.available() ? "GPS ativo, pode bloquear o tablet" : "mantenha esta tela aberta"}</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[[km(s.km), "rodados hoje"], [`${s.visits}`, `${s.visits === 1 ? "visita" : "visitas"} · ${plural(s.visitsWithOrder, "com pedido", "com pedido")}`], [hm(s.totalMinutes - s.pauseMinutes), "em rota"]].map(([v, l]) => (
              <div key={l} className="rounded-2xl bg-stone-800 p-3"><b className="block text-2xl">{v}</b><span className="text-xs text-stone-400">{l}</span></div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {status === "ACTIVE"
              ? <button type="button" disabled={busy} onClick={() => void dayAction("PAUSE")} className="flex items-center justify-center gap-2 rounded-2xl border border-stone-600 py-3.5 font-bold text-stone-200"><Coffee size={18} /> Pausar</button>
              : <button type="button" disabled={busy} onClick={() => void dayAction("RESUME")} className="flex items-center justify-center gap-2 rounded-2xl border border-emerald-500 py-3.5 font-bold text-emerald-300"><Play size={18} /> Retomar</button>}
            <button type="button" disabled={busy} onClick={() => void dayAction("END")} className="flex items-center justify-center gap-2 rounded-2xl bg-white py-3.5 font-extrabold text-stone-950"><Square size={16} /> Encerrar dia</button>
          </div>
        </section>
      )}

      {data.here && status === "ACTIVE" && (
        <section className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[22px] border-2 border-teal-700 bg-teal-50 p-4">
          <div><p className="flex items-center gap-1.5 text-lg font-bold"><MapPin size={18} className="text-teal-700" /> Você está em {data.here.name}</p><p className="text-sm text-teal-800">{data.here.since ? `chegou às ${time(data.here.since)}` : "agora"}</p></div>
          {data.here.kind === "CUSTOMER" && <Link href={`/atendimento?cliente=${encodeURIComponent(data.here.id)}`} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-teal-700 px-5 font-extrabold text-white"><ClipboardCheck size={18} /> Registrar visita</Link>}
        </section>
      )}

      {error && <p role="alert" className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {/* Rota */}
      <section className="mt-3 rounded-[24px] border border-stone-200 bg-white p-5">
        <h2 className="text-lg font-bold">Rota de hoje</h2>
        <p className="text-sm text-stone-500">ordem sugerida pelo BBOS: prioridade da carteira + distância</p>
        {data.route.length === 0 ? <p className="mt-3 text-sm text-stone-500">Nenhum cliente da carteira pede visita hoje.</p> : (
          <ol className="mt-2 divide-y divide-stone-100">
            {data.route.map((r, i) => (
              <li key={r.customerId} className="grid grid-cols-[34px_1fr_auto] items-center gap-3 py-3">
                <span className={`grid size-8 place-items-center rounded-full text-sm font-extrabold ${r.visited ? "bg-emerald-100 text-emerald-800" : i === data.route.findIndex((x) => !x.visited) ? "bg-teal-700 text-white" : "bg-stone-100 text-stone-500"}`}>{r.visited ? <CheckCircle2 size={16} /> : i + 1}</span>
                <div className="min-w-0"><p className="font-bold">{r.name}</p><p className="text-sm text-stone-500">{[r.distanceKm !== null ? `a ${km(r.distanceKm)}` : null, r.reason, r.value ? `~${brl(r.value)}` : null].filter(Boolean).join(" · ")}</p></div>
                {!r.visited && (
                  <div className="flex gap-1.5">
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(r.name)}`} target="_blank" rel="noreferrer" aria-label={`Navegar até ${r.name}`} className="grid size-12 place-items-center rounded-2xl bg-stone-900 text-white"><Navigation size={18} /></a>
                    <Link href={`/clientes?cliente=${encodeURIComponent(r.customerId)}`} aria-label={`Abrir ${r.name}`} className="grid size-12 place-items-center rounded-2xl border border-stone-200 text-stone-700"><MessageCircle size={18} /></Link>
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Paradas do dia */}
      {s && s.stops.length > 0 && (
        <section className="mt-3 rounded-[24px] border border-stone-200 bg-white p-5">
          <h2 className="text-lg font-bold">Suas paradas</h2>
          <ul className="mt-2 divide-y divide-stone-100 text-sm">
            {s.stops.map((stop) => (
              <li key={stop.start} className="flex justify-between gap-3 py-2.5">
                <span><b>{stop.place?.name ?? "Parada"}</b><span className="text-stone-500"> · {time(stop.start)} · {stop.minutes} min{stop.kmFromPrevious !== null ? ` · ${km(stop.kmFromPrevious)}` : ""}</span></span>
                {stop.sold > 0 && <span className="font-bold text-emerald-700">{brl(stop.sold)}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {consentOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="consent-title" className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-[640px] overflow-y-auto rounded-t-[28px] bg-white p-6 sm:rounded-[28px]">
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
            <button type="button" disabled={!agree || busy} onClick={() => void acceptAndStart()} className="mt-3 w-full rounded-2xl bg-emerald-500 py-4 text-base font-extrabold text-emerald-950 disabled:opacity-40">Concordo e iniciar dia</button>
            <button type="button" onClick={() => setConsentOpen(false)} className="mt-2 w-full py-2 text-sm font-bold text-stone-500">Agora não</button>
            <p className="mt-1 text-center text-[11px] text-stone-400">Versão {data.consent.version} · Bispo Coffees</p>
          </div>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-stone-400">Para retirar a concordância, fale com José ou Suzi ou use Configurações no app.</p>
    </div>
  );
}
