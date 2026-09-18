export const BLING_API_BASE_URL = "https://api.bling.com.br/Api/v3";

export const BLING_ENV = {
  clientId: "BLING_CLIENT_ID",
  clientSecret: "BLING_CLIENT_SECRET",
  redirectUri: "BLING_REDIRECT_URI",
  tokenEncryptionKey: "BLING_TOKEN_ENCRYPTION_KEY",
} as const;

export const BLING_RESOURCES = [
  "order",
  "product",
  "stock",
  "virtual_stock",
  "invoice",
] as const;

export type BlingResource = (typeof BLING_RESOURCES)[number];
export type BlingWebhookAction = "created" | "updated" | "deleted";

export type BlingWebhookEnvelope = {
  eventId: string;
  date: string;
  version: string;
  event: `${BlingResource}.${BlingWebhookAction}`;
  companyId: string;
  data: unknown;
};

export type BbosFiscalDirection = "INBOUND" | "OUTBOUND";

export type BbosBlingMapping = {
  provider: "BLING";
  bbosAggregateType:
    | "PRODUCT_VARIANT"
    | "CUSTOMER"
    | "SUPPLIER"
    | "GREEN_COFFEE_RECEIPT"
    | "SALES_ORDER"
    | "STOREFRONT_ORDER"
    | "FISCAL_DOCUMENT";
  bbosAggregateId: string;
  externalId: string;
  lastSyncedAt?: string;
};

export interface ErpFiscalConnector {
  provider: "BLING";
  readiness(): {
    configured: boolean;
    missingEnvironment: string[];
    apiBaseUrl: string;
    resources: readonly BlingResource[];
  };
  createOrUpdateProduct(payload: unknown, idempotencyKey: string): Promise<{ externalId: string }>;
  createOrUpdateContact(payload: unknown, idempotencyKey: string): Promise<{ externalId: string }>;
  createSalesOrder(payload: unknown, idempotencyKey: string): Promise<{ externalId: string }>;
  createInvoice(payload: unknown, idempotencyKey: string): Promise<{ externalId: string }>;
  fetchInvoice(externalId: string): Promise<unknown>;
  processWebhook(event: BlingWebhookEnvelope): Promise<void>;
}

/**
 * Integration boundary rules:
 * - BBOS remains source of truth for operational lots, costing, production and order workflow.
 * - Bling is the fiscal/ERP connector for documents and synchronized commercial records.
 * - OAuth access/refresh tokens must be stored only in a server-side encrypted secret store.
 * - Webhook authenticity is validated with X-Bling-Signature-256 using BLING_CLIENT_SECRET.
 * - Every outbound mutation must use IntegrationOutbox + idempotencyKey.
 * - Every webhook must be persisted in IntegrationWebhookEvent before processing.
 */
export function blingReadiness(env: NodeJS.ProcessEnv = process.env) {
  const required = [
    BLING_ENV.clientId,
    BLING_ENV.clientSecret,
    BLING_ENV.redirectUri,
    BLING_ENV.tokenEncryptionKey,
  ];
  const missingEnvironment = required.filter((key) => !env[key]?.trim());
  return {
    configured: missingEnvironment.length === 0,
    missingEnvironment,
    apiBaseUrl: BLING_API_BASE_URL,
    resources: BLING_RESOURCES,
  };
}
