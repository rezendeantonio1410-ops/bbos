import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Public } from "../../auth.guard";
import type { BlingWebhookEnvelope } from "./bling.contract";
import { BlingService } from "./bling.service";

@Controller("integrations/bling/webhooks")
export class BlingWebhookController {
  private readonly database = new PrismaClient();

  constructor(private readonly bling: BlingService) {}

  private validSignature(rawBody: Buffer, supplied?: string) {
    const clientSecret = process.env.BLING_CLIENT_SECRET?.trim();
    if (!clientSecret || !supplied?.startsWith("sha256=")) return false;
    const expected = `sha256=${createHmac("sha256", clientSecret)
      .update(rawBody)
      .digest("hex")}`;
    const a = Buffer.from(expected);
    const b = Buffer.from(supplied);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private async resolveCompany(providerCompanyId: string) {
    const mapped = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "companyId" FROM "ExternalIntegration"
       WHERE provider='BLING' AND "providerAccountId"=$1 AND status='CONNECTED'
       LIMIT 1`,
      providerCompanyId,
    );
    if (mapped[0]?.companyId) return mapped[0].companyId as string;

    const candidates = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,"companyId" FROM "ExternalIntegration"
       WHERE provider='BLING' AND status='CONNECTED' AND "providerAccountId" IS NULL
       LIMIT 2`,
    );
    if (candidates.length === 1) {
      await this.database.$executeRawUnsafe(
        `UPDATE "ExternalIntegration"
         SET "providerAccountId"=$2,"updatedAt"=NOW()
         WHERE id=$1`,
        candidates[0].id,
        providerCompanyId,
      );
      return candidates[0].companyId as string;
    }
    return null;
  }

  private fiscalStatus(value: unknown) {
    const code = Number(
      typeof value === "object" && value !== null
        ? ((value as any).id ?? (value as any).valor ?? (value as any).codigo)
        : value,
    );
    if (code === 5 || code === 6) return "AUTHORIZED";
    if (code === 2) return "CANCELLED";
    if (code === 4 || code === 9 || code === 11) return "REJECTED";
    return "SENT";
  }

  private async processInvoiceEvent(companyId: string, body: BlingWebhookEnvelope) {
    if (!String(body.event ?? "").startsWith("invoice.")) return { processed: false };

    const externalId = String((body as any)?.data?.id ?? "").trim();
    if (!externalId) return { processed: false };

    const detail = await this.bling
      .request(companyId, `/nfe/${encodeURIComponent(externalId)}`, { method: "GET" })
      .catch(() => ({}));
    const note = (detail as any)?.data ?? detail ?? {};
    const status = this.fiscalStatus((note as any)?.situacao ?? (body as any)?.data?.situacao);
    const accessKey = String((note as any)?.chaveAcesso ?? (note as any)?.chave ?? "").trim() || null;
    const number = (note as any)?.numero == null ? null : String((note as any).numero);
    const series = (note as any)?.serie == null ? null : String((note as any).serie);

    const mapped = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "internalKey" FROM "IntegrationResourceMap"
        WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='FISCAL_DOCUMENT'
          AND "externalId"=$2
        LIMIT 1`,
      companyId,
      externalId,
    );
    let fiscalId = mapped[0]?.internalKey as string | undefined;

    if (!fiscalId) {
      const direct = await this.database.$queryRawUnsafe<any[]>(
        `SELECT id FROM "FiscalDocument"
          WHERE "companyId"=$1 AND "externalProvider"='BLING' AND "externalId"=$2
          LIMIT 1`,
        companyId,
        externalId,
      );
      fiscalId = direct[0]?.id;
    }

    if (!fiscalId) return { processed: false, externalId, status };

    await this.database.$executeRawUnsafe(
      `UPDATE "FiscalDocument"
          SET status=$2,number=COALESCE($3,number),series=COALESCE($4,series),
              "accessKey"=COALESCE($5,"accessKey"),"externalProvider"='BLING',
              "externalId"=$6,"payloadSnapshot"=COALESCE("payloadSnapshot",'{}'::jsonb) || $7::jsonb,
              "updatedAt"=NOW()
        WHERE id=$1`,
      fiscalId,
      status,
      number,
      series,
      accessKey,
      externalId,
      JSON.stringify({ blingNfe: note }),
    );

    await this.database.$executeRawUnsafe(
      `UPDATE "IntegrationWebhookEvent"
          SET status='PROCESSED',"processedAt"=NOW(),"updatedAt"=COALESCE("updatedAt",NOW())
        WHERE provider='BLING' AND "providerEventId"=$1`,
      body.eventId,
    ).catch(() => undefined);

    return { processed: true, fiscalId, externalId, status, number, series, accessKey };
  }

  @Public()
  @Post()
  async receive(
    @Req() request: any,
    @Headers("x-bling-signature-256") signature: string | undefined,
    @Body() body: BlingWebhookEnvelope,
  ) {
    const rawBody = request.rawBody as Buffer | undefined;
    if (!rawBody) {
      throw new BadRequestException("Payload bruto do webhook indisponível para validação.");
    }
    if (!this.validSignature(rawBody, signature)) {
      throw new UnauthorizedException("Assinatura do webhook Bling inválida.");
    }
    if (!body?.eventId || !body?.event || !body?.companyId || !body?.version) {
      throw new BadRequestException("Webhook Bling incompleto.");
    }

    const companyId = await this.resolveCompany(body.companyId);
    const id = `bling-webhook-${body.eventId}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationWebhookEvent"
        (id,"companyId",provider,"providerEventId","eventName",payload,status,"receivedAt")
       VALUES ($1,$2,'BLING',$3,$4,$5::jsonb,'RECEIVED',NOW())
       ON CONFLICT (provider,"providerEventId") DO NOTHING`,
      id,
      companyId,
      body.eventId,
      body.event,
      JSON.stringify(body),
    );

    const fiscal = companyId ? await this.processInvoiceEvent(companyId, body) : { processed: false };
    return { accepted: true, eventId: body.eventId, fiscal };
  }
}
