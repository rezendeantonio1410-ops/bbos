/**
 * Export area input rules: foreign buyers, samples sent abroad (with a tracking
 * timeline) and export contracts. Pure functions so they are tested without a
 * database. Domestic customers live in "Customer"; buyers abroad stay here.
 */

export const EXPORT_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "BRL"] as const;
export const EXPORT_BUYER_STATUS = ["PROSPECT", "ACTIVE", "INACTIVE"] as const;
export const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DDP"] as const;
export const CARRIERS = ["DHL", "FEDEX", "UPS", "CORREIOS", "TNT", "OTHER"] as const;
export const SAMPLE_STATUS = ["PREPARED", "SENT", "IN_TRANSIT", "CUSTOMS", "DELIVERED", "EVALUATED", "LOST", "RETURNED"] as const;
export const SAMPLE_RESULTS = ["APPROVED", "REJECTED", "NEEDS_ANOTHER"] as const;
export const CONTRACT_STATUS = ["NEGOTIATING", "SIGNED", "SHIPPED", "COMPLETED", "CANCELLED"] as const;
export const PRICE_UNITS = ["PER_LB", "PER_KG", "PER_BAG_60KG", "TOTAL"] as const;

export type SampleStatus = (typeof SAMPLE_STATUS)[number];

export const SAMPLE_STATUS_LABEL: Record<SampleStatus, string> = {
  PREPARED: "Preparada",
  SENT: "Enviada",
  IN_TRANSIT: "Em trânsito",
  CUSTOMS: "Na alfândega",
  DELIVERED: "Entregue",
  EVALUATED: "Avaliada",
  LOST: "Extraviada",
  RETURNED: "Devolvida",
};

export class ExportInputError extends Error {}

const fail = (message: string): never => {
  throw new ExportInputError(message);
};

function text(value: unknown, label: string, { required = false, max = 200 } = {}) {
  if (value === undefined || value === null) {
    if (required) fail(`Informe ${label}.`);
    return null;
  }
  if (typeof value !== "string") return fail(`${label}: valor inválido.`);
  const trimmed = value.trim();
  if (!trimmed) return required ? fail(`Informe ${label}.`) : null;
  if (trimmed.length > max) fail(`${label}: texto muito longo (máximo ${max}).`);
  return trimmed;
}

function oneOf<T extends string>(value: unknown, list: readonly T[], label: string, fallback?: T): T {
  if ((value === undefined || value === null || value === "") && fallback !== undefined) return fallback;
  const upper = String(value ?? "").trim().toUpperCase();
  if (!(list as readonly string[]).includes(upper)) fail(`${label}: escolha uma opção válida.`);
  return upper as T;
}

function decimal(value: unknown, label: string, { min = 0, max = Number.MAX_SAFE_INTEGER, required = false } = {}) {
  if (value === undefined || value === null || value === "") {
    if (required) fail(`Informe ${label}.`);
    return null;
  }
  const number = typeof value === "number" ? value : Number(String(value).replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(number) || number < min || number > max) fail(`${label}: número inválido.`);
  return number;
}

function isoDate(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  const raw = String(value);
  if (!/^\d{4}-\d{2}-\d{2}/.test(raw) || Number.isNaN(Date.parse(raw))) fail(`${label}: data inválida.`);
  return raw.slice(0, 10);
}

/** ISO 3166-1 alpha-2, e.g. "JP", "DE", "US". */
function country(value: unknown) {
  const code = String(value ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) fail("País: use a sigla de 2 letras (ex.: US, DE, JP).");
  return code;
}

function email(value: unknown) {
  const v = text(value, "o e-mail", { max: 254 });
  if (v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) fail("Confira o e-mail do comprador.");
  return v ? v.toLowerCase() : null;
}

