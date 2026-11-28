"use client";

import { useEffect, useState } from "react";
import { fetchSessionIdentity, getApiRoot } from "@/lib/auth-session";

type Trip = {
  id: string;
  owner: string;
  vehicle: string;
  startedAt: number;
  endedAt?: number;
  distanceMeters: number;
  incomplete: boolean;
  hasFix?: boolean;
};
type ReportTrip = Omit<Trip, "owner" | "startedAt" | "endedAt"> & {
  day: string;
  userId: string;
  user: { name: string };
  startedAt: string;
  endedAt: string;
};
type Device = { active?: Trip; pending: Trip[]; error?: string };
type Bridge = {
  postMessage: (message: string) => void;
  onmessage: ((event: MessageEvent<string>) => void) | null;
};

const calendar = new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" });
const reportTime = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit",
});
const km = (meters: number) => `${(meters / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} km`;
const button = "rounded-lg bg-forest-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";

export default function MileagePage() {
  const [owner, setOwner] = useState("");
  const [ownerReady, setOwnerReady] = useState(false);
  const [bridge, setBridge] = useState<Bridge>();
  const [device, setDevice] = useState<Device>({ pending: [] });
  const [vehicle, setVehicle] = useState("");
  const [month, setMonth] = useState(() => calendar.format(new Date()).slice(0, 7));
  const [trips, setTrips] = useState<ReportTrip[]>();
  const [error, setError] = useState("");
  const [syncError, setSyncError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    setBridge((window as Window & { BBOSMileage?: Bridge }).BBOSMileage);
    let active = true;
    void fetchSessionIdentity(getApiRoot()).then(session => {
      if (active) setOwner(session.id);
    }).catch(() => {
      if (active) setError("Não foi possível confirmar a sessão do BBOS.");
    }).finally(() => {
      if (active) setOwnerReady(true);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bridge) return;
    let syncing = false;
    let alive = true;
    const send = (message: object) => bridge.postMessage(JSON.stringify(message));
    bridge.onmessage = ({ data }) => {
      const state = JSON.parse(data) as Device;
      setDevice(state);
      if (syncing || !owner) return;
      const pending = state.pending.filter(trip => trip.owner === owner);
      if (!pending.length) return;
      syncing = true;
      void (async () => {
        for (const trip of pending) {
          const response = await fetch("/api/mileage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(trip),
          });
          if (!response.ok) throw new Error();
          if (!alive) return;
          send({ action: "ack", id: trip.id, owner });
          setRevision(value => value + 1);
        }
        if (alive) setSyncError("");
      })().catch(() => {
        if (alive) setSyncError("Percurso salvo no aparelho. A sincronização será tentada novamente.");
      }).finally(() => { syncing = false; });
    };
    const refresh = () => send({ action: "status", owner });
    const timer = window.setInterval(refresh, 3000);
    window.addEventListener("online", refresh);
    refresh();
    return () => {
      alive = false;
      window.clearInterval(timer);
      window.removeEventListener("online", refresh);
      bridge.onmessage = null;
    };
  }, [bridge, owner]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/mileage?month=${encodeURIComponent(month)}`, { signal: controller.signal, cache: "no-store" })
      .then(async response => {
        if (!response.ok) throw new Error();
        const report = await response.json() as { trips: ReportTrip[] };
        if (!controller.signal.aborted) {
          setTrips(report.trips);
          setError("");
        }
      }).catch(() => {
        if (!controller.signal.aborted) setError("Não foi possível carregar o relatório.");
      });
    return () => controller.abort();
  }, [month, revision]);

  const days = new Map<string, ReportTrip[]>();
  for (const trip of trips ?? []) {
    const dayTrips = days.get(trip.day) ?? [];
    dayTrips.push(trip);
    days.set(trip.day, dayTrips);
  }
  const weeks = new Map<string, number>();
  for (const [day, rows] of days) {
    const monday = new Date(`${day}T00:00:00Z`);
    monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
    const key = monday.toISOString().slice(5, 10).split("-").reverse().join("/");
    weeks.set(key, (weeks.get(key) ?? 0) + rows.reduce((sum, trip) => sum + trip.distanceMeters, 0));
  }
  const total = (trips ?? []).reduce((sum, trip) => sum + trip.distanceMeters, 0);
  const active = device.active;
  const ownTrip = active?.owner === owner;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="text-2xl font-semibold">Quilometragem</h1>
      <section className="space-y-3 rounded-xl border bg-white p-5">
        <h2 className="font-semibold">Percurso</h2>
        {!bridge && <p className="text-sm text-stone-600">Use o app Android do BBOS para registrar um percurso com a tela bloqueada.</p>}
        {bridge && !active && (
          <form className="flex flex-wrap items-end gap-3" onSubmit={event => {
            event.preventDefault();
            bridge.postMessage(JSON.stringify({ action: "start", owner, vehicle: vehicle.trim() }));
          }}>
            <label className="grid gap-1 text-sm">Veículo
              <input required maxLength={80} value={vehicle} onChange={event => setVehicle(event.target.value)}
                placeholder="Placa ou nome do veículo" className="rounded-lg border px-3 py-2" />
            </label>
            <button className={button} disabled={!ownerReady || !owner || !vehicle.trim()}>Iniciar percurso</button>
          </form>
        )}
        {bridge && active && (
          <div className="space-y-2">
            <p role="status" className="text-sm">
              {ownTrip ? `${active.hasFix ? "GPS ativo" : "Aguardando sinal do GPS"} · ${active.vehicle} · ${km(active.distanceMeters)}`
                : "Há um percurso ativo de outra conta neste aparelho."}
            </p>
            {ownTrip && <button className={button} onClick={() => bridge.postMessage(JSON.stringify({ action: "stop", owner }))}>Encerrar percurso</button>}
          </div>
        )}
        {(device.error || syncError) && <p role="status" className="text-sm text-amber-800">{device.error || syncError}</p>}
      </section>
      <section className="space-y-4 rounded-xl border bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h2 className="font-semibold">Relatório diário</h2><p className="text-sm">Total do mês · {km(total)}</p></div>
          <label className="grid gap-1 text-sm">Mês
            <input type="month" value={month} onChange={event => {
              if (event.target.value) { setTrips(undefined); setMonth(event.target.value); }
            }} className="rounded-lg border px-3 py-2" />
          </label>
        </div>
        {error ? <p role="alert">{error}</p> : !trips ? <p>Carregando…</p> : !trips.length && <p>Nenhum percurso neste mês.</p>}
        {!!weeks.size && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium">Totais por semana dentro do mês</summary>
            <ul className="mt-2 space-y-1">
              {[...weeks].map(([monday, meters]) => <li key={monday}>Semana de {monday} · {km(meters)}</li>)}
            </ul>
          </details>
        )}
        {[...days].map(([day, rows]) => (
          <div key={day} className="space-y-2 border-t pt-3">
            <h3 className="text-sm font-semibold">{day.split("-").reverse().join("/")} · {km(rows.reduce((sum, row) => sum + row.distanceMeters, 0))}</h3>
            <ul className="space-y-1 text-sm text-stone-600">
              {rows.map(row => <li key={`${row.userId}-${row.id}`}>{row.user.name} · {row.vehicle} · {km(row.distanceMeters)} · {reportTime.format(new Date(row.startedAt))}–{reportTime.format(new Date(row.endedAt))}
                {row.incomplete && <span className="ml-2 text-amber-800">Medição parcial</span>}</li>)}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
