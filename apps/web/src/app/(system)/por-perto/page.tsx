"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  ClipboardPen,
  Crosshair,
  LocateFixed,
  MapPinOff,
  Navigation,
  Phone,
  RefreshCw,
  Store,
  UserRound,
} from "lucide-react";
import {
  POTENTIAL_LABEL,
  SEGMENT_LABEL,
  STAGE_LABEL,
  STAGE_TONE,
  addressLine,
  directionsUrl,
  formatDistance,
  formatPhone,
  rhythmText,
} from "@/lib/prospecting";

type Rhythm = {
  orders: number;
  lastOrderAt: string | null;
  usualIntervalDays: number | null;
  daysSinceLastOrder: number | null;
  overdueDays: number;
  suggestVisit: boolean;
};
type Place = {
  id: string;
  name: string;
  tradeName?: string | null;
  phone?: string | null;
  address?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  latitude: number;
  longitude: number;
  geocodeSource?: string | null;
  distanceKm: number;
};
type NearbyCustomer = Place & { rhythm: Rhythm };
type NearbyProspect = Place & { segment: string; stage: string; potential: string; nextAction?: string | null };
type NearbyResponse = {
  radiusKm: number;
  customers: NearbyCustomer[];
  prospects: NearbyProspect[];
  withoutLocation: { customers: number; prospects: number };
};
type Position = { lat: number; lng: number; accuracy: number };

const RADII = [1, 3, 10] as const;
/** Refresh the list after walking/driving this far. */
const REFRESH_AFTER_METERS = 150;

function metersBetween(a: Position, b: Position) {
  const rad = Math.PI / 180;
  const x = (b.lng - a.lng) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6_371_000;
}

