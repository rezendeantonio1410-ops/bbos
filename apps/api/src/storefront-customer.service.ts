import {
  BadRequestException,
  HttpException,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { CustomerNotificationService } from "./customer-notification.service";

export const STOREFRONT_CUSTOMER_COOKIE = "bispo_customer_session";
const CODE_TTL_MINUTES = 10;
const SESSION_DAYS = 30;

export type StorefrontCustomerAccount = {
  id: string;
  companyId: string;
  email: string;
  name: string;
  phone?: string | null;
  taxId?: string | null;
  preferences?: Record<string, unknown> | null;
  sensoryProfile?: Record<string, unknown> | null;
  marketingConsent?: boolean;
};

export const normalizeCustomerEmail = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();
const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const sessionHash = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const safeEqual = (left: string, right: string) => {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
@Injectable()
export class StorefrontCustomerService {
  private readonly database = new PrismaClient();

  constructor(private readonly notifications: CustomerNotificationService) {}

  private async companyId() {
    const configured = process.env.STOREFRONT_COMPANY_ID?.trim();
    if (configured) return configured;
    const companies = await this.database.company.findMany({ select: { id: true }, take: 2 });
    if (companies.length !== 1)
      throw new ServiceUnavailableException(
        "Configure STOREFRONT_COMPANY_ID para habilitar a área do cliente.",
      );
    return companies[0]!.id;
  }

  private authSecret() {
    const configured =
      process.env.STOREFRONT_CUSTOMER_AUTH_SECRET?.trim() ||
      process.env.ORDER_TRACKING_SECRET?.trim();
    if (configured) return configured;
    if (process.env.NODE_ENV !== "production")
      return "bispo-local-customer-auth-development-only";
    throw new ServiceUnavailableException(
      "A autenticação da área do cliente ainda não foi configurada.",
    );
  }

  private codeHash(email: string, code: string) {
    return createHmac("sha256", this.authSecret())
      .update(`${email}:${code}`)
      .digest("hex");
  }

  private validateEmail(value: unknown) {
    const email = normalizeCustomerEmail(value);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      throw new BadRequestException("Informe um e-mail válido.");
    return email;
  }

  private async sendAccessCode(email: string, code: string) {
    try {
      await this.notifications.sendCustomerAccessCode(
        email,
        code,
        CODE_TTL_MINUTES,
      );
    } catch {
      throw new ServiceUnavailableException(
        "Não foi possível enviar o código agora. Tente novamente em instantes.",
      );
    }
  }

  async requestCode(rawEmail: unknown) {
    const email = this.validateEmail(rawEmail);
    const companyId = await this.companyId();
    const recent = await this.database.$queryRawUnsafe<
      Array<{ count: number | string; latest: Date | null }>
    >(
      `SELECT COUNT(*)::int AS count, MAX("createdAt") AS latest
         FROM "StorefrontCustomerAccessCode"
        WHERE "companyId"=$1 AND email=$2
          AND "createdAt" >= NOW() - INTERVAL '1 hour'`,
      companyId,
      email,
    );
    const count = Number(recent[0]?.count || 0);
    const latest = recent[0]?.latest ? new Date(recent[0]!.latest) : null;
    if (latest && Date.now() - latest.getTime() < 60_000)
      throw new HttpException(
        "Aguarde um minuto antes de pedir outro código.",
        429,
      );
    if (count >= 5)
      throw new HttpException(
        "Muitas tentativas. Aguarde antes de solicitar um novo código.",
        429,
      );

    const code = String(randomInt(100000, 1_000_000));
    await this.database.$executeRawUnsafe(
      `INSERT INTO "StorefrontCustomerAccessCode"
        (id,"companyId",email,"codeHash",attempts,"expiresAt","createdAt")
       VALUES ($1,$2,$3,$4,0,NOW() + INTERVAL '${CODE_TTL_MINUTES} minutes',NOW())`,
      randomUUID(),
      companyId,
      email,
      this.codeHash(email, code),
    );
    try {
      await this.sendAccessCode(email, code);
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAccessCode" SET "consumedAt"=NOW()
          WHERE "companyId"=$1 AND email=$2 AND "consumedAt" IS NULL`,
        companyId,
        email,
      );
      throw error;
    }
    await this.database.$executeRawUnsafe(
      `DELETE FROM "StorefrontCustomerAccessCode"
        WHERE "expiresAt" < NOW() - INTERVAL '7 days'`,
    );
    return {
      ok: true,
      expiresInSeconds: CODE_TTL_MINUTES * 60,
      ...(process.env.NODE_ENV !== "production" ? { developmentCode: code } : {}),
    };
  }

  async verifyCode(rawEmail: unknown, rawCode: unknown) {
    const email = this.validateEmail(rawEmail);
    const code = digits(rawCode);
    if (code.length !== 6)
      throw new UnauthorizedException("Código inválido ou expirado.");
    const companyId = await this.companyId();
    const codes = await this.database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "StorefrontCustomerAccessCode"
        WHERE "companyId"=$1 AND email=$2 AND "consumedAt" IS NULL
          AND "expiresAt" > NOW()
        ORDER BY "createdAt" DESC LIMIT 1`,
      companyId,
      email,
    );
    const accessCode = codes[0];
    if (!accessCode || Number(accessCode.attempts) >= 5)
      throw new UnauthorizedException("Código inválido ou expirado.");
    if (!safeEqual(String(accessCode.codeHash), this.codeHash(email, code))) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAccessCode" SET attempts=attempts+1 WHERE id=$1`,
        accessCode.id,
      );
      throw new UnauthorizedException("Código inválido ou expirado.");
    }

    const previousOrders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT customer,delivery FROM "StorefrontOrder"
        WHERE "companyId"=$1 AND lower(customer->>'email')=$2
        ORDER BY "createdAt" DESC LIMIT 1`,
      companyId,
      email,
    );
    const previous = previousOrders[0] || {};
    const customer = previous.customer || {};
    const fallbackName = email.split("@")[0]!.replace(/[._-]+/g, " ");
    const accountId = randomUUID();
    const accounts = await this.database.$queryRawUnsafe<StorefrontCustomerAccount[]>(
      `INSERT INTO "StorefrontCustomerAccount"
        (id,"companyId",email,name,phone,"taxId","lastLoginAt","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,NOW(),NOW(),NOW())
       ON CONFLICT ("companyId",email) DO UPDATE SET
         "lastLoginAt"=NOW(),"updatedAt"=NOW()
       RETURNING *`,
      accountId,
      companyId,
      email,
      String(customer.name || fallbackName || "Cliente Bispo").trim(),
      digits(customer.phone) || null,
      digits(customer.cpf) || null,
    );
    const account = accounts[0]!;

    await this.database.$transaction(async (transaction) => {
      const consumed = await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAccessCode" SET "consumedAt"=NOW()
          WHERE id=$1 AND "consumedAt" IS NULL`,
        accessCode.id,
      );
      if (!consumed)
        throw new UnauthorizedException("Este código já foi utilizado.");
      await transaction.$executeRawUnsafe(
        `UPDATE "StorefrontOrder" SET "customerAccountId"=$3,"updatedAt"=NOW()
          WHERE "companyId"=$1 AND lower(customer->>'email')=$2`,
        companyId,
        email,
        account.id,
      );
      const delivery = previous.delivery || {};
      if (
        delivery.postalCode &&
        delivery.street &&
        delivery.number &&
        delivery.district &&
        delivery.city &&
        /^[A-Za-z]{2}$/.test(String(delivery.state || ""))
      ) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO "StorefrontCustomerAddress"
            (id,"accountId",label,"recipientName",phone,"postalCode",street,number,complement,district,city,state,"isDefault","createdAt","updatedAt")
           SELECT $1,$2,'Principal',$3,$4,$5,$6,$7,$8,$9,$10,$11,TRUE,NOW(),NOW()
           WHERE NOT EXISTS (SELECT 1 FROM "StorefrontCustomerAddress" WHERE "accountId"=$2)`,
          randomUUID(),
          account.id,
          account.name,
          account.phone || null,
          digits(delivery.postalCode),
          String(delivery.street),
          String(delivery.number),
          String(delivery.complement || "") || null,
          String(delivery.district),
          String(delivery.city),
          String(delivery.state).toUpperCase(),
        );
      }
    });

    const token = randomBytes(32).toString("base64url");
    await this.database.$executeRawUnsafe(
      `INSERT INTO "StorefrontCustomerSession"
        (id,"accountId","tokenHash","expiresAt","lastSeenAt","createdAt")
       VALUES ($1,$2,$3,NOW() + INTERVAL '${SESSION_DAYS} days',NOW(),NOW())`,
      randomUUID(),
      account.id,
      sessionHash(token),
    );
    return { token, account: this.publicAccount(account) };
  }

  readToken(request: { headers?: { cookie?: string } }) {
    const raw = request.headers?.cookie ?? "";
    return raw
      .split(";")
      .map((item) => item.trim())
      .find((item) => item.startsWith(`${STOREFRONT_CUSTOMER_COOKIE}=`))
      ?.split("=")
      .slice(1)
      .join("=");
  }

  async resolve(token?: string): Promise<StorefrontCustomerAccount | null> {
    if (!token) return null;
    const rows = await this.database.$queryRawUnsafe<StorefrontCustomerAccount[]>(
      `SELECT a.* FROM "StorefrontCustomerSession" s
         JOIN "StorefrontCustomerAccount" a ON a.id=s."accountId"
        WHERE s."tokenHash"=$1 AND s."revokedAt" IS NULL AND s."expiresAt" > NOW()
        LIMIT 1`,
      sessionHash(token),
    );
    if (!rows[0]) return null;
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontCustomerSession" SET "lastSeenAt"=NOW()
        WHERE "tokenHash"=$1`,
      sessionHash(token),
    );
    return rows[0];
  }

  async revoke(token?: string) {
    if (!token) return;
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontCustomerSession" SET "revokedAt"=NOW()
        WHERE "tokenHash"=$1 AND "revokedAt" IS NULL`,
      sessionHash(token),
    );
  }

  async dashboard(account: StorefrontCustomerAccount) {
    const [addresses, orders] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(
        `SELECT id,label,"recipientName",phone,"postalCode",street,number,complement,district,city,state,"isDefault"
           FROM "StorefrontCustomerAddress" WHERE "accountId"=$1
          ORDER BY "isDefault" DESC,"createdAt" ASC`,
        account.id,
      ),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT o.id,o.code,o.status,o.items,o.recurrence,o."subtotalCents",o."shippingCents",o."totalCents",
                o."shippingServiceName",o."carrierName",o."estimatedDeliveryDays",o."paidAt",o."createdAt",
                s."trackingCode",s."trackingUrl",s.status AS "shipmentStatus",
                e."eventType" AS "latestEventType",e.title AS "latestEventTitle",e."occurredAt" AS "latestEventAt"
           FROM "StorefrontOrder" o
           LEFT JOIN "Shipment" s ON s."storefrontOrderId"=o.id
           LEFT JOIN LATERAL (
             SELECT "eventType",title,"occurredAt" FROM "StorefrontOrderEvent"
              WHERE "storefrontOrderId"=o.id AND public=TRUE
              ORDER BY "occurredAt" DESC LIMIT 1
           ) e ON TRUE
          WHERE o."companyId"=$2
            AND (o."customerAccountId"=$1 OR lower(o.customer->>'email')=$3)
          ORDER BY o."createdAt" DESC LIMIT 50`,
        account.id,
        account.companyId,
        account.email,
      ),
    ]);
    return { account: this.publicAccount(account), addresses, orders };
  }

  async ownsOrder(account: StorefrontCustomerAccount, orderId: string) {
    const rows = await this.database.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "StorefrontOrder"
        WHERE id=$1 AND "companyId"=$2
          AND ("customerAccountId"=$3 OR lower(customer->>'email')=$4)
        LIMIT 1`,
      orderId,
      account.companyId,
      account.id,
      account.email,
    );
    return Boolean(rows[0]);
  }

  async linkOrder(
    account: StorefrontCustomerAccount | null,
    orderId: string,
    orderEmail: unknown,
  ) {
    if (!account || normalizeCustomerEmail(orderEmail) !== account.email) return;
    await this.database.$executeRawUnsafe(
      `UPDATE "StorefrontOrder" SET "customerAccountId"=$2,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$3`,
      orderId,
      account.id,
      account.companyId,
    );
  }

  async updateProfile(
    account: StorefrontCustomerAccount,
    body: {
      name?: unknown;
      phone?: unknown;
      marketingConsent?: unknown;
      sensoryProfile?: unknown;
      preferences?: unknown;
    },
  ) {
    const name = String(body.name ?? account.name).trim();
    const phone = digits(body.phone ?? account.phone);
    if (name.length < 2 || name.length > 120)
      throw new BadRequestException("Informe um nome válido.");
    if (phone && (phone.length < 10 || phone.length > 11))
      throw new BadRequestException("Telefone inválido.");
    const sensoryProfile =
      body.sensoryProfile && typeof body.sensoryProfile === "object"
        ? body.sensoryProfile
        : account.sensoryProfile || null;
    const preferences =
      body.preferences && typeof body.preferences === "object"
        ? body.preferences
        : account.preferences || {};
    const rows = await this.database.$queryRawUnsafe<StorefrontCustomerAccount[]>(
      `UPDATE "StorefrontCustomerAccount" SET
         name=$2,phone=$3,"marketingConsent"=$4,"sensoryProfile"=$5::jsonb,
         preferences=$6::jsonb,"updatedAt"=NOW()
       WHERE id=$1 RETURNING *`,
      account.id,
      name,
      phone || null,
      body.marketingConsent === undefined
        ? Boolean(account.marketingConsent)
        : Boolean(body.marketingConsent),
      JSON.stringify(sensoryProfile),
      JSON.stringify(preferences),
    );
    return this.publicAccount(rows[0]!);
  }

  private addressValues(account: StorefrontCustomerAccount, body: Record<string, unknown>) {
    const postalCode = digits(body.postalCode);
    const state = String(body.state || "").trim().toUpperCase();
    const phone = digits(body.phone || account.phone);
    const values = {
      label: String(body.label || "Principal").trim().slice(0, 40),
      recipientName: String(body.recipientName || account.name).trim(),
      phone: phone || null,
      postalCode,
      street: String(body.street || "").trim(),
      number: String(body.number || "").trim(),
      complement: String(body.complement || "").trim() || null,
      district: String(body.district || "").trim(),
      city: String(body.city || "").trim(),
      state,
      isDefault: Boolean(body.isDefault),
    };
    if (
      postalCode.length !== 8 ||
      !values.recipientName ||
      !values.street ||
      !values.number ||
      !values.district ||
      !values.city ||
      !/^[A-Z]{2}$/.test(state)
    )
      throw new BadRequestException("Preencha o endereço completo.");
    return values;
  }

  async createAddress(account: StorefrontCustomerAccount, body: Record<string, unknown>) {
    const value = this.addressValues(account, body);
    const existing = await this.database.$queryRawUnsafe<Array<{ count: number | string }>>(
      `SELECT COUNT(*)::int AS count FROM "StorefrontCustomerAddress" WHERE "accountId"=$1`,
      account.id,
    );
    const isDefault = value.isDefault || Number(existing[0]?.count || 0) === 0;
    if (isDefault)
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAddress" SET "isDefault"=FALSE,"updatedAt"=NOW() WHERE "accountId"=$1`,
        account.id,
      );
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontCustomerAddress"
        (id,"accountId",label,"recipientName",phone,"postalCode",street,number,complement,district,city,state,"isDefault","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW(),NOW()) RETURNING *`,
      randomUUID(), account.id, value.label, value.recipientName, value.phone,
      value.postalCode, value.street, value.number, value.complement,
      value.district, value.city, value.state, isDefault,
    );
    return rows[0];
  }

  async updateAddress(
    account: StorefrontCustomerAccount,
    addressId: string,
    body: Record<string, unknown>,
  ) {
    const value = this.addressValues(account, body);
    const existing = await this.database.$queryRawUnsafe<
      Array<{ id: string; isDefault: boolean }>
    >(
      `SELECT id,"isDefault" FROM "StorefrontCustomerAddress"
        WHERE id=$1 AND "accountId"=$2 LIMIT 1`,
      addressId,
      account.id,
    );
    if (!existing[0]) throw new BadRequestException("Endereço não encontrado.");
    const isDefault = value.isDefault || existing[0].isDefault;
    if (isDefault)
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAddress" SET "isDefault"=FALSE,"updatedAt"=NOW() WHERE "accountId"=$1`,
        account.id,
      );
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "StorefrontCustomerAddress" SET
         label=$3,"recipientName"=$4,phone=$5,"postalCode"=$6,street=$7,number=$8,
         complement=$9,district=$10,city=$11,state=$12,"isDefault"=$13,"updatedAt"=NOW()
       WHERE id=$1 AND "accountId"=$2 RETURNING *`,
      addressId, account.id, value.label, value.recipientName, value.phone,
      value.postalCode, value.street, value.number, value.complement,
      value.district, value.city, value.state, isDefault,
    );
    return rows[0];
  }

  async deleteAddress(account: StorefrontCustomerAccount, addressId: string) {
    const deleted = await this.database.$queryRawUnsafe<Array<{ isDefault: boolean }>>(
      `DELETE FROM "StorefrontCustomerAddress" WHERE id=$1 AND "accountId"=$2
       RETURNING "isDefault"`,
      addressId,
      account.id,
    );
    if (!deleted[0]) throw new BadRequestException("Endereço não encontrado.");
    if (deleted[0].isDefault)
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontCustomerAddress" SET "isDefault"=TRUE,"updatedAt"=NOW()
          WHERE id=(SELECT id FROM "StorefrontCustomerAddress" WHERE "accountId"=$1 ORDER BY "createdAt" ASC LIMIT 1)`,
        account.id,
      );
    return { ok: true };
  }

  publicAccount(account: StorefrontCustomerAccount) {
    return {
      id: account.id,
      email: account.email,
      name: account.name,
      phone: account.phone || "",
      taxId: account.taxId || "",
      preferences: account.preferences || {},
      sensoryProfile: account.sensoryProfile || null,
      marketingConsent: Boolean(account.marketingConsent),
    };
  }
}
