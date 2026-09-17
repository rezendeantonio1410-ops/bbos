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

@Controller("integrations/bling/webhooks")
export class BlingWebhookController {
  private readonly database = new PrismaClient();

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

    return { accepted: true, eventId: body.eventId };
  }
}
