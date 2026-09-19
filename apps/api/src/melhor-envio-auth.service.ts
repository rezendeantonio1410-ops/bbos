import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

@Injectable()
export class MelhorEnvioAuthService {
  private readonly database = new PrismaClient();

  private config() {
    const clientId = process.env.MELHOR_ENVIO_CLIENT_ID?.trim();
    const clientSecret = process.env.MELHOR_ENVIO_CLIENT_SECRET?.trim();
    const redirectUri = process.env.MELHOR_ENVIO_REDIRECT_URI?.trim();
    const encryptionSecret = (
      process.env.INTEGRATION_TOKEN_ENCRYPTION_KEY || process.env.BLING_TOKEN_ENCRYPTION_KEY
    )?.trim();
    if (!clientId || !clientSecret || !redirectUri || !encryptionSecret) {
      throw new Error(
        "Melhor Envio não configurado. Verifique MELHOR_ENVIO_CLIENT_ID, MELHOR_ENVIO_CLIENT_SECRET, MELHOR_ENVIO_REDIRECT_URI e INTEGRATION_TOKEN_ENCRYPTION_KEY.",
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
    const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), encrypted]
      .map((part) => part.toString("base64url"))
      .join(".");
  }

  private decrypt(value: string) {
    const [iv, tag, encrypted] = value.split(".");
    if (!iv || !tag || !encrypted) throw new Error("Token do Melhor Envio criptografado inválido.");
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
    await this.database.$executeRawUnsafe(
      `INSERT INTO "ExternalIntegration"
        (id,"companyId",provider,status,"oauthStateHash","oauthStateExpiresAt","createdAt","updatedAt")
       VALUES ($1,$2,'MELHOR_ENVIO','CONNECTING',$3,NOW() + INTERVAL '10 minutes',NOW(),NOW())
       ON CONFLICT ("companyId",provider) DO UPDATE SET
         status='CONNECTING',"oauthStateHash"=EXCLUDED."oauthStateHash",
         "oauthStateExpiresAt"=EXCLUDED."oauthStateExpiresAt","lastError"=NULL,"updatedAt"=NOW()`,
      `melhor-envio-${sha256(companyId).slice(0, 20)}`,
      companyId,
      sha256(state),
    );
    const url = new URL("https://melhorenvio.com.br/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    return url.toString();
  }

  async completeAuthorization(code: string, state: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId" FROM "ExternalIntegration"
       WHERE provider='MELHOR_ENVIO' AND "oauthStateHash"=$1
         AND "oauthStateExpiresAt" > NOW() LIMIT 1`,
      sha256(state),
    );
    const integration = rows[0];
    if (!integration) throw new Error("Autorização do Melhor Envio inválida ou expirada.");
    const token = await this.exchange({ grant_type: "authorization_code", code });
    await this.persist(integration.companyId, token);
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration" SET status='CONNECTED',"connectedAt"=COALESCE("connectedAt",NOW()),
       "oauthStateHash"=NULL,"oauthStateExpiresAt"=NULL,"lastError"=NULL,"updatedAt"=NOW() WHERE id=$1`,
      integration.id,
    );
    return { status: "CONNECTED", provider: "MELHOR_ENVIO" };
  }

  private async exchange(values: Record<string, string>) {
    const { clientId, clientSecret, redirectUri } = this.config();
    const response = await fetch("https://melhorenvio.com.br/oauth/token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, ...values }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.access_token || !payload.refresh_token) {
      throw new Error(`Falha OAuth Melhor Envio (${response.status}).`);
    }
    return payload as { access_token: string; refresh_token: string; expires_in?: number };
  }

  private async persist(
    companyId: string,
    token: { access_token: string; refresh_token: string; expires_in?: number },
  ) {
    await this.database.$executeRawUnsafe(
      `UPDATE "ExternalIntegration" SET "accessTokenCiphertext"=$2,"refreshTokenCiphertext"=$3,
       "tokenExpiresAt"=NOW()+($4||' seconds')::interval,"lastSyncAt"=NOW(),"updatedAt"=NOW()
       WHERE "companyId"=$1 AND provider='MELHOR_ENVIO'`,
      companyId,
      this.encrypt(token.access_token),
      this.encrypt(token.refresh_token),
      String(Math.max(60, Number(token.expires_in ?? 2_592_000))),
    );
  }

  async accessToken(companyId: string) {
    const envToken = process.env.MELHOR_ENVIO_ACCESS_TOKEN?.trim();
    if (envToken) return envToken;
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "accessTokenCiphertext","refreshTokenCiphertext","tokenExpiresAt"
       FROM "ExternalIntegration" WHERE "companyId"=$1 AND provider='MELHOR_ENVIO' AND status='CONNECTED' LIMIT 1`,
      companyId,
    );
    const integration = rows[0];
    if (!integration?.accessTokenCiphertext || !integration?.refreshTokenCiphertext) {
      throw new Error("Melhor Envio ainda não foi autorizado no BBOS.");
    }
    if (new Date(integration.tokenExpiresAt || 0).getTime() > Date.now() + 86_400_000) {
      return this.decrypt(integration.accessTokenCiphertext);
    }
    const token = await this.exchange({
      grant_type: "refresh_token",
      refresh_token: this.decrypt(integration.refreshTokenCiphertext),
    });
    await this.persist(companyId, token);
    return token.access_token;
  }
}