export function parseExportBuyer(input: Record<string, unknown>) {
  return {
    name: text(input.name, "o nome da empresa", { required: true, max: 180 }) as string,
    country: country(input.country),
    city: text(input.city, "a cidade", { max: 120 }),
    legalRepresentative: text(input.legalRepresentative, "o representante legal", { max: 160 }),
    messenger: text(input.messenger, "o WeChat / WhatsApp", { max: 80 }),
    contactName: text(input.contactName, "o comprador", { max: 120 }),
    email: email(input.email),
    phone: text(input.phone, "o telefone", { max: 40 }),
    language: text(input.language, "o idioma", { max: 40 }),
    currency: oneOf(input.currency, EXPORT_CURRENCIES, "Moeda", "USD"),
    incoterm: input.incoterm ? oneOf(input.incoterm, INCOTERMS, "Incoterm") : null,
    taxId: text(input.taxId, "o documento fiscal", { max: 60 }),
    address: text(input.address, "o endereço", { max: 400 }),
    status: oneOf(input.status, EXPORT_BUYER_STATUS, "Situação", "PROSPECT"),
    notes: text(input.notes, "as observações", { max: 2000 }),
  };
}

/** Samples go from 200 g to 20+ kg: the form sends kg, older callers grams. */
function weightGrams(input: Record<string, unknown>) {
  if (input.weightKg !== undefined && input.weightKg !== null && input.weightKg !== "") {
    const kg = decimal(input.weightKg, "o peso (kg)", { min: 0.001, max: 100 }) as number;
    return Math.round(kg * 1000);
  }
  return Math.round(decimal(input.weightGrams, "o peso", { min: 1, max: 100000, required: true }) as number);
}

function upperCode(value: unknown, label: string) {
  const v = text(value, label, { max: 40 });
  return v ? v.toUpperCase().replace(/\s+/g, "") : null;
}

export function parseExportSample(input: Record<string, unknown>) {
  const carrier = input.carrier ? oneOf(input.carrier, CARRIERS, "Transportadora") : null;
  const trackingCode = text(input.trackingCode, "o código de rastreio", { max: 60 });
  return {
    buyerId: text(input.buyerId, "o cliente", { required: true, max: 64 }) as string,
    coffeeType: oneOf(input.coffeeType, ["GREEN", "ROASTED"] as const, "Tipo de café", "GREEN"),
    lotReference: text(input.lotReference, "o lote ou café", { required: true, max: 120 }) as string,
    weightGrams: weightGrams(input),
    reference: upperCode(input.reference, "a referência do envio"),
    proformaNumber: upperCode(input.proformaNumber, "o número da pró-forma"),
    declaredValue: decimal(input.declaredValue, "o valor declarado"),
    declaredCurrency: oneOf(input.declaredCurrency, EXPORT_CURRENCIES, "Moeda do valor declarado", "USD"),
    shippedByName: text(input.shippedByName, "quem enviou", { max: 80 }),
    scaScore: decimal(input.scaScore, "a nota SCA", { max: 100 }),
    carrier,
    trackingCode: trackingCode ? trackingCode.replace(/\s+/g, "").toUpperCase() : null,
    shippingCost: decimal(input.shippingCost, "o custo do envio"),
    responseDays: Math.round(decimal(input.responseDays, "o prazo de resposta", { min: 1, max: 90 }) ?? 7),
    notes: text(input.notes, "as observações", { max: 2000 }),
  };
}

/** A new step in the sample's journey (manual today, carrier tracking later). */
export function parseSampleStep(input: Record<string, unknown>) {
  const status = oneOf(input.status, SAMPLE_STATUS, "Etapa");
  if (status === "EVALUATED") fail("Para concluir a avaliação use o registro de resultado.");
  const occurredAt = input.occurredAt ? new Date(String(input.occurredAt)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) fail("Data da etapa inválida.");
  return { status, note: text(input.note, "a observação", { max: 500 }), occurredAt };
}

