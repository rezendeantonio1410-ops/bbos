import { isValidPartnerRequestedReadyDate } from "./partner-ready-date";

// Deliberately excludes prices, taxes, payments and accounting fields.
// Drafts are never orders; final submission must revalidate the live catalog.
export type SignaServerDraftPayload = {
  customerId: string | null;
  partnerEndCustomerId: string | null;
  billingRecipientId: string | null;
  items: Array<{ productVariantId: string; quantity: number }>;
  deliveryMode: "PICKUP" | "CUSTOMER_CARRIER";
  carrierName: string;
  expectedDeliveryDate: string;
  customerReference: string;
  notes: string;
};

const permitted = new Set([
  "customerId", "partnerEndCustomerId", "billingRecipientId", "items",
  "deliveryMode", "carrierName", "expectedDeliveryDate", "customerReference", "notes",
]);

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Informe um rascunho válido.");
  }
  return value as Record<string, unknown>;
}

function boundedText(data: Record<string, unknown>, key: string, max: number): string {
  const value = data[key];
  if (value === undefined || value === null || value === "") return "";
  if (typeof value !== "string" || value.length > max) {
    throw new Error("Campo inválido no rascunho: " + key + ".");
  }
  return value.trim();
}

function optionalId(data: Record<string, unknown>, key: string): string | null {
  const id = boundedText(data, key, 200);
  if (id && !/^[a-zA-Z0-9_-]{1,200}$/.test(id)) {
    throw new Error("Identificador inválido no rascunho: " + key + ".");
  }
  return id || null;
}

export function parseSignaServerDraftPayload(raw: unknown): SignaServerDraftPayload {
  const data = record(raw);
  if (Object.keys(data).some(key => !permitted.has(key))) {
    throw new Error("Rascunho contém campos não autorizados.");
  }
  const rawItems = data.items ?? [];
  if (!Array.isArray(rawItems) || rawItems.length > 50) {
    throw new Error("O rascunho aceita até 50 produtos.");
  }
  const seen = new Set<string>();
  const items = rawItems.map(rawItem => {
    const item = record(rawItem);
    if (Object.keys(item).some(key => key !== "productVariantId" && key !== "quantity")) {
      throw new Error("Dados de preço não podem ser guardados no rascunho.");
    }
    const productVariantId = optionalId(item, "productVariantId");
    const quantity = item.quantity;
    if (!productVariantId || !Number.isSafeInteger(quantity) ||
        (quantity as number) < 1 || (quantity as number) > 99999 ||
        seen.has(productVariantId)) {
      throw new Error("Produtos ou quantidades inválidos no rascunho.");
    }
    seen.add(productVariantId);
    return { productVariantId, quantity: quantity as number };
  });
  const requestedDate = boundedText(data, "expectedDeliveryDate", 10);
  if (requestedDate && !isValidPartnerRequestedReadyDate(requestedDate)) {
    throw new Error("Data solicitada inválida no rascunho.");
  }
  const deliveryMode = data.deliveryMode ?? "PICKUP";
  if (deliveryMode !== "PICKUP" && deliveryMode !== "CUSTOMER_CARRIER") {
    throw new Error("Modalidade de entrega inválida no rascunho.");
  }
  return {
    customerId: optionalId(data, "customerId"),
    partnerEndCustomerId: optionalId(data, "partnerEndCustomerId"),
    billingRecipientId: optionalId(data, "billingRecipientId"),
    items,
    deliveryMode,
    carrierName: boundedText(data, "carrierName", 120),
    expectedDeliveryDate: requestedDate,
    customerReference: boundedText(data, "customerReference", 120),
    notes: boundedText(data, "notes", 2000),
  };
}

export function parseSignaDraftVersion(raw: unknown): number {
  if (!Number.isSafeInteger(raw) || (raw as number) < 1) {
    throw new Error("Versão do rascunho inválida. Atualize e tente novamente.");
  }
  return raw as number;
}