export default function NearbyPage() {
  const [position, setPosition] = useState<Position | null>(null);
  const [radiusKm, setRadiusKm] = useState<number>(3);
  const [filter, setFilter] = useState<"all" | "customers" | "prospects">("all");
  const [data, setData] = useState<NearbyResponse | null>(null);
  const [locating, setLocating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lastFetched = useRef<Position | null>(null);
  const watchId = useRef<number | null>(null);

  const load = useCallback(async (where: Position, radius: number) => {
    setLoading(true);
    setError("");
    try {
      const query = new URLSearchParams({ lat: String(where.lat), lng: String(where.lng), radiusKm: String(radius), notify: "1" });
      const response = await fetch(`/api/nearby?${query}`, { credentials: "include", cache: "no-store" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message ?? "Não foi possível buscar quem está por perto.");
      setData(payload as NearbyResponse);
      lastFetched.current = where;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível buscar quem está por perto.");
    } finally {
      setLoading(false);
    }
  }, []);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Este aparelho não informa a localização.");
      return;
    }
    setLocating(true);
    setError("");
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = navigator.geolocation.watchPosition(
      (event) => {
        setLocating(false);
        setPosition({ lat: event.coords.latitude, lng: event.coords.longitude, accuracy: event.coords.accuracy });
      },
      (cause) => {
        setLocating(false);
        setError(
          cause.code === cause.PERMISSION_DENIED
            ? "Permita o acesso à localização nas configurações do navegador para ver quem está por perto."
            : "Não foi possível obter a sua localização agora. Tente de novo ao ar livre.",
        );
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
  }, []);

  // Starts automatically when permission was already given.
  useEffect(() => {
    let cancelled = false;
    navigator.permissions
      ?.query({ name: "geolocation" as PermissionName })
      .then((status) => { if (!cancelled && status.state === "granted") locate(); })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [locate]);

  useEffect(() => {
    if (!position) return;
    const previous = lastFetched.current;
    if (previous && metersBetween(previous, position) < REFRESH_AFTER_METERS && data?.radiusKm === radiusKm) return;
    void load(position, radiusKm);
  }, [position, radiusKm, load, data?.radiusKm]);

  const pinHere = async (customer: NearbyCustomer) => {
    if (!position) return;
    if (!window.confirm(`Gravar a sua posição atual como o local de ${customer.tradeName || customer.name}? Use só se você estiver na porta do cliente.`)) return;
    const response = await fetch(`/api/nearby/customers/${encodeURIComponent(customer.id)}/location`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ latitude: position.lat, longitude: position.lng }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) { setError(payload?.message ?? "Não foi possível gravar o local."); return; }
    setNotice("Local do cliente atualizado pelo GPS.");
    void load(position, radiusKm);
  };

  const suggested = useMemo(() => (data?.customers ?? []).filter((c) => c.rhythm.suggestVisit), [data]);
  const items = useMemo(() => {
    const customers = filter === "prospects" ? [] : (data?.customers ?? []).filter((c) => !c.rhythm.suggestVisit);
    const prospects = filter === "customers" ? [] : data?.prospects ?? [];
    return [
      ...customers.map((c) => ({ kind: "customer" as const, place: c })),
      ...prospects.map((p) => ({ kind: "prospect" as const, place: p })),
    ].sort((a, b) => a.place.distanceKm - b.place.distanceKm);
  }, [data, filter]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-28 pt-4 sm:px-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--bbos-coffee-green)]">Vendas</p>
          <h1 className="mt-1 text-2xl font-bold">Por perto</h1>
          <p className="mt-1 text-sm text-stone-600">Clientes e pré-cadastros ao seu redor, do mais perto ao mais longe.</p>
        </div>
        <button
          type="button"
          onClick={() => (position ? void load(position, radiusKm) : locate())}
          disabled={locating || loading}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 text-sm font-semibold text-stone-700 disabled:opacity-60"
          aria-label="Atualizar"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
          <span className="hidden sm:inline">Atualizar</span>
        </button>
      </header>

      {!position && (
        <section className="mt-6 rounded-3xl border border-stone-200 bg-white p-6 text-center shadow-sm">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-700">
            <LocateFixed size={26} />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Ver quem está perto de mim</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-stone-600">
            O sistema usa a localização do aparelho só enquanto esta tela estiver aberta.
          </p>
          <button
            type="button"
            onClick={locate}
            disabled={locating}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-stone-950 px-5 text-base font-semibold text-white disabled:opacity-60"
          >
            <Crosshair size={18} /> {locating ? "Localizando..." : "Usar minha localização"}
          </button>
        </section>
      )}

      {error && <p role="alert" className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
      {notice && <p role="status" className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}

      {position && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Distância" className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
              {RADII.map((radius) => (
                <button
                  key={radius}
                  type="button"
                  aria-pressed={radiusKm === radius}
                  onClick={() => setRadiusKm(radius)}
                  className={`min-h-10 min-w-14 rounded-lg px-3 text-sm font-semibold ${radiusKm === radius ? "bg-stone-950 text-white" : "text-stone-600"}`}
                >
                  {radius} km
                </button>
              ))}
            </div>
            <div role="group" aria-label="Mostrar" className="inline-flex rounded-xl border border-stone-200 bg-white p-1">
              {([["all", "Todos"], ["customers", "Clientes"], ["prospects", "Pré-cadastros"]] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`min-h-10 rounded-lg px-3 text-sm font-semibold ${filter === value ? "bg-stone-950 text-white" : "text-stone-600"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="text-xs text-stone-500">Precisão do GPS: ~{Math.round(position.accuracy)} m</span>
          </div>

          {suggested.length > 0 && filter !== "prospects" && (
            <section className="mt-5" aria-labelledby="suggested-title">
              <h2 id="suggested-title" className="flex items-center gap-2 text-sm font-bold text-amber-800">
                <BellRing size={17} /> Sugestão de visita: passaram do momento de comprar
              </h2>
              <ul className="mt-2 grid gap-3">
                {suggested.map((customer) => (
                  <CustomerCard key={customer.id} customer={customer} highlight onPinHere={() => void pinHere(customer)} />
                ))}
              </ul>
            </section>
          )}

          <ul className="mt-5 grid gap-3">
            {items.map((item) =>
              item.kind === "customer" ? (
                <CustomerCard key={`c-${item.place.id}`} customer={item.place} onPinHere={() => void pinHere(item.place)} />
              ) : (
                <ProspectCard key={`p-${item.place.id}`} prospect={item.place} />
              ),
            )}
          </ul>

          {data && !loading && !items.length && !suggested.length && (
            <p className="mt-6 rounded-2xl border border-dashed border-stone-300 p-6 text-center text-sm text-stone-600">
              Ninguém a até {data.radiusKm} km. Aumente a distância acima.
            </p>
          )}

          {data && (data.withoutLocation.customers > 0 || data.withoutLocation.prospects > 0) && (
            <p className="mt-6 flex items-start gap-2 text-xs leading-5 text-stone-500">
              <MapPinOff size={15} className="mt-0.5 shrink-0" />
              Ainda sem localização: {data.withoutLocation.customers} clientes e {data.withoutLocation.prospects} pré-cadastros.
              O sistema localiza pelo endereço aos poucos; na visita, toque em “Estou aqui” para gravar o ponto exato.
            </p>
          )}
        </>
      )}
    </main>
  );
}

function Actions({ lat, lng, phone, visitHref, visitLabel }: { lat: number; lng: number; phone?: string | null; visitHref: string; visitLabel: string }) {
  const base = "inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-semibold";
  return (
    <div className="mt-3 flex gap-2">
      <a href={directionsUrl(lat, lng)} target="_blank" rel="noreferrer" className={`${base} border-stone-200 bg-white text-stone-800`}>
        <Navigation size={16} /> Rota
      </a>
      {phone && (
        <a href={`tel:${phone.replace(/\D/g, "")}`} className={`${base} border-stone-200 bg-white text-stone-800`}>
          <Phone size={16} /> Ligar
        </a>
      )}
      <Link href={visitHref} className={`${base} border-stone-950 bg-stone-950 text-white`}>
        <ClipboardPen size={16} /> {visitLabel}
      </Link>
    </div>
  );
}

function CustomerCard({ customer, highlight, onPinHere }: { customer: NearbyCustomer; highlight?: boolean; onPinHere: () => void }) {
  return (
    <li className={`rounded-2xl border bg-white p-4 shadow-sm ${highlight ? "border-amber-300 ring-1 ring-amber-200" : "border-stone-200"}`}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-700" aria-hidden>
          <UserRound size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{customer.tradeName || customer.name}</p>
            <span className="shrink-0 text-sm font-bold tabular-nums text-stone-900">{formatDistance(customer.distanceKm)}</span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">Cliente · {addressLine(customer)}</p>
          <p className={`mt-1 text-sm ${customer.rhythm.suggestVisit ? "font-semibold text-amber-800" : "text-stone-600"}`}>{rhythmText(customer.rhythm)}</p>
          {customer.phone && <p className="text-xs text-stone-500">{formatPhone(customer.phone)}</p>}
        </div>
      </div>
      <Actions
        lat={customer.latitude}
        lng={customer.longitude}
        phone={customer.phone}
        visitHref={`/atendimento?cliente=${encodeURIComponent(customer.id)}`}
        visitLabel="Visita"
      />
      <button type="button" onClick={onPinHere} className="mt-2 text-xs font-semibold text-stone-500 underline-offset-2 hover:underline">
        Local errado? Estou aqui na porta
      </button>
    </li>
  );
}

function ProspectCard({ prospect }: { prospect: NearbyProspect }) {
  return (
    <li className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700" aria-hidden>
          <Store size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-tight">{prospect.name}</p>
            <span className="shrink-0 text-sm font-bold tabular-nums text-stone-900">{formatDistance(prospect.distanceKm)}</span>
          </div>
          <p className="mt-0.5 text-xs text-stone-500">
            {SEGMENT_LABEL[prospect.segment] ?? "Pré-cadastro"} · {addressLine(prospect)}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className={`rounded-full px-2 py-0.5 ${STAGE_TONE[prospect.stage] ?? "bg-stone-100"}`}>{STAGE_LABEL[prospect.stage] ?? prospect.stage}</span>
            <span className="rounded-full bg-stone-100 px-2 py-0.5 text-stone-700">Potencial: {POTENTIAL_LABEL[prospect.potential] ?? "—"}</span>
          </div>
          {prospect.nextAction && <p className="mt-1 text-xs text-stone-600">Próxima ação: {prospect.nextAction}</p>}
        </div>
      </div>
      <Actions
        lat={prospect.latitude}
        lng={prospect.longitude}
        phone={prospect.phone}
        visitHref={`/prospeccao?id=${encodeURIComponent(prospect.id)}`}
        visitLabel="Visitar"
      />
    </li>
  );
}
