import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { BLING_API_BASE_URL, BLING_ENV } from "./bling.contract";

const TOKEN_URL = `${BLING_API_BASE_URL}/oauth/token`;
const AUTHORIZE_URL = "https://www.bling.com.br/Api/v3/oauth/authorize";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class BlingService {
  private readonly database = new PrismaClient();

  private config() {
    const clientId = process.env[BLING_ENV.clientId]?.trim();
    const clientSecret = process.env[BLING_ENV.clientSecret]?.trim();
    const redirectUri = process.env[BLING_ENV.redirectUri]?.trim();
    const encryptionSecret = process.env.BLING_TOKEN_ENCRYPTION_KEY?.trim();
    if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) {
      throw new Error(
        "Bling não configurado. Verifique BLING_CLIENT_ID, BLING_CLIENT_SECRET, BLING_REDIRECT_URI e BLING_TOKEN_ENCRYPTION_KEY.",
      );
    }
    return { clientId, clientSecret, redirectUri, encryptionSecret };
  }

  private encryptionKey() {
    return createHash("sha256").update(this.config().encryptionSecret).digest();
  }

  private encrypt(plainText: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.encryptionKey(), iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, "utf8"),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".");
  }

  private decrypt(cipherText: string) {
    const [ivRaw, tagRaw, encryptedRaw] = cipherText.split(".");
    if (!ivRaw || !tagRaw || !encryptedRaw) throw new Error("Token Bling criptografado inválido.");
    const decipher = createDecipheriv(
      "aes-256-gcm",
      this.encryptionKey(),
      Buffer.from(ivRaw, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encryptedRaw, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  }

  async authorizationUrl(companyId: string) {
    const { clientId } = this.config();
    const state = randomBytes(32).toString("base64url");
    const stateHash = sha256(state);
    const integrationId = `bling-${sha256(companyId).slice(0, 24)}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "ExternalIntegration"
        (id,"companyId",provider,status,"oauthStateHash","oauthStateExpiresAt","createdAt","updatedAt")
       VALUES ($1,$2,'BLING','CONNECTING',$3,NOW() + INTERVAL '10 minutes',NOW(),NOW())
       ON CONFLICT ("companyId",provider) DO UPDATE SET
         status='CONNECTING',"oauthStateHash"=EXCLUDED."oauthStateHash",
         "oauthStateExpiresAt"=EXCLUDED."oauthStateExpiresAt","lastError"=NULL,"updatedAt"=NOW()`,
      integrationId,
      companyId,
      stateHash,
    );

    const url = new URL(AUTHORIZE_URL);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async completeAuthorization(code: string, state: string) {
    const stateHash = sha256(state);
    const integrations = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId" FROM "ExternalIntegration"
       WHERE provider='BLING' AND "oauthStateHash"=$1
         AND "oauthStateExpiresAt" > NOW()
       LIMIT 1`,
      stateHash,
    );
    const integration = integrations[0];
    if (!integration) throw new Error("State OAuth do Bling inválido ou expirado.");

    const token = await this.exchangeToken({ grant_type: "authorization_code", code });
    await this.persistTokens(integration.companyId, token);
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration"
       SET status='CONNECTED',"connectedAt"=COALESCE("connectedAt",NOW()),
           "oauthStateHash"=NULL,"oauthStateExpiresAt"=NULL,"lastError"=NULL,"updatedAt"=NOW()
       WHERE id=$1`,
      integration.id,
    );
    return { companyId: integration.companyId, status: "CONNECTED" };
  }

  private async exchangeToken(body: Record<string, string>) {
    const { clientId, clientSecret } = this.config();
    const response = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        "enable-jwt": "1",
      },
      body: new URLSearchParams(body).toString(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Falha OAuth Bling (${response.status}): ${JSON.stringify(payload)}`);
    }
    if (!payload.access_token || !payload.refresh_token) {
      throw new Error("Resposta OAuth do Bling sem access_token/refresh_token.");
    }
    return payload as {
      access_token: string;
      refresh_token: string;
      expires_in?: number;
    };
  }

  private async persistTokens(
    companyId: string,
    token: { access_token: string; refresh_token: string; expires_in?: number },
  ) {
    const expiresIn = Math.max(60, Number(token.expires_in ?? 3600));
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration"
       SET "accessTokenCiphertext"=$2,"refreshTokenCiphertext"=$3,
           "tokenExpiresAt"=NOW() + ($4 || ' seconds')::interval,
           "lastSyncAt"=NOW(),"updatedAt"=NOW()
       WHERE "companyId"=$1 AND provider='BLING'`,
      companyId,
      this.encrypt(token.access_token),
      this.encrypt(token.refresh_token),
      String(expiresIn),
    );
  }

  async accessToken(companyId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "accessTokenCiphertext","refreshTokenCiphertext","tokenExpiresAt"
       FROM "ExternalIntegration"
       WHERE "companyId"=$1 AND provider='BLING' AND status='CONNECTED'
       LIMIT 1`,
      companyId,
    );
    const integration = rows[0];
    if (!integration?.accessTokenCiphertext || !integration?.refreshTokenCiphertext) {
      throw new Error("Bling não conectado para esta empresa.");
    }

    const expiresAt = integration.tokenExpiresAt
      ? new Date(integration.tokenExpiresAt).getTime()
      : 0;
    if (expiresAt > Date.now() + 60_000) {
      return this.decrypt(integration.accessTokenCiphertext);
    }

    const refreshToken = this.decrypt(integration.refreshTokenCiphertext);
    const token = await this.exchangeToken({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    });
    await this.persistTokens(companyId, token);
    return token.access_token;
  }

  async request(companyId: string, path: string, init: RequestInit = {}) {
    const token = await this.accessToken(companyId);
    const response = await fetch(`${BLING_API_BASE_URL}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "enable-jwt": "1",
        ...(init.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Bling API ${response.status}: ${JSON.stringify(payload)}`);
    }
    return payload;
  }
}
