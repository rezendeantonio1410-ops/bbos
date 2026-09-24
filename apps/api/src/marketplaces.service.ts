import {
  BadRequestException,
  Injectable,
  type OnModuleDestroy,
} from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { randomUUID } from "node:crypto";

@Injectable()
export class MarketplacesService implements OnModuleDestroy {
  readonly database = new PrismaClient();

  onModuleDestroy() {
    return this.database.$disconnect();
  }

  async dashboard(companyId: string, userId: string, role: string) {
    const operatorOnly = role === "MARKETPLACE_OPERATOR";
    const channelFilter = operatorOnly
      ? `AND EXISTS (
          SELECT 1 FROM "MarketplaceOperatorAccess" moa
           WHERE moa."companyId"=sc."companyId" AND moa."userId"=$2
             AND moa.active=true AND moa."salesChannelId"=sc.id
        )`
      : "";
    const channels = await this.database.$queryRawUnsafe<any[]>(
      `SELECT sc.id,sc.code,sc.name,sc."platformCode",sc."connectionStatus",
              sc."externalAccountId",sc."lastSyncedAt",sc."commissionPercent",sc."fixedFee",
              COUNT(moi.id)::int AS orders,
              COUNT(moi.id) FILTER (WHERE moi."importStatus" IN ('RECEIVED','READY','ATTENTION','ERROR'))::int AS pending,
              COALESCE(SUM(moi."grossAmount"),0) AS gross,
              COALESCE(SUM(moi."feeAmount"),0) AS fees,
              COALESCE(SUM(moi."freightAmount"),0) AS freight,
              COUNT(moi.id) FILTER (WHERE moi."importStatus" IN ('ATTENTION','ERROR'))::int AS errors
         FROM "SalesChannel" sc
         LEFT JOIN "MarketplaceOrderInbox" moi ON moi."salesChannelId"=sc.id
        WHERE sc."companyId"=$1 AND sc.active=true AND sc."platformCode" IS NOT NULL
          AND sc."platformCode" <> 'BISPO_STORE'
          ${channelFilter}
        GROUP BY sc.id
        ORDER BY CASE sc."platformCode" WHEN 'MERCADO_LIVRE' THEN 0 WHEN 'SHOPEE' THEN 1 WHEN 'AMAZON' THEN 2 ELSE 3 END`,
      companyId,
      userId,
    );
    const orders = await this.database.$queryRawUnsafe<any[]>(
      `SELECT moi.id,moi.provider,moi."externalOrderId",moi."externalStatus",moi."orderedAt",
              moi."grossAmount",moi."feeAmount",moi."freightAmount",moi."importStatus",
              moi."lastError",moi."lastSeenAt",sc.name AS "channelName"
         FROM "MarketplaceOrderInbox" moi
         JOIN "SalesChannel" sc ON sc.id=moi."salesChannelId"
        WHERE moi."companyId"=$1
          ${operatorOnly ? `AND EXISTS (SELECT 1 FROM "MarketplaceOperatorAccess" moa WHERE moa."companyId"=moi."companyId" AND moa."userId"=$2 AND moa.active=true AND moa."salesChannelId"=moi."salesChannelId")` : ""}
        ORDER BY moi."lastSeenAt" DESC LIMIT 30`,
      companyId,
      userId,
    );
    const syncRuns = await this.database.$queryRawUnsafe<any[]>(
      `SELECT msr.id,msr.provider,msr.scope,msr.trigger,msr.status,msr."recordsRead",
              msr."lastError",msr."startedAt",msr."finishedAt",sc.name AS "channelName"
         FROM "MarketplaceSyncRun" msr
         LEFT JOIN "SalesChannel" sc ON sc.id=msr."salesChannelId"
        WHERE msr."companyId"=$1
          ${operatorOnly ? `AND EXISTS (SELECT 1 FROM "MarketplaceOperatorAccess" moa WHERE moa."companyId"=msr."companyId" AND moa."userId"=$2 AND moa.active=true AND moa."salesChannelId"=msr."salesChannelId")` : ""}
        ORDER BY msr."startedAt" DESC LIMIT 10`,
      companyId,
      userId,
    );
    const normalized = channels.map((row) => ({
      ...row,
      orders: Number(row.orders ?? 0),
      pending: Number(row.pending ?? 0),
      errors: Number(row.errors ?? 0),
      gross: Number(row.gross ?? 0),
      fees: Number(row.fees ?? 0),
      freight: Number(row.freight ?? 0),
      net:
        Number(row.gross ?? 0) -
        Number(row.fees ?? 0) -
        Number(row.freight ?? 0),
    }));
    return {
      channels: normalized,
      orders,
      syncRuns,
      summary: normalized.reduce(
        (sum, channel) => ({
          gross: sum.gross + channel.gross,
          net: sum.net + channel.net,
          orders: sum.orders + channel.orders,
          pending: sum.pending + channel.pending,
          errors: sum.errors + channel.errors,
        }),
        { gross: 0, net: 0, orders: 0, pending: 0, errors: 0 },
      ),
    };
  }

