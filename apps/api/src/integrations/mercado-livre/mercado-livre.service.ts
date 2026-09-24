import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

const API_BASE = "https://api.mercadolibre.com";
const AUTHORIZE_URL = "https://auth.mercadolivre.com.br/authorization";
const TOKEN_URL = `${API_BASE}/oauth/token`;
const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const base64UrlSha256 = (value: string) =>
  createHash("sha256").update(value).digest("base64url");

type MercadoLivreToken = {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  user_id?: number | string;
  scope?: string;
};

@Injectable()
export class MercadoLivreService {
  private readonly database = new PrismaClient();
  private readonly refreshes = new Map<string, Promise<string>>();

  readiness() {
    return {
      configured: Boolean(
        process.env.MERCADO_LIVRE_CLIENT_ID?.trim() &&
        process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim() &&
        process.env.MERCADO_LIVRE_REDIRECT_URI?.trim() &&
        (process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY?.trim() ||
          process.env.BLING_TOKEN_ENCRYPTION_KEY?.trim()),
      ),
      callbackUrl: process.env.MERCADO_LIVRE_REDIRECT_URI?.trim() ?? null,
    };
  }

  private config() {
    const clientId = process.env.MERCADO_LIVRE_CLIENT_ID?.trim();
    const clientSecret = process.env.MERCADO_LIVRE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.MERCADO_LIVRE_REDIRECT_URI?.trim();
    const encryptionSecret = (
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY ||
      process.env.BLING_TOKEN_ENCRYPTION_KEY
    )?.trim();
    if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) {
      throw new Error(
        "Mercado Livre não configurado. Verifique MERCADO_LIVRE_CLIENT_ID, MERCADO_LIVRE_CLIENT_SECRET, MERCADO_LIVRE_REDIRECT_URI e INTEGRATION_TOKEN_ENCRYPTION_KEY.",
      );
    }
    return { clientId, clientSecret, redirectUri, encryptionSecret };
  }

  private encryptionKey() {
    return createHash("sha256").update(this.config().encryptionSecret).digest();
  }

  private encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted)
      throw new Error("Credencial Mercado Livre inválida.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  async authorizationUrl(companyId: string) {
    const { clientId, redirectUri } = this.config();
    const state = randomBytes(32).toString("base64url");
    const codeVerifier = randomBytes(48).toString("base64url");
    await this.database.$executeRawUnsafe(
      `INSERT INTO "ExternalIntegration"
        (id,"companyId",provider,status,"oauthStateHash","oauthStateExpiresAt",
         "oauthCodeVerifierCiphertext","createdAt","updatedAt")
       VALUES ($1,$2,'MERCADO_LIVRE','CONNECTING',$3,NOW() + INTERVAL '10 minutes',$4,NOW(),NOW())
       ON CONFLICT ("companyId",provider) DO UPDATE SET
         status='CONNECTING',"oauthStateHash"=EXCLUDED."oauthStateHash",
         "oauthStateExpiresAt"=EXCLUDED."oauthStateExpiresAt",
         "oauthCodeVerifierCiphertext"=EXCLUDED."oauthCodeVerifierCiphertext",
         "lastError"=NULL,"updatedAt"=NOW()`,
      `mercado-livre-${sha256(companyId).slice(0, 20)}`,
      companyId,
      sha256(state),
      this.encrypt(codeVerifier),
    );
    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("code_challenge", base64UrlSha256(codeVerifier));
    url.searchParams.set("code_challenge_method", "S256");
    return url.toString();
  }

  async completeAuthorization(code: string, state: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId","oauthCodeVerifierCiphertext"
         FROM "ExternalIntegration"
        WHERE provider='MERCADO_LIVRE' AND "oauthStateHash"=$1
          AND "oauthStateExpiresAt" > NOW() LIMIT 1`,
      sha256(state),
    );
    const integration = rows[0];
    if (!integration)
      throw new Error("Autorização do Mercado Livre inválida ou expirada.");
    const codeVerifier = integration.oauthCodeVerifierCiphertext
      ? this.decrypt(integration.oauthCodeVerifierCiphertext)
      : undefined;
    const token = await this.exchangeToken({
      grant_type: "authorization_code",
      code,
      ...(codeVerifier ? { code_verifier: codeVerifier } : {}),
    });
    const providerAccountId = String(token.user_id ?? "");
    await this.persistTokens(integration.companyId, token);
    const channel = await this.ensureChannel(
      integration.companyId,
      providerAccountId,
    );
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration" SET status='CONNECTED',
       "providerAccountId"=$2,"connectedAt"=COALESCE("connectedAt",NOW()),
       scopes=$3::jsonb,"oauthStateHash"=NULL,"oauthStateExpiresAt"=NULL,
       "oauthCodeVerifierCiphertext"=NULL,"lastError"=NULL,"updatedAt"=NOW()
       WHERE id=$1`,
      integration.id,
      providerAccountId || null,
      JSON.stringify(
        String(token.scope ?? "")
          .split(" ")
          .filter(Boolean),
      ),
    );
    return {
      companyId: integration.companyId,
      channelId: channel.id,
      status: "CONNECTED",
    };
  }

  private async exchangeToken(values: Record<string, string>) {
    const { clientId, clientSecret, redirectUri } = this.config();
    const isAuthorizationCode = values.grant_type === "authorization_code";
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        ...(isAuthorizationCode ? { redirect_uri: redirectUri } : {}),
        ...values,
      }).toString(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token || !payload.refresh_token) {
      throw new Error(`Falha OAuth Mercado Livre (${response.status}).`);
    }
    return payload as MercadoLivreToken;
  }

  private async persistTokens(companyId: string, token: MercadoLivreToken) {
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration" SET "accessTokenCiphertext"=$2,
       "refreshTokenCiphertext"=$3,"tokenExpiresAt"=NOW()+($4||' seconds')::interval,
       "lastSyncAt"=NOW(),"updatedAt"=NOW()
       WHERE "companyId"=$1 AND provider='MERCADO_LIVRE'`,
      companyId,
      this.encrypt(token.access_token),
      this.encrypt(token.refresh_token),
      String(Math.max(60, Number(token.expires_in ?? 21_600))),
    );
  }

  async accessToken(companyId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "accessTokenCiphertext","refreshTokenCiphertext","tokenExpiresAt"
         FROM "ExternalIntegration"
        WHERE "companyId"=$1 AND provider='MERCADO_LIVRE' AND status='CONNECTED' LIMIT 1`,
      companyId,
    );
    const integration = rows[0];
    if (
      !integration?.accessTokenCiphertext ||
      !integration?.refreshTokenCiphertext
    ) {
      throw new Error("Mercado Livre ainda não foi autorizado no BBOS.");
    }
    if (
      new Date(integration.tokenExpiresAt || 0).getTime() >
      Date.now() + 60_000
    ) {
      return this.decrypt(integration.accessTokenCiphertext);
    }
    const pending = this.refreshes.get(companyId);
    if (pending) return pending;
    const refresh = (async () => {
      const token = await this.exchangeToken({
        grant_type: "refresh_token",
        refresh_token: this.decrypt(integration.refreshTokenCiphertext),
      });
      await this.persistTokens(companyId, token);
      return token.access_token;
    })();
    this.refreshes.set(companyId, refresh);
    try {
      return await refresh;
    } finally {
      this.refreshes.delete(companyId);
    }
  }

  async request(companyId: string, path: string, init: RequestInit = {}) {
    const token = await this.accessToken(companyId);
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          ...(init.headers ?? {}),
        },
      });
      const payload = await response.json().catch(() => ({}));
      if (response.ok) return payload;
      if (response.status === 429 && attempt < 3) {
        const retryAfter = Number(response.headers.get("retry-after") ?? 0);
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt,
          ),
        );
        continue;
      }
      throw new Error(
        `Mercado Livre API ${response.status}: ${JSON.stringify(payload)}`,
      );
    }
    throw new Error("Mercado Livre indisponível após novas tentativas.");
  }

  async ensureChannel(companyId: string, externalAccountId?: string | null) {
    const channel = await this.database.salesChannel.upsert({
      where: { companyId_code: { companyId, code: "MERCADO_LIVRE" } },
      create: {
        companyId,
        code: "MERCADO_LIVRE",
        name: "Mercado Livre",
        type: "ECOMMERCE",
        country: "BR",
        currency: "BRL",
        platformCode: "MERCADO_LIVRE",
        connectionStatus: externalAccountId ? "CONNECTED" : "NOT_CONNECTED",
        externalAccountId: externalAccountId || null,
        fulfillmentMode: "SELLER",
      },
      update: {
        platformCode: "MERCADO_LIVRE",
        ...(externalAccountId
          ? { connectionStatus: "CONNECTED", externalAccountId }
          : {}),
      },
    });
    return channel;
  }

  async status(companyId: string) {
    const channel = await this.ensureChannel(companyId);
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT status,"providerAccountId","connectedAt","lastSyncAt","lastError","tokenExpiresAt"
         FROM "ExternalIntegration"
        WHERE "companyId"=$1 AND provider='MERCADO_LIVRE' LIMIT 1`,
      companyId,
    );
    return {
      provider: "MERCADO_LIVRE",
      ...this.readiness(),
      channel,
      connection: rows[0] ?? { status: "DISCONNECTED" },
      credentialsExposed: false,
    };
  }

  async ingestOrder(companyId: string, payload: any) {
    const externalOrderId = String(payload?.id ?? "").trim();
    if (!externalOrderId)
      throw new Error("Pedido Mercado Livre sem identificador.");
    const channel = await this.ensureChannel(companyId);
    const orderedAt = payload.date_created
      ? new Date(payload.date_created)
      : null;
    const grossAmount = Number(payload.total_amount ?? 0);
    const feeAmount = Array.isArray(payload.payments)
      ? payload.payments.reduce(
          (sum: number, payment: any) =>
            sum + Number(payment.marketplace_fee ?? 0),
          0,
        )
      : 0;
    const inserted = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "MarketplaceOrderInbox"
        (id,"companyId","salesChannelId",provider,"externalOrderId","externalStatus",
         "orderedAt","grossAmount","feeAmount",payload,"importStatus","firstSeenAt","lastSeenAt")
       VALUES ($1,$2,$3,'MERCADO_LIVRE',$4,$5,$6,$7,$8,$9::jsonb,'RECEIVED',NOW(),NOW())
       ON CONFLICT (provider,"externalOrderId") DO UPDATE SET
         "externalStatus"=EXCLUDED."externalStatus","orderedAt"=EXCLUDED."orderedAt",
         "grossAmount"=EXCLUDED."grossAmount","feeAmount"=EXCLUDED."feeAmount",
         payload=EXCLUDED.payload,"lastSeenAt"=NOW(),
         "importStatus"=CASE WHEN "MarketplaceOrderInbox"."importStatus"='IMPORTED'
           THEN 'IMPORTED' ELSE 'RECEIVED' END
       RETURNING id,"importStatus"`,
      `meli-order-${sha256(externalOrderId).slice(0, 24)}`,
      companyId,
      channel.id,
      externalOrderId,
      payload.status ? String(payload.status) : null,
      orderedAt,
      grossAmount,
      feeAmount,
      JSON.stringify(payload),
    );
    return inserted[0];
  }

  async ingestOrderResource(companyId: string, resource: string) {
    if (!/^\/orders\/\d+$/.test(resource))
      throw new Error("Recurso Mercado Livre não permitido.");
    return this.ingestOrder(companyId, await this.request(companyId, resource));
  }

  async syncOrders(companyId: string, trigger = "MANUAL") {
    const integration = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "providerAccountId" FROM "ExternalIntegration"
        WHERE "companyId"=$1 AND provider='MERCADO_LIVRE' AND status='CONNECTED' LIMIT 1`,
      companyId,
    );
    const sellerId = String(integration[0]?.providerAccountId ?? "");
    if (!sellerId)
      throw new Error("Conta vendedora do Mercado Livre não identificada.");
    const channel = await this.ensureChannel(companyId, sellerId);
    const runId = randomUUID();
    await this.database.$executeRawUnsafe(
      `INSERT INTO "MarketplaceSyncRun"
        (id,"companyId","salesChannelId",provider,scope,trigger,status,"startedAt")
       VALUES ($1,$2,$3,'MERCADO_LIVRE','ORDERS',$4,'RUNNING',NOW())`,
      runId,
      companyId,
      channel.id,
      trigger,
    );
    try {
      const payload = await this.request(
        companyId,
        `/orders/search?seller=${encodeURIComponent(sellerId)}&sort=date_desc&limit=50`,
      );
      const results = Array.isArray(payload?.results) ? payload.results : [];
      for (const order of results) await this.ingestOrder(companyId, order);
      await this.database.$executeRawUnsafe(
        `UPDATE "MarketplaceSyncRun" SET status='SUCCEEDED',"recordsRead"=$2,
         "recordsUpdated"=$2,"finishedAt"=NOW() WHERE id=$1`,
        runId,
        results.length,
      );
      await this.database.salesChannel.update({
        where: { id: channel.id },
        data: { lastSyncedAt: new Date(), connectionStatus: "CONNECTED" },
      });
      await this.database.$executeRawUnsafe(
        `UPDATE "ExternalIntegration" SET "lastSyncAt"=NOW(),"lastError"=NULL,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND provider='MERCADO_LIVRE'`,
        companyId,
      );
      return { runId, recordsRead: results.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.database.$executeRawUnsafe(
        `UPDATE "MarketplaceSyncRun" SET status='FAILED',"lastError"=$2,"finishedAt"=NOW() WHERE id=$1`,
        runId,
        message,
      );
      throw error;
    }
  }

  async syncConnectedCompanies() {
    const rows = await this.database.$queryRawUnsafe<
      Array<{ companyId: string }>
    >(
      `SELECT "companyId" FROM "ExternalIntegration"
        WHERE provider='MERCADO_LIVRE' AND status='CONNECTED'
          AND ("lastSyncAt" IS NULL OR "lastSyncAt" < NOW() - INTERVAL '5 minutes')`,
    );
    for (const row of rows) {
      await this.syncOrders(row.companyId, "SCHEDULED").catch(async (error) => {
        await this.database.$executeRawUnsafe(
          `UPDATE "ExternalIntegration" SET "lastError"=$2,"updatedAt"=NOW()
            WHERE "companyId"=$1 AND provider='MERCADO_LIVRE'`,
          row.companyId,
          error instanceof Error ? error.message : String(error),
        );
      });
    }
  }

  async disconnect(companyId: string) {
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration" SET status='DISCONNECTED',
       "accessTokenCiphertext"=NULL,"refreshTokenCiphertext"=NULL,"tokenExpiresAt"=NULL,
       "lastError"=NULL,"updatedAt"=NOW()
       WHERE "companyId"=$1 AND provider='MERCADO_LIVRE'`,
      companyId,
    );
    await this.database.salesChannel.updateMany({
      where: { companyId, platformCode: "MERCADO_LIVRE" },
      data: { connectionStatus: "NOT_CONNECTED" },
    });
    return { status: "DISCONNECTED" };
  }
}
