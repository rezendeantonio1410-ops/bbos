import { Controller, Get, Req, UnauthorizedException } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { AuthService } from "./auth.service";
import { blingReadiness } from "./integrations/bling/bling.contract";

@Controller("integrations")
export class IntegrationsController {
  private readonly database = new PrismaClient();

  constructor(private readonly auth: AuthService) {}

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
      `SELECT provider,status,"providerAccountId","connectedAt","lastSyncAt","lastError"
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

  @Get("fiscal/summary")
  async fiscalSummary(@Req() request: any) {
    const actor = await this.actor(request);
    const [documents, outbox, webhooks] = await Promise.all([
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
    ]);
    return { documents, outbox, webhooks };
  }
}
