"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, LockKeyhole, Save } from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

const PROFILES = [
  ["DISTRIBUIDOR", "Distribuidor"],
  ["CAFETERIA", "Cafeteria"],
  ["ESCRITORIO", "Escritório"],
  ["VAREJO", "Varejo"],
  ["RESTAURANTE_HOTEL", "Restaurante / Hotel"],
  ["WHITE_LABEL", "White Label"],
  ["EXPORTACAO", "Exportação"],
  ["CONSUMIDOR_FINAL", "Consumidor final"],
  ["OUTRO", "Outro"],
] as const;

type Channel = { id: string; code: string; name: string; currency?: string | null };
type Variant = { productVariantId: string; line: string; product: string; sku: string; presentationGrams: number };
type Price = { id: string; productVariantId: string; salesChannelId: string; channelCode: string; currency: string; price: string | number };
type User = { role: string; name: string };

type CellKey = `${string}:${string}`;

export default function PriceMatrixPage() {
  const [channels, setChannels] = React.useState<Channel[]>([]);
  const [variants, setVariants] = React.useState<Variant[]>([]);
  const [prices, setPrices] = React.useState<Price[]>([]);
  const [user, setUser] = React.useState<User | null>(null);
  const [drafts, setDrafts] = React.useState<Record<CellKey, string>>({});
  const [saving, setSaving] = React.useState<CellKey | "">("");
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    const [channelsResponse, pricesResponse, optionsResponse, meResponse] = await Promise.all([
      fetch(`${API}/commerce/channels`, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/commerce/prices`, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/sales-orders/options`, { credentials: "include", cache: "no-store" }),
      fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" }),
    ]);
    const nextChannels = channelsResponse.ok ? await channelsResponse.json() : [];
    const nextPrices = pricesResponse.ok ? await pricesResponse.json() : [];
    const options = optionsResponse.ok ? await optionsResponse.json() : { variants: [] };
    const me = meResponse.ok ? await meResponse.json() : null;
    setChannels(nextChannels);
    setPrices(nextPrices);
    setVariants(options.variants ?? []);
    setUser(me?.user ?? null);
    const nextDrafts: Record<CellKey, string> = {};
    for (const variant of options.variants ?? []) {
      for (const [profileCode] of PROFILES) {
        const channel = nextChannels.find((item: Channel) => item.code === profileCode);
        const price = channel ? nextPrices.find((item: Price) => item.productVariantId === variant.productVariantId && item.salesChannelId === channel.id) : null;
        nextDrafts[`${variant.productVariantId}:${profileCode}`] = price ? String(price.price) : "";
      }
    }
    setDrafts(nextDrafts);
  }, []);

  React.useEffect(() => { void load(); }, [load]);

  const canEdit = user ? ["ADMIN", "EXECUTIVE"].includes(user.role) : false;
  const channelByCode = React.useMemo(() => Object.fromEntries(channels.map((channel) => [channel.code, channel])), [channels]);
  const priceByCell = React.useMemo(() => {
    const map: Record<CellKey, Price> = {};
    for (const price of prices) map[`${price.productVariantId}:${price.channelCode}`] = price;
    return map;
  }, [prices]);

  const saveCell = async (variant: Variant, profileCode: string) => {
    const key = `${variant.productVariantId}:${profileCode}` as CellKey;
    const raw = (drafts[key] ?? "").trim().replace(",", ".");
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      setMessage("Informe um preço válido.");
      return;
    }
    const channel = channelByCode[profileCode];
    if (!channel) {
      setMessage(`O perfil ${profileCode} ainda não possui canal comercial ativo.`);
      return;
    }
    const existing = priceByCell[key];
    setSaving(key);
    setMessage("");
    const response = existing
      ? await fetch(`${API}/commerce/prices/${existing.id}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ price: amount }),
        })
      : await fetch(`${API}/commerce/prices`, {
          method: "POST",
          credentials: "include",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            companyId: "managed-by-session",
            salesChannelId: channel.id,
            productVariantId: variant.productVariantId,
            currency: channel.currency || (profileCode === "EXPORTACAO" ? "USD" : "BRL"),
            price: amount,
            validFrom: new Date().toISOString(),
          }),
        });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) setMessage(payload.message ?? "Não foi possível salvar o preço.");
    else {
      setMessage(`${variant.product} · ${formatWeight(variant.presentationGrams)} · ${channel.name} atualizado.`);
      await load();
    }
    setSaving("");
  };

  return (
    <div className="mx-auto max-w-[1800px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/commerce" className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500"><ArrowLeft size={14}/> Commerce</Link>
          <p className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700"><LockKeyhole size={13}/> Gestão</p>
          <h1 className="mt-1 text-3xl font-bold">Matriz de preços</h1>
          <p className="mt-2 text-sm text-stone-500">Um produto por linha. Todos os perfis comerciais lado a lado.</p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 text-xs text-stone-600">
          {canEdit ? `Edição liberada para ${user?.name ?? "Gestão"}` : "Somente leitura · edição restrita à Gestão"}
        </div>
      </header>

      {message && <div className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">{message}</div>}

      <section className="mt-6 overflow-x-auto rounded-2xl border bg-white shadow-sm">
        <div className="min-w-[1650px]">
          <div className="sticky top-0 z-10 grid grid-cols-[270px_repeat(9,150px)] gap-px border-b bg-stone-100 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <div className="bg-white px-4 py-4">Produto / apresentação</div>
            {PROFILES.map(([code, label]) => <div key={code} className="bg-white px-3 py-4 text-center">{label}</div>)}
          </div>

          <div className="divide-y">
            {variants.map((variant) => (
              <div key={variant.productVariantId} className="grid grid-cols-[270px_repeat(9,150px)] gap-px bg-stone-100">
                <div className="bg-white px-4 py-3">
                  <p className="text-sm font-bold text-stone-900">{variant.product} · {formatWeight(variant.presentationGrams)}</p>
                  <p className="mt-1 text-[10px] text-stone-400">{variant.line} · {variant.sku}</p>
                </div>
                {PROFILES.map(([profileCode]) => {
                  const key = `${variant.productVariantId}:${profileCode}` as CellKey;
                  const channel = channelByCode[profileCode];
                  const existing = priceByCell[key];
                  const currency = existing?.currency || channel?.currency || (profileCode === "EXPORTACAO" ? "USD" : "BRL");
                  return (
                    <div key={profileCode} className="bg-white p-2">
                      {canEdit ? (
                        <div className="flex items-center gap-1 rounded-xl border bg-stone-50 px-2 py-2">
                          <span className="text-[10px] font-semibold text-stone-400">{currency === "USD" ? "$" : "R$"}</span>
                          <input
                            value={drafts[key] ?? ""}
                            onChange={(event) => setDrafts((current) => ({ ...current, [key]: event.target.value }))}
                            placeholder="—"
                            inputMode="decimal"
                            className="min-w-0 flex-1 bg-transparent text-right text-xs font-bold outline-none"
                          />
                          <button
                            title="Salvar preço"
                            disabled={saving === key || !channel}
                            onClick={() => void saveCell(variant, profileCode)}
                            className="grid size-7 place-items-center rounded-lg bg-stone-900 text-white disabled:opacity-30"
                          >
                            <Save size={12}/>
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-xl bg-stone-50 px-3 py-3 text-center text-xs font-bold text-stone-800">
                          {drafts[key] ? `${currency === "USD" ? "$" : "R$"} ${Number(drafts[key]).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
            {!variants.length && <div className="p-12 text-center text-sm text-stone-500">Nenhum produto ativo encontrado.</div>}
          </div>
        </div>
      </section>

      <p className="mt-4 text-xs leading-5 text-stone-500">Os preços desta matriz são a fonte usada pelo Novo Pedido conforme o perfil do cliente. Células vazias bloqueiam a cotação até a Gestão definir um preço vigente.</p>
    </div>
  );
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}
