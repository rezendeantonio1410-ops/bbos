import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { blingReadiness } from "./integrations/bling/bling.contract";
import { BlingService } from "./integrations/bling/bling.service";
import { BlingOutboxService } from "./integrations/bling/bling-outbox.service";
import { BlingCatalogSyncService } from "./integrations/bling/bling-catalog-sync.service";
import { MelhorEnvioAuthService } from "./melhor-envio-auth.service";
import { MercadoLivreService } from "./integrations/mercado-livre/mercado-livre.service";

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

@Controller("integrations")
export class IntegrationsController {
  private readonly database = new PrismaClient();

  constructor(
    private readonly auth: AuthService,
    private readonly blingService: BlingService,
    private readonly blingOutbox: BlingOutboxService,
    private readonly blingCatalogSync: BlingCatalogSyncService,
    private readonly melhorEnvioAuth: MelhorEnvioAuthService,
    private readonly mercadoLivre: MercadoLivreService,
  ) {}

  @Get("mercado-livre/status")
  async mercadoLivreStatus(@Req() request: any) {
    const actor = await this.actor(request);
    return this.mercadoLivre.status(actor.companyId);
  }

  @Get("mercado-livre/connect")
  async connectMercadoLivre(@Req() request: any, @Res() response: any) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException(
        "A conexão do canal é restrita à gestão da Bispo.",
      );
    }
    try {
      return response.redirect(
        await this.mercadoLivre.authorizationUrl(actor.companyId),
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Não foi possível conectar o Mercado Livre.",
      );
    }
  }

  @Public()
  @Get("mercado-livre/callback")
  async mercadoLivreCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Res() response: any,
  ) {
    if (!code || !state)
      throw new BadRequestException(
        "Callback OAuth do Mercado Livre incompleto.",
      );
    try {
      await this.mercadoLivre.completeAuthorization(code, state);
      const webUrl = process.env.WEB_URL?.split(",")[0]?.trim();
      return response.redirect(
        webUrl
          ? `${webUrl.replace(/\/$/, "")}/commerce/marketplaces?connected=mercado-livre`
          : "/commerce/marketplaces?connected=mercado-livre",
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao concluir autorização do Mercado Livre.",
      );
    }
  }

  @Post("mercado-livre/disconnect")
  async disconnectMercadoLivre(@Req() request: any) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) {
      throw new UnauthorizedException(
        "A desconexão do canal é restrita à gestão da Bispo.",
      );
    }
    return this.mercadoLivre.disconnect(actor.companyId);
  }

  @Public()
  @Post("mercado-livre/webhooks")
  @HttpCode(202)
  async mercadoLivreWebhook(@Body() payload: any) {
    const topic = String(payload?.topic ?? "");
    const resource = String(payload?.resource ?? "");
    const userId = String(payload?.user_id ?? "");
    const applicationId = String(payload?.application_id ?? "");
    if (topic !== "orders_v2" || !/^\/orders\/\d+$/.test(resource) || !userId) {
      throw new BadRequestException("Notificação Mercado Livre inválida.");
    }
    const configuredApplicationId = process.env.MERCADO_LIVRE_CLIENT_ID?.trim();
    if (configuredApplicationId && applicationId !== configuredApplicationId) {
      throw new UnauthorizedException(
        "Notificação Mercado Livre de outra aplicação.",
      );
    }
    const rows = await this.database.$queryRawUnsafe<
      Array<{ companyId: string }>
    >(
      `SELECT "companyId" FROM "ExternalIntegration"
        WHERE provider='MERCADO_LIVRE' AND status='CONNECTED' AND "providerAccountId"=$1 LIMIT 1`,
      userId,
    );
    const companyId = rows[0]?.companyId;
    if (!companyId)
      throw new UnauthorizedException("Conta Mercado Livre não reconhecida.");
    const providerEventId = sha256(
      [
        applicationId,
        userId,
        topic,
        resource,
        String(payload?.sent ?? ""),
      ].join(":"),
    );
    const inserted = await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationWebhookEvent"
        (id,"companyId",provider,"providerEventId","eventName",payload,status,"receivedAt")
       VALUES ($1,$2,'MERCADO_LIVRE',$3,$4,$5::jsonb,'RECEIVED',NOW())
       ON CONFLICT (provider,"providerEventId") DO NOTHING`,
      `meli-wh-${providerEventId.slice(0, 24)}`,
      companyId,
      providerEventId,
      topic,
      JSON.stringify(payload),
    );
    if (inserted > 0) {
      await this.mercadoLivre.ingestOrderResource(companyId, resource);
      await this.database.$executeRawUnsafe(
        `UPDATE "IntegrationWebhookEvent" SET status='PROCESSED',"processedAt"=NOW()
          WHERE provider='MERCADO_LIVRE' AND "providerEventId"=$1`,
        providerEventId,
      );
    }
    return { accepted: true, duplicate: inserted === 0 };
  }

  @Get("melhor-envio/connect")
  async connectMelhorEnvio(@Req() request: any, @Res() response: any) {
    const actor = await this.actor(request);
    try {
      return response.redirect(
        await this.melhorEnvioAuth.authorizationUrl(actor.companyId),
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Não foi possível conectar o Melhor Envio.",
      );
    }
  }

  @Public()
  @Get("melhor-envio/callback")
  async melhorEnvioCallback(
    @Query("code") code?: string,
    @Query("state") state?: string,
  ) {
    if (!code || !state)
      throw new BadRequestException(
        "Callback OAuth do Melhor Envio incompleto.",
      );
    try {
      return await this.melhorEnvioAuth.completeAuthorization(code, state);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao concluir autorização do Melhor Envio.",
      );
    }
  }

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  private verifyBlingWebhookSignature(request: any) {
    const secret = process.env.BLING_CLIENT_SECRET?.trim();
    if (!secret)
      throw new UnauthorizedException("Webhook Bling sem segredo configurado.");

    const supplied = String(
      request.headers?.["x-bling-signature-256"] ?? "",
    ).trim();
    const rawBody: Buffer | undefined = request.rawBody;
    if (!supplied || !rawBody)
      throw new UnauthorizedException("Assinatura do webhook Bling ausente.");

    const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
    const suppliedBuffer = Buffer.from(supplied, "utf8");
    const expectedBuffer = Buffer.from(expected, "utf8");
    if (
      suppliedBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(suppliedBuffer, expectedBuffer)
    ) {
      throw new UnauthorizedException("Assinatura do webhook Bling inválida.");
    }
  }

  private async resolveWebhookCompanyId(providerCompanyId?: string) {
    if (providerCompanyId) {
      const exact = await this.database.$queryRawUnsafe<
        Array<{ companyId: string }>
      >(
        `SELECT "companyId" FROM "ExternalIntegration"
          WHERE provider='BLING' AND "providerAccountId"=$1
          LIMIT 1`,
        providerCompanyId,
      );
      if (exact[0]?.companyId) return exact[0].companyId;
    }

    const connected = await this.database.$queryRawUnsafe<
      Array<{ companyId: string }>
    >(
      `SELECT "companyId" FROM "ExternalIntegration"
        WHERE provider='BLING' AND status IN ('CONNECTED','CONNECTING')
        ORDER BY "connectedAt" DESC NULLS LAST, "updatedAt" DESC
        LIMIT 2`,
    );
    return connected.length === 1 ? (connected[0]?.companyId ?? null) : null;
  }

  @Get("bling/readiness")
  async bling(@Req() request: any) {
    const actor = await this.actor(request);
    const readiness = blingReadiness();
    const rows = await this.database
      .$queryRawUnsafe<any[]>(
        `SELECT provider,status,"providerAccountId","connectedAt","lastSyncAt","lastError","tokenExpiresAt"
         FROM "ExternalIntegration"
        WHERE "companyId"=$1 AND provider='BLING'
        LIMIT 1`,
        actor.companyId,
      )
      .catch(() => []);
    return {
      provider: "BLING",
      ...readiness,
      connection: rows[0] ?? { status: "DISCONNECTED" },
      credentialsExposed: false,
    };
  }

  @Get("bling/connect")
  async connectBling(@Req() request: any, @Res() response: any) {
    const actor = await this.actor(request);
    try {
      const authorizationUrl = await this.blingService.authorizationUrl(
        actor.companyId,
      );
      return response.redirect(authorizationUrl);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar a conexão com o Bling.",
      );
    }
  }

  @Public()
  @Get("bling/callback")
  async blingCallback(
    @Query("code") code?: string,
    @Query("state") state?: string,
  ) {
    if (!code || !state)
      throw new BadRequestException("Callback OAuth do Bling incompleto.");
    try {
      return await this.blingService.completeAuthorization(code, state);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao concluir autorização do Bling.",
      );
    }
  }

  @Public()
  @Post("bling/webhooks")
  @HttpCode(202)
  async receiveBlingWebhook(@Req() request: any) {
    this.verifyBlingWebhookSignature(request);

    const payload = request.body ?? {};
    const providerEventId = String(payload.eventId ?? "").trim();
    const eventName = String(payload.event ?? "").trim();
    const providerCompanyId = payload.companyId
      ? String(payload.companyId)
      : undefined;
    if (!providerEventId || !eventName) {
      throw new BadRequestException("Webhook Bling sem eventId ou event.");
    }

    const companyId = await this.resolveWebhookCompanyId(providerCompanyId);
    const id = `bling-wh-${sha256(providerEventId).slice(0, 24)}`;
    const inserted = await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationWebhookEvent"
        (id,"companyId",provider,"providerEventId","eventName",payload,status,"receivedAt")
       VALUES ($1,$2,'BLING',$3,$4,$5::jsonb,'RECEIVED',NOW())
       ON CONFLICT (provider,"providerEventId") DO NOTHING`,
      id,
      companyId,
      providerEventId,
      eventName,
      JSON.stringify(payload),
    );

    return {
      accepted: true,
      duplicate: inserted === 0,
      eventId: providerEventId,
      event: eventName,
    };
  }

  @Get("bling/catalog/status")
  async blingCatalogStatus(@Req() request: any) {
    const actor = await this.actor(request);
    return this.blingCatalogSync.status(actor.companyId);
  }

  @Get("bling/catalog/profiles")
  async blingCatalogProfiles(@Req() request: any) {
    const actor = await this.actor(request);
    return this.blingCatalogSync.profiles(actor.companyId);
  }

  @Get("bling/fiscal-profile")
  async companyFiscalProfile(@Req() request: any) {
    const actor = await this.actor(request);
    return this.blingCatalogSync.companyFiscalProfile(actor.companyId);
  }

  @Patch("bling/fiscal-profile")
  async saveCompanyFiscalProfile(
    @Req() request: any,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(request);
    try {
      return await this.blingCatalogSync.saveCompanyFiscalProfile(
        actor.companyId,
        body ?? {},
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao salvar perfil fiscal da empresa.",
      );
    }
  }

  @Patch("bling/catalog/profiles/:slug")
  async saveBlingCatalogProfile(
    @Req() request: any,
    @Param("slug") slug: string,
    @Body() body: Record<string, unknown>,
  ) {
    const actor = await this.actor(request);
    try {
      return await this.blingCatalogSync.saveProfile(
        actor.companyId,
        slug,
        body ?? {},
      );
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao salvar parametrização do produto.",
      );
    }
  }

  @Post("bling/catalog/reconcile")
  async reconcileBlingCatalog(@Req() request: any) {
    const actor = await this.actor(request);
    try {
      return await this.blingCatalogSync.reconcile(actor.companyId);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao reconciliar catálogo com o Bling.",
      );
    }
  }

  @Post("bling/catalog/create-missing")
  async createMissingBlingProducts(@Req() request: any) {
    const actor = await this.actor(request);
    try {
      return await this.blingCatalogSync.createMissing(actor.companyId);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : "Falha ao criar produtos ausentes no Bling.",
      );
    }
  }

  @Post("bling/sales-orders/:id/retry-invoice")
  async retryInvoice(@Req() request: any, @Param("id") id: string) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) throw new UnauthorizedException("O reprocessamento fiscal é restrito à gestão.");
    return this.blingOutbox.retrySalesOrderInvoice(actor.companyId, id);
  }

  @Post("bling/sales-orders/:id/reset-cancelled-invoice")
  async resetCancelledInvoice(@Req() request: any, @Param("id") id: string) {
    const actor = await this.actor(request);
    if (!["ADMIN", "EXECUTIVE"].includes(actor.role)) throw new UnauthorizedException("A regularização fiscal é restrita à gestão.");
    return this.blingOutbox.resetCancelledSalesOrderInvoice(actor.companyId, id);
  }

  @Post("bling/process-next")
  async processNextBling(@Req() request: any) {
    const actor = await this.actor(request);
    return this.blingOutbox.processNext(actor.companyId);
  }

  @Get("fiscal/summary")
  async fiscalSummary(@Req() request: any) {
    const actor = await this.actor(request);
    const [documents, outbox, webhooks, mappings] = await Promise.all([
      this.database
        .$queryRawUnsafe<any[]>(
          `SELECT direction,status,COUNT(*)::int AS count
           FROM "FiscalDocument"
          WHERE "companyId"=$1
          GROUP BY direction,status`,
          actor.companyId,
        )
        .catch(() => []),
      this.database
        .$queryRawUnsafe<any[]>(
          `SELECT status,COUNT(*)::int AS count
           FROM "IntegrationOutbox"
          WHERE "companyId"=$1
          GROUP BY status`,
          actor.companyId,
        )
        .catch(() => []),
      this.database
        .$queryRawUnsafe<any[]>(
          `SELECT status,COUNT(*)::int AS count
           FROM "IntegrationWebhookEvent"
          WHERE "companyId"=$1 OR "companyId" IS NULL
          GROUP BY status`,
          actor.companyId,
        )
        .catch(() => []),
      this.database
        .$queryRawUnsafe<any[]>(
          `SELECT "resourceType",COUNT(*)::int AS count
           FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
          GROUP BY "resourceType"`,
          actor.companyId,
        )
        .catch(() => []),
    ]);
    return { documents, outbox, webhooks, mappings };
  }
}