  async operators(companyId: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT moa.id,moa."salesChannelId",moa."operatorCompanyName",moa.permissions,moa.active,
              moa."createdAt",u.id AS "userId",u.name,u.email,u.role,sc.name AS "channelName"
         FROM "MarketplaceOperatorAccess" moa
         JOIN "User" u ON u.id=moa."userId"
         LEFT JOIN "SalesChannel" sc ON sc.id=moa."salesChannelId"
        WHERE moa."companyId"=$1 ORDER BY moa.active DESC,u.name ASC`,
      companyId,
    );
  }

  async availableOperators(companyId: string) {
    return this.database.user.findMany({
      where: { companyId, role: "MARKETPLACE_OPERATOR", active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    });
  }

  async grantAccess(
    companyId: string,
    createdById: string,
    input: {
      userId?: string;
      salesChannelId?: string | null;
      operatorCompanyName?: string;
      permissions?: Record<string, boolean>;
    },
  ) {
    const user = await this.database.user.findFirst({
      where: {
        id: input.userId,
        companyId,
        role: "MARKETPLACE_OPERATOR",
        active: true,
      },
    });
    if (!user)
      throw new BadRequestException("Operador de marketplace não encontrado.");
    if (!input.salesChannelId)
      throw new BadRequestException("Selecione o marketplace do operador.");
    const channel = await this.database.salesChannel.findFirst({
      where: { id: input.salesChannelId, companyId, active: true },
    });
    if (!channel?.platformCode || channel.platformCode === "BISPO_STORE") {
      throw new BadRequestException("Canal de marketplace inválido.");
    }
    const permissions = {
      view: true,
      orders: input.permissions?.orders !== false,
      listings: input.permissions?.listings === true,
      prices: input.permissions?.prices === true,
      reconciliation: input.permissions?.reconciliation === true,
    };
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "MarketplaceOperatorAccess"
        (id,"companyId","salesChannelId","userId","operatorCompanyName",permissions,active,"createdById","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,true,$7,NOW(),NOW())
       ON CONFLICT ("userId","salesChannelId") DO UPDATE SET
        "operatorCompanyName"=EXCLUDED."operatorCompanyName",permissions=EXCLUDED.permissions,
        active=true,"updatedAt"=NOW()
       RETURNING *`,
      randomUUID(),
      companyId,
      input.salesChannelId,
      user.id,
      input.operatorCompanyName?.trim() || null,
      JSON.stringify(permissions),
      createdById,
    );
    return rows[0];
  }

  async setAccessStatus(companyId: string, id: string, active: boolean) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "MarketplaceOperatorAccess" SET active=$3,"updatedAt"=NOW()
        WHERE id=$1 AND "companyId"=$2 RETURNING *`,
      id,
      companyId,
      active,
    );
    if (!rows[0]) throw new BadRequestException("Acesso não encontrado.");
    return rows[0];
  }
}