export function parseSampleEvaluation(input: Record<string, unknown>) {
  return {
    result: oneOf(input.result, SAMPLE_RESULTS, "Resultado"),
    buyerScore: decimal(input.buyerScore, "a nota do comprador", { max: 100 }),
    feedback: text(input.feedback, "o comentário do comprador", { max: 2000 }),
  };
}

export function parseExportContract(input: Record<string, unknown>) {
  const shipmentFrom = isoDate(input.shipmentFrom, "Início do embarque");
  const shipmentTo = isoDate(input.shipmentTo, "Fim do embarque");
  if (shipmentFrom && shipmentTo && shipmentTo < shipmentFrom) fail("O fim do embarque é antes do início.");
  return {
    buyerId: text(input.buyerId, "o cliente", { required: true, max: 64 }) as string,
    product: text(input.product, "o café do contrato", { required: true, max: 160 }) as string,
    quantityKg: decimal(input.quantityKg, "a quantidade (kg)", { min: 0.01, required: true }) as number,
    unitPrice: decimal(input.unitPrice, "o preço"),
    priceUnit: oneOf(input.priceUnit, PRICE_UNITS, "Unidade do preço", "PER_LB"),
    currency: oneOf(input.currency, EXPORT_CURRENCIES, "Moeda", "USD"),
    incoterm: input.incoterm ? oneOf(input.incoterm, INCOTERMS, "Incoterm") : null,
    shipmentFrom,
    shipmentTo,
    status: oneOf(input.status, CONTRACT_STATUS, "Situação", "NEGOTIATING"),
    notes: text(input.notes, "as observações", { max: 2000 }),
    sampleId: text(input.sampleId, "a amostra", { max: 64 }),
  };
}

/** Public tracking page of each carrier, so the code is always one tap away. */
export function trackingUrl(carrier: string | null | undefined, code: string | null | undefined) {
  if (!code) return null;
  const c = encodeURIComponent(code);
  switch (carrier) {
    case "DHL": return `https://www.dhl.com/br-pt/home/rastreamento.html?tracking-id=${c}`;
    case "FEDEX": return `https://www.fedex.com/fedextrack/?trknbr=${c}`;
    case "UPS": return `https://www.ups.com/track?tracknum=${c}&loc=pt_BR`;
    case "CORREIOS": return `https://rastreamento.correios.com.br/app/index.php?objeto=${c}`;
    case "TNT": return `https://www.tnt.com/express/pt_br/site/rastreamento.html?searchType=con&cons=${c}`;
    default: return `https://t.17track.net/pt#nums=${c}`;
  }
}

/** Timestamps a step sets on the sample itself. */
export function stepEffects(status: SampleStatus, at: Date, responseDays: number) {
  const effects: Record<string, Date | null> = {};
  if (status === "SENT") effects.sentAt = at;
  if (status === "DELIVERED") {
    effects.deliveredAt = at;
    effects.responseDueAt = new Date(at.getTime() + responseDays * 86_400_000);
  }
  return effects;
}

export type SampleForAlert = {
  status: SampleStatus;
  responseDueAt?: Date | string | null;
  lastEventAt?: Date | string | null;
};

/** What needs someone: customs for 3+ days, or the buyer's answer is overdue. */
export function sampleAlert(sample: SampleForAlert, now = new Date()) {
  const days = (value?: Date | string | null) =>
    value ? Math.floor((now.getTime() - new Date(value).getTime()) / 86_400_000) : 0;
  if (sample.status === "CUSTOMS" && days(sample.lastEventAt) >= 3)
    return { kind: "CUSTOMS_STUCK" as const, days: days(sample.lastEventAt) };
  if (sample.status === "DELIVERED" && sample.responseDueAt && new Date(sample.responseDueAt) <= now)
    return { kind: "FOLLOW_UP" as const, days: days(sample.responseDueAt) };
  if (["SENT", "IN_TRANSIT"].includes(sample.status) && days(sample.lastEventAt) >= 10)
    return { kind: "NO_MOVEMENT" as const, days: days(sample.lastEventAt) };
  return null;
}
