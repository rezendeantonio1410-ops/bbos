"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BadgeDollarSign,
  RotateCcw,
  Save,
  UsersRound,
} from "lucide-react";
import { getApiBaseUrl } from "@/lib/api-url";

const API = getApiBaseUrl();

type Customer = {
  id: string;
  name: string;
  tradeName?: string | null;
  segment?: string | null;
  active: boolean;
};
type User = { role: string; name: string };
type CustomerPriceRow = {
  productVariantId: string;
  sku: string;
  netWeightGrams: number;
  productName: string;
  lineName: string;
  productPriceId?: string | null;
  salesChannelName?: string | null;
  currency?: string | null;
  channelPrice?: string | number | null;
  customerProductPriceId?: string | null;
  customerPrice?: string | number | null;
  customerPriceActive?: boolean | null;
  effectivePrice?: string | number | null;
  pricingSource: "CUSTOMER" | "CHANNEL";
};

export default function CustomerPricesPage() {
  const [customers, setCustomers] = React.useState<Customer[]>([]);
  const [customerId, setCustomerId] = React.useState("");
  const [rows, setRows] = React.useState<CustomerPriceRow[]>([]);
  const [drafts, setDrafts] = React.useState<Record<string, string>>({});
  const [user, setUser] = React.useState<User | null>(null);
  const [busy, setBusy] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [loading, setLoading] = React.useState(false);

  const loadCustomer = React.useCallback(async (selectedId: string) => {
    if (!selectedId) {
      setRows([]);
      setDrafts({});
      return;
    }
    setLoading(true);
    setMessage("");
    const response = await fetch(
      `${API}/commerce/customer-prices?customerId=${encodeURIComponent(selectedId)}`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(
        payload.message ?? "Não foi possível consultar os preços do cliente.",
      );
      setRows([]);
    } else {
      const nextRows = (payload.prices ?? []) as CustomerPriceRow[];
      setRows(nextRows);
      setDrafts(
        Object.fromEntries(
          nextRows.map((row) => [
            row.productVariantId,
            row.customerPriceActive && row.customerPrice != null
              ? String(row.customerPrice)
              : "",
          ]),
        ),
      );
    }
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void Promise.all([
      fetch(`${API}/sales-orders/options`, {
        credentials: "include",
        cache: "no-store",
      }),
      fetch(`${API}/auth/me`, { credentials: "include", cache: "no-store" }),
    ]).then(async ([optionsResponse, meResponse]) => {
      const options = optionsResponse.ok
        ? await optionsResponse.json()
        : { customers: [] };
      const me = meResponse.ok ? await meResponse.json() : null;
      setCustomers(
        (options.customers ?? []).filter((item: Customer) => item.active),
      );
      setUser(me?.user ?? null);
    });
  }, []);

  React.useEffect(() => {
    void loadCustomer(customerId);
  }, [customerId, loadCustomer]);

  const canEdit = user ? ["ADMIN", "EXECUTIVE"].includes(user.role) : false;
  const customer = customers.find((item) => item.id === customerId);

  const save = async (row: CustomerPriceRow) => {
    const raw = String(drafts[row.productVariantId] ?? "")
      .trim()
      .replace(",", ".");
    const price = Number(raw);
    if (!Number.isFinite(price) || price < 0) {
      setMessage("Informe um preço negociado válido.");
      return;
    }
    setBusy(row.productVariantId);
    setMessage("");
    const response = await fetch(`${API}/commerce/customer-prices`, {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerId,
        productVariantId: row.productVariantId,
        price,
        notes: `Preço negociado com ${customer?.tradeName || customer?.name || "cliente"}`,
      }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      setMessage(payload.message ?? "Não foi possível salvar o preço.");
    else {
      setMessage(
        `${row.productName} · ${formatWeight(row.netWeightGrams)}: preço individual salvo para ${customer?.tradeName || customer?.name}.`,
      );
      await loadCustomer(customerId);
    }
    setBusy("");
  };

  const restoreChannelPrice = async (row: CustomerPriceRow) => {
    if (!row.customerProductPriceId) return;
    setBusy(row.productVariantId);
    setMessage("");
    const response = await fetch(
      `${API}/commerce/customer-prices/${row.customerProductPriceId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: false }),
      },
    );
    const payload = await response.json().catch(() => ({}));
    if (!response.ok)
      setMessage(
        payload.message ?? "Não foi possível restaurar o preço da tabela.",
      );
    else {
      setMessage(
        `${row.productName}: voltou a usar o preço do perfil comercial.`,
      );
      await loadCustomer(customerId);
    }
    setBusy("");
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/commerce/precos"
            className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500"
          >
            <ArrowLeft size={14} /> Matriz de preços
          </Link>
          <p className="mt-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.16em] text-violet-700">
            <UsersRound size={13} /> Condição individual
          </p>
          <h1 className="mt-1 text-3xl font-bold">Preços por cliente</h1>
          <p className="mt-2 text-sm text-stone-500">
            O SKU continua único. Somente o preço negociado muda para o cliente
            selecionado.
          </p>
        </div>
        <div className="rounded-xl border bg-white px-4 py-3 text-xs text-stone-600">
          {canEdit
            ? `Edição liberada para ${user?.name ?? "Gestão"}`
            : "Somente leitura · edição restrita à Gestão"}
        </div>
      </header>

      <section className="mt-6 rounded-2xl border bg-white p-5 shadow-sm">
        <label className="block max-w-2xl text-xs font-bold text-stone-700">
          Cliente
          <select
            value={customerId}
            onChange={(event) => setCustomerId(event.target.value)}
            className="mt-2 w-full rounded-xl border bg-white px-3 py-3 text-sm font-normal"
          >
            <option value="">Selecione um cliente</option>
            {customers.map((item) => (
              <option key={item.id} value={item.id}>
                {item.tradeName || item.name}
                {item.segment ? ` · ${item.segment}` : ""}
              </option>
            ))}
          </select>
        </label>
        {customer && (
          <p className="mt-3 text-xs text-stone-500">
            Perfil comercial:{" "}
            <strong>{customer.segment || "padrão B2B"}</strong>. O preço
            individual terá prioridade; os limites de desconto e margem
            continuam herdados da tabela deste perfil.
          </p>
        )}
      </section>

      {message && (
        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800">
          {message}
        </div>
      )}

      {customerId && (
        <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm">
          <div className="grid grid-cols-[minmax(260px,1.4fr)_160px_160px_190px] gap-px border-b bg-stone-100 px-0 text-[10px] font-bold uppercase tracking-wide text-stone-500">
            <div className="bg-white px-4 py-4">Produto / SKU</div>
            <div className="bg-white px-4 py-4 text-center">
              Tabela do perfil
            </div>
            <div className="bg-white px-4 py-4 text-center">Preço efetivo</div>
            <div className="bg-white px-4 py-4 text-center">
              Preço deste cliente
            </div>
          </div>
          <div className="divide-y">
            {rows.map((row) => {
              const hasBase = row.productPriceId && row.channelPrice != null;
              const saving = busy === row.productVariantId;
              return (
                <div
                  key={row.productVariantId}
                  className="grid grid-cols-[minmax(260px,1.4fr)_160px_160px_190px] gap-px bg-stone-100"
                >
                  <div className="bg-white px-4 py-3">
                    <p className="text-sm font-bold">
                      {row.productName} · {formatWeight(row.netWeightGrams)}
                    </p>
                    <p className="mt-1 text-[10px] text-stone-400">
                      {row.lineName} · {row.sku}
                    </p>
                  </div>
                  <div className="bg-white px-4 py-3 text-center">
                    <p className="text-xs font-bold">
                      {row.channelPrice == null
                        ? "—"
                        : currency(row.channelPrice, row.currency)}
                    </p>
                    <p className="mt-1 text-[10px] text-stone-400">
                      {row.salesChannelName || "Sem tabela"}
                    </p>
                  </div>
                  <div className="bg-white px-4 py-3 text-center">
                    <p className="text-xs font-bold text-emerald-800">
                      {row.effectivePrice == null
                        ? "—"
                        : currency(row.effectivePrice, row.currency)}
                    </p>
                    <p className="mt-1 text-[10px] font-semibold uppercase text-stone-400">
                      {row.pricingSource === "CUSTOMER" ? "Cliente" : "Perfil"}
                    </p>
                  </div>
                  <div className="bg-white p-2">
                    {canEdit ? (
                      <div className="flex items-center gap-1 rounded-xl border bg-stone-50 px-2 py-2">
                        <span className="text-[10px] font-semibold text-stone-400">
                          {row.currency === "USD" ? "$" : "R$"}
                        </span>
                        <input
                          value={drafts[row.productVariantId] ?? ""}
                          onChange={(event) =>
                            setDrafts((current) => ({
                              ...current,
                              [row.productVariantId]: event.target.value,
                            }))
                          }
                          disabled={!hasBase || saving}
                          placeholder={hasBase ? "valor" : "sem tabela"}
                          inputMode="decimal"
                          className="min-w-0 flex-1 bg-transparent text-right text-xs font-bold outline-none disabled:opacity-40"
                        />
                        <button
                          title="Salvar preço deste cliente"
                          disabled={!hasBase || saving}
                          onClick={() => void save(row)}
                          className="grid size-7 place-items-center rounded-lg bg-stone-900 text-white disabled:opacity-30"
                        >
                          <Save size={12} />
                        </button>
                        {row.customerProductPriceId &&
                          row.customerPriceActive && (
                            <button
                              title="Voltar ao preço do perfil"
                              disabled={saving}
                              onClick={() => void restoreChannelPrice(row)}
                              className="grid size-7 place-items-center rounded-lg border bg-white text-stone-600"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                      </div>
                    ) : (
                      <div className="rounded-xl bg-stone-50 px-3 py-3 text-center text-xs font-bold">
                        {row.customerPriceActive && row.customerPrice != null
                          ? currency(row.customerPrice, row.currency)
                          : "—"}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            {!rows.length && (
              <div className="p-12 text-center text-sm text-stone-500">
                {loading
                  ? "Carregando preços…"
                  : "Nenhum SKU ativo encontrado."}
              </div>
            )}
          </div>
        </section>
      )}

      {!customerId && (
        <section className="mt-8 rounded-3xl border border-dashed bg-stone-50 p-12 text-center">
          <BadgeDollarSign className="mx-auto text-stone-300" />
          <h2 className="mt-3 text-lg font-bold">Selecione um cliente</h2>
          <p className="mt-1 text-sm text-stone-500">
            Depois, informe somente os produtos que possuem negociação
            específica.
          </p>
        </section>
      )}
    </div>
  );
}

function formatWeight(grams: number) {
  return grams >= 1000 ? `${grams / 1000} kg` : `${grams} g`;
}
function currency(value: string | number, code?: string | null) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: code || "BRL",
  }).format(Number(value));
}
