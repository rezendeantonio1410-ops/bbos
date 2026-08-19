"use client";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  PackageOpen,
  X,
} from "lucide-react";
import { Badge, Button, Card } from "@bbos/ui";
import { fetchSessionIdentity, type SessionIdentity } from "@/lib/auth-session";
import { getApiBaseUrl } from "@/lib/api-url";
const ROOT =
    getApiBaseUrl(),
  API = `${ROOT}/receipts`,
  css =
    "w-full rounded-xl border bg-stone-50 px-3 py-3 text-sm outline-none focus:border-forest-700";
type O = { id: string; name: string };
type P = {
  id: string;
  purchaseNumber: string;
  supplierId: string;
  species: string;
  originRegion: string;
  farmName?: string;
  municipality?: string;
  state?: string;
  country?: string;
  harvest: string;
  variety?: string;
  process?: string;
  qualityCategory?: string;
  supplierLotCode?: string;
  packagingType: string;
  volumeQuantity: number;
  nominalUnitWeightKg: string;
  contractedWeightKg: string;
  maxMoisturePercent?: string;
  expectedAt?: string;
  receivedKg: number;
  balanceKg: number;
  supplier: O;
};
type Opt = {
  company: { id: string } | null;
  suppliers: O[];
  warehouses: O[];
  users: O[];
  purchases: P[];
  currentUser?: SessionIdentity;
};
type Row = {
  id: string;
  receiptNumber: string;
  qualityStatus: string;
  netWeightKg: string;
  origin: string;
  stockBalanceKg: number;
  supplier: O;
  coffeeLot: { id: string; code: string };
  labSample?: { sampleNumber: string };
};
type ReceiptResult = { receiptNumber: string; lotCode: string; sampleNumber: string };
async function req<T>(u: string, i?: RequestInit): Promise<T> {
  const r = await fetch(u, { credentials: "include", ...i }),
    d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.message ?? "Falha");
  return d;
}
function F({ l, c }: { l: string; c: React.ReactNode }) {
  return (
    <label>
      <span className="text-xs font-semibold">{l}</span>
      {c}
    </label>
  );
}
const steps = [
  "Origem",
  "Café",
  "Quantidade",
  "Triagem",
  "Documentos",
  "Conferência",
];
const displayEnum = (value?: string | null) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "—";
const speciesDisplay: Record<string, string> = { ARABICA: "Arábica", ROBUSTA_CONILON: "Robusta/Conilon" };
function Wizard({
  o,
  close,
  done,
  initialPurchaseId,
}: {
  o: Opt;
  close: () => void;
  done: (x: ReceiptResult) => void;
  initialPurchaseId: string;
}) {
  const first = o.purchases.find((purchase) => purchase.id === initialPurchaseId) ?? o.purchases[0];
  const base = (p: P) => ({
    purchaseId: p.id,
    supplierId: p.supplierId,
    warehouseId: o.warehouses[0]?.id ?? "",
    species: p.species === "ARABICA" ? "ARABICA" : "ROBUSTA_CONILON",
    origin: p.originRegion,
    farmName: p.farmName ?? "",
    municipality: p.municipality ?? "",
    state: p.state ?? "",
    country: p.country ?? "Brasil",
    harvest: p.harvest,
    variety: p.variety ?? "",
    process: p.process ?? "",
    supplierLotCode: p.supplierLotCode ?? "",
    packagingType: p.packagingType,
    volumeQuantity: p.volumeQuantity,
    nominalWeightKg: Number(p.nominalUnitWeightKg),
    grossWeightKg: 0,
    tareWeightKg: 0,
    moisturePercent: "",
    sampleCollected: true,
    visualCondition: "NORMAL",
    invoiceNumber: "",
    transportDocument: "",
    notes: "",
    unit: "KG",
    bagQuantity: p.volumeQuantity,
    bagWeightKg: Number(p.nominalUnitWeightKg),
  });
  const [d, setD] = useState(() => base(first!)),
    [s, setS] = useState(0),
    [busy, setBusy] = useState(false),
    [err, setErr] = useState("");
  const net = Math.max(0, Number(d.grossWeightKg) - Number(d.tareWeightKg));
  const set = (k: keyof typeof d, v: (typeof d)[keyof typeof d]) => setD((x) => ({ ...x, [k]: v }));
  const submit = async () => {
    setBusy(true);
    try {
      const x = await req<ReceiptResult>(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...d,
          idempotencyKey: crypto.randomUUID(),
          netWeightKg: net,
          qualityStatus: "AWAITING_ANALYSIS",
          moisturePercent: d.moisturePercent
            ? Number(d.moisturePercent)
            : undefined,
        }),
      });
      done(x);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Falha");
      setBusy(false);
    }
  };
  const purchase = o.purchases.find((p) => p.id === d.purchaseId);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-forest-950/30 p-2">
      <div className="flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white">
        <header className="flex justify-between border-b p-5">
          <div>
            <p className="text-xs font-bold uppercase text-forest-700">
              Novo recebimento · {s + 1}/6
            </p>
            <h2 className="text-xl font-bold">{steps[s]}</h2>
          </div>
          <button onClick={close}>
            <X />
          </button>
        </header>
        <div className="grid grid-cols-6 gap-1 px-5 py-3">
          {steps.map((x, i) => (
            <div
              key={x}
              className={`h-1.5 rounded ${i <= s ? "bg-forest-800" : "bg-stone-100"}`}
            />
          ))}
        </div>
        <main className="overflow-y-auto p-5 sm:p-8">
          <div className="mx-auto grid max-w-2xl gap-4 sm:grid-cols-2">
            {s === 0 && (
              <>
                <div className="sm:col-span-2">
                  <F
                    l="Compra vinculada"
                    c={
                      <select
                        className={css}
                        value={d.purchaseId}
                        onChange={(e) => {
                          const p = o.purchases.find(
                            (x) => x.id === e.target.value,
                          );
                          if (p) setD(base(p));
                        }}
                      >
                        {o.purchases.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.purchaseNumber} · {p.supplier.name} · saldo{" "}
                            {p.balanceKg} kg
                          </option>
                        ))}
                      </select>
                    }
                  />
                </div>
                <F
                  l="Fornecedor"
                  c={
                    <input
                      disabled
                      className={css}
                      value={purchase?.supplier.name ?? ""}
                    />
                  }
                />
                <F
                  l="Responsável"
                  c={
                    <input
                      disabled
                      className={css}
                      value={o.currentUser?.name ?? "Usuário logado"}
                    />
                  }
                />
                <F
                  l="Armazém"
                  c={
                    <select
                      className={css}
                      value={d.warehouseId}
                      onChange={(e) => set("warehouseId", e.target.value)}
                    >
                      {o.warehouses.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                  }
                />
                <F
                  l="Região de origem"
                  c={
                    <input
                      className={css}
                      value={d.origin}
                      onChange={(e) => set("origin", e.target.value)}
                    />
                  }
                />
                <F
                  l="Fazenda"
                  c={
                    <input
                      className={css}
                      value={d.farmName}
                      onChange={(e) => set("farmName", e.target.value)}
                    />
                  }
                />
                <F
                  l="Município / Estado / País"
                  c={
                    <input
                      className={css}
                      value={`${d.municipality} / ${d.state} / ${d.country}`}
                      readOnly
                    />
                  }
                />
              </>
            )}
            {s === 1 && (
              <>
                <F
                  l="Espécie *"
                  c={
                    <select
                      className={css}
                      value={d.species}
                      onChange={(e) => set("species", e.target.value)}
                    >
                      <option value="ARABICA">Arábica</option>
                      <option value="ROBUSTA_CONILON">
                        Canephora / Robusta / Conilon
                      </option>
                    </select>
                  }
                />
                <F
                  l="Safra *"
                  c={
                    <input
                      className={css}
                      value={d.harvest}
                      onChange={(e) => set("harvest", e.target.value)}
                    />
                  }
                />
                <F
                  l="Variedade/Cultivar"
                  c={
                    <input
                      className={css}
                      value={d.variety}
                      onChange={(e) => set("variety", e.target.value)}
                    />
                  }
                />
                <F
                  l="Processo"
                  c={
                    <select
                      className={css}
                      value={d.process}
                      onChange={(e) => set("process", e.target.value)}
                    >
                      {[
                        "Natural",
                        "Cereja Descascado",
                        "Honey",
                        "Lavado",
                        "Fermentado",
                        "Outro",
                      ].map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  }
                />
                <F
                  l="Lote fornecedor"
                  c={
                    <input
                      className={css}
                      value={d.supplierLotCode}
                      onChange={(e) => set("supplierLotCode", e.target.value)}
                    />
                  }
                />
              </>
            )}
            {s === 2 && (
              <>
                <F
                  l="Acondicionamento"
                  c={
                    <select
                      className={css}
                      value={d.packagingType}
                      onChange={(e) => set("packagingType", e.target.value)}
                    >
                      <option value="BAG_30_KG">Saca 30 kg</option>
                      <option value="BAG_60_KG">Saca 60 kg</option>
                      <option value="BIG_BAG">Big Bag</option>
                      <option value="OTHER">Outro</option>
                    </select>
                  }
                />
                <F
                  l="Volumes"
                  c={
                    <input
                      type="number"
                      className={css}
                      value={d.volumeQuantity}
                      onChange={(e) =>
                        set("volumeQuantity", Number(e.target.value))
                      }
                    />
                  }
                />
                <F
                  l="Peso nominal/volume"
                  c={
                    <input
                      type="number"
                      className={css}
                      value={d.nominalWeightKg}
                      onChange={(e) =>
                        set("nominalWeightKg", Number(e.target.value))
                      }
                    />
                  }
                />
                <F
                  l="Peso bruto real"
                  c={
                    <input
                      type="number"
                      className={css}
                      value={d.grossWeightKg || ""}
                      onChange={(e) =>
                        set("grossWeightKg", Number(e.target.value))
                      }
                    />
                  }
                />
                <F
                  l="Tara"
                  c={
                    <input
                      type="number"
                      className={css}
                      value={d.tareWeightKg || ""}
                      onChange={(e) =>
                        set("tareWeightKg", Number(e.target.value))
                      }
                    />
                  }
                />
                <Card className="bg-forest-950 p-4 text-white">
                  <small>Peso líquido oficial</small>
                  <b className="block text-xl">{net} kg</b>
                </Card>
              </>
            )}
            {s === 3 && (
              <>
                <div className="sm:col-span-2 rounded-xl bg-amber-50 p-4 text-sm">
                  <b>Status: AGUARDANDO ANÁLISE</b>
                  <br />A triagem cria uma amostra LAB e mantém o lote em
                  quarentena.
                </div>
                <F
                  l="Umidade inicial (%)"
                  c={
                    <input
                      type="number"
                      step=".1"
                      className={css}
                      value={d.moisturePercent}
                      onChange={(e) => set("moisturePercent", e.target.value)}
                    />
                  }
                />
                <F
                  l="Amostra coletada"
                  c={
                    <select className={css} value="SIM">
                      <option>SIM</option>
                    </select>
                  }
                />
                <F
                  l="Condição visual"
                  c={
                    <select
                      className={css}
                      value={d.visualCondition}
                      onChange={(e) => set("visualCondition", e.target.value)}
                    >
                      <option>NORMAL</option>
                      <option>ATENÇÃO</option>
                      <option>NÃO_CONFORME</option>
                    </select>
                  }
                />
                <F
                  l="Observações"
                  c={
                    <textarea
                      className={css}
                      value={d.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  }
                />
              </>
            )}
            {s === 4 && (
              <>
                <div className="sm:col-span-2 rounded-xl bg-stone-50 p-4">
                  <b>Compra vinculada:</b> {purchase?.purchaseNumber}
                </div>
                <F
                  l="Nota Fiscal · XML/PDF"
                  c={
                    <input
                      className={css}
                      value={d.invoiceNumber}
                      onChange={(e) => set("invoiceNumber", e.target.value)}
                      placeholder="Número ou referência do arquivo"
                    />
                  }
                />
                <F
                  l="CT-e / MDF-e / transporte"
                  c={
                    <input
                      className={css}
                      value={d.transportDocument}
                      onChange={(e) => set("transportDocument", e.target.value)}
                    />
                  }
                />
                <F
                  l="Romaneio / ticket de balança"
                  c={<input className={css} placeholder="Referência" />}
                />
                <F
                  l="Observações"
                  c={
                    <textarea
                      className={css}
                      value={d.notes}
                      onChange={(e) => set("notes", e.target.value)}
                    />
                  }
                />
              </>
            )}
            {s === 5 && (
              <div className="sm:col-span-2">
                <h3 className="font-bold">COMPRADO × RECEBIDO × ANALISADO</h3>
                <div className="mt-4 grid gap-2">
                  {[
                    ["Espécie", purchase?.species, d.species],
                    ["Safra", purchase?.harvest, d.harvest],
                    ["Quantidade", `${purchase?.balanceKg} kg`, `${net} kg`],
                    ["Origem", purchase?.originRegion, d.origin],
                    [
                      "Umidade máxima",
                      purchase?.maxMoisturePercent
                        ? `${purchase.maxMoisturePercent}%`
                        : "—",
                      d.moisturePercent
                        ? `${d.moisturePercent}%`
                        : "Aguardando Lab",
                    ],
                    ["Peneira", "Contratada", "Aguardando Lab"],
                    ["Defeitos", "Contratado", "Aguardando Lab"],
                    ["Qualidade", "Contratada", "Aguardando Lab"],
                  ].map(([a, b, c]) => (
                    <div
                      key={a}
                      className="grid grid-cols-3 gap-2 rounded-xl bg-stone-50 p-3 text-xs"
                    >
                      <b>{a}</b>
                      <span>{b}</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {err && (
              <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {err}
              </p>
            )}
          </div>
        </main>
        <footer className="flex justify-between border-t p-4">
          <button
            disabled={!s}
            onClick={() => setS((x) => x - 1)}
            className="min-h-11 px-3"
          >
            <ArrowLeft className="inline" /> Voltar
          </button>
          {s < 5 ? (
            <Button onClick={() => setS((x) => x + 1)}>
              Continuar <ArrowRight />
            </Button>
          ) : (
            <Button disabled={busy || net <= 0} onClick={submit}>
              <Check />
              Confirmar entrada e gerar lote
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
export default function Page() {
  const [o, setO] = useState<Opt | null>(null),
    [rows, setRows] = useState<Row[]>([]),
    [open, setOpen] = useState(false),
    [msg, setMsg] = useState(""),
    [err, setErr] = useState(""),
    [selectedPurchaseId, setSelectedPurchaseId] = useState("");
  const load = () =>
    Promise.all([
      req<Opt>(`${API}/options`, { credentials: "include" }),
      req<Row[]>(API, { credentials: "include" }),
      fetchSessionIdentity(ROOT),
      ])
      .then(async ([a, b, identity]) => {
        setO({ ...a, currentUser: identity });
        setRows(b);
      })
      .catch((e) => setErr(String(e)));
  useEffect(() => {
    void load();
  }, []);
  const kg = useMemo(
    () => rows.reduce((s, r) => s + Number(r.netWeightKg), 0),
    [rows],
  );
  return (
    <div className="mx-auto max-w-[1480px]">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase text-forest-700">
            <PackageOpen className="inline" size={15} /> Processo operacional
          </p>
          <h1 className="mt-2 text-3xl font-bold">Recebimento de café verde</h1>
          <p className="mt-2 text-sm text-stone-500">Fila operacional de entradas vinculadas a compras confirmadas.</p>
        </div>
      </header>
      {msg && (
        <p className="mt-5 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800">
          {msg}
        </p>
      )}
      {err && (
        <p className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">
          {err}
        </p>
      )}
      <div className="mt-7 flex flex-wrap gap-2"><button className="min-h-11 rounded-xl bg-forest-900 px-4 text-sm font-bold text-white">Aguardando entrada ({o?.purchases.length ?? 0})</button><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Recebimento parcial</button><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Em quarentena</button><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Laboratório</button><button className="min-h-11 rounded-xl border px-4 text-sm font-semibold">Concluídos</button></div>
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          Recebimentos<b className="mt-2 block text-xl">{rows.length}</b>
        </Card>
        <Card className="p-5">
          Peso físico<b className="mt-2 block text-xl">{kg} kg</b>
        </Card>
        <Card className="p-5">
          Em quarentena
          <b className="mt-2 block text-xl">
            {rows.filter((r) => r.qualityStatus === "AWAITING_ANALYSIS").length}
          </b>
        </Card>
      </div>
      <section className="mt-7"><div className="mb-3"><h2 className="text-lg font-bold">Aguardando entrada</h2><p className="text-sm text-stone-500">Compras aprovadas, confirmadas e com saldo físico disponível.</p></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{o?.purchases.map((purchase) => <button key={purchase.id} type="button" onClick={() => { setSelectedPurchaseId(purchase.id); setOpen(true); }} className="rounded-2xl border border-amber-200 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-forest-700">{purchase.purchaseNumber}</p><h3 className="mt-1 text-lg font-bold">{purchase.supplier.name}</h3></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">Pronto para recebimento</span></div><p className="mt-3 text-sm text-stone-600">{displayEnum(purchase.qualityCategory)} · {speciesDisplay[purchase.species] ?? displayEnum(purchase.species)} · {displayEnum(purchase.variety)}</p><div className="mt-4 grid grid-cols-3 gap-3 text-xs"><span><small className="block text-stone-500">Contratado</small><b>{purchase.contractedWeightKg} kg · {purchase.volumeQuantity} volumes</b></span><span><small className="block text-stone-500">Recebido</small><b>{purchase.receivedKg} kg</b></span><span><small className="block text-stone-500">Saldo</small><b>{purchase.balanceKg} kg</b></span></div><p className="mt-4 text-xs text-stone-500">{purchase.expectedAt ? `Entrega prevista: ${new Date(purchase.expectedAt).toLocaleDateString("pt-BR")}` : "Entrega ainda não programada"}</p></button>)}</div>{o && o.purchases.length === 0 && <Card className="p-6 text-sm text-stone-500">Nenhuma compra elegível aguardando entrada.</Card>}</section>
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((r) => (
          <Card key={r.id} className="p-5">
            <div className="flex justify-between">
              <b>{r.receiptNumber}</b>
              <Badge tone="warning">{r.qualityStatus}</Badge>
            </div>
            <h3 className="mt-2 font-bold">{r.coffeeLot.code}</h3>
            <p className="mt-2 text-sm">
              {r.supplier.name} · {r.origin}
            </p>
            <p className="mt-3 text-xs">
              {r.netWeightKg} kg · saldo por movimentos {r.stockBalanceKg} kg
            </p>
            <a
              href={`/estoque?lot=${r.coffeeLot.id}`}
              className="mt-3 inline-block min-h-11 text-xs font-bold text-forest-700"
            >
              Ver lote e rastreabilidade →
            </a>
          </Card>
        ))}
      </div>
      {open && o && (
        <Wizard
          o={o}
          initialPurchaseId={selectedPurchaseId}
          close={() => setOpen(false)}
          done={(x: ReceiptResult) => {
            setOpen(false);
            setMsg(
              `${x.receiptNumber} · ${x.lotCode} · ${x.sampleNumber} criados em quarentena.`,
            );
            void load();
          }}
        />
      )}
    </div>
  );
}
