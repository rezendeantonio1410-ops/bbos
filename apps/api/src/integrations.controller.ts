import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";
import { Public } from "./auth.guard";
import { blingReadiness } from "./integrations/bling/bling.contract";
import { BlingService } from "./integrations/bling/bling.service";
import { BlingOutboxService } from "./integrations/bling/bling-outbox.service";

@Controller("integrations")
export class IntegrationsController {
  private readonly database = new PrismaClient();

  constructor(
    private readonly auth: AuthService,
    private readonly blingService: BlingService,
    private readonly blingOutbox: BlingOutboxService,
  ) {}

  private async actor(request: any) {
    const actor = await this.auth.resolve(this.auth.readToken(request));
    if (!actor) throw new UnauthorizedException("Sessão inválida.");
    return actor;
  }

  @Get("bling/readiness")
  async bling(@Req() request: any) {
    const actor = await this.actor(request);
    const readiness = blingReadiness();
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT provider,status,"providerAccountId","connectedAt","lastSyncAt","lastError","tokenExpiresAt"
         FROM "ExternalIntegration"
        WHERE "companyId"=$1 AND provider='BLING'
        LIMIT 1`,
      actor.companyId,
    ).catch(() => []);
    return {
      provider: "BLING",
      ...readiness,
      connection: rows[0] ?? { status: "DISCONNECTED" },
      credentialsExposed: false,
    };
  }

  @Get("bling/connect")
  async connectBling(@Req() request: any) {
    const actor = await this.actor(request);
    try {
      return { authorizationUrl: await this.blingService.authorizationUrl(actor.companyId) };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Não foi possível iniciar a conexão com o Bling.",
      );
    }
  }

  @Public()
  @Get("bling/callback")
  async blingCallback(@Query("code") code?: string, @Query("state") state?: string) {
    if (!code || !state) throw new BadRequestException("Callback OAuth do Bling incompleto.");
    try {
      return await this.blingService.completeAuthorization(code, state);
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : "Falha ao concluir autorização do Bling.",
      );
    }
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
      this.database.$queryRawUnsafe<any[]>(
        `SELECT direction,status,COUNT(*)::int AS count
           FROM "FiscalDocument"
          WHERE "companyId"=$1
          GROUP BY direction,status`,
        actor.companyId,
      ).catch(() => []),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT status,COUNT(*)::int AS count
           FROM "IntegrationOutbox"
          WHERE "companyId"=$1
          GROUP BY status`,
        actor.companyId,
      ).catch(() => []),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT status,COUNT(*)::int AS count
           FROM "IntegrationWebhookEvent"
          WHERE "companyId"=$1 OR "companyId" IS NULL
          GROUP BY status`,
        actor.companyId,
      ).catch(() => []),
      this.database.$queryRawUnsafe<any[]>(
        `SELECT "resourceType",COUNT(*)::int AS count
           FROM "IntegrationResourceMap"
          WHERE "companyId"=$1 AND provider='BLING'
          GROUP BY "resourceType"`,
        actor.companyId,
      ).catch(() => []),
    ]);
    return { documents, outbox, webhooks, mappings };
  }
}
