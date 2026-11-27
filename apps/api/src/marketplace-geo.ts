// Destino de entrega dos pedidos de marketplace, para o mapa de vendas.
// Guarda só cidade e UF: nada de nome, rua ou CEP do comprador.
import { brazilStateCode } from "./sales-map";
import type { SummaryOrder } from "./sales-summary";

export type OrderDestination = { city: string; state: string };

/**
 * Lê cidade e UF do envio do Mercado Livre (/shipments/{id}), no formato
 * clássico (receiver_address) ou no novo (destination.shipping_address).
 */
export function shipmentDestination(payload: any): OrderDestination | null {
  const address = payload?.receiver_address ?? payload?.destination?.shipping_address ?? null;
  if (!address) return null;
  const city = String(address.city?.name ?? address.city ?? "").trim();
  const stateId = String(address.state?.id ?? "").trim().toUpperCase();
  const state = /^BR-[A-Z]{2}$/.test(stateId)
    ? brazilStateCode(stateId.slice(3))
    : brazilStateCode(String(address.state?.name ?? address.state ?? ""));
  if (!city || !state) return null;
  return { city: city.slice(0, 80), state };
}

/** Número do envio dentro do pedido do Mercado Livre. */
export function shipmentIdOf(orderPayload: any): string | null {
  const id = orderPayload?.shipping?.id;
  return id === null || id === undefined || id === "" ? null : String(id);
}

export type MarketplaceGeoRow = {
  id: string;
  channelName: string;
  orderedAt: Date | string;
  grossAmount: number | string | null;
  city: string | null;
  state: string | null;
  payload?: any;
};

/**
 * Converte pedidos de marketplace (ainda não importados) no formato do resumo
 * de vendas. Todos os compradores de um canal viram um só "cliente" (ex.:
 * "Mercado Livre · consumidores"), para não expor nomes e não inflar a lista
 * de clientes. O peso sai do SKU do anúncio quando ele bate com um produto.
 */
export function marketplaceSummaryOrders(rows: MarketplaceGeoRow[], gramsBySku: Map<string, number> = new Map()): SummaryOrder[] {
  return rows.map((row) => {
    const items = Array.isArray(row.payload?.order_items) ? row.payload.order_items : [];
    return {
      id: `mp-${row.id}`,
      totalAmount: Number(row.grossAmount ?? 0),
      orderedAt: row.orderedAt,
      customer: {
        id: `marketplace-${row.channelName}`,
        name: `${row.channelName} · consumidores`,
        state: row.state,
        city: row.city,
      },
      items: items.map((entry: any) => ({
        quantity: Number(entry?.quantity ?? 0) || 0,
        productVariant: { netWeightGrams: gramsBySku.get(String(entry?.item?.seller_sku ?? "").trim().toUpperCase()) ?? 0 },
      })),
    };
  });
}
