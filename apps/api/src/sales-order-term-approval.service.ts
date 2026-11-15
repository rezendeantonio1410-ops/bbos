import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma, prisma, UserRole } from "@bbos/database";
import { randomUUID } from "node:crypto";
import { MobileNotificationService } from "./mobile-notification.service";
import {
  isDesignatedTermCreditApprover,
  requiresDelinquencyApproval,
} from "./sales-order-term-approval-policy";

type ApprovalActor = {
  id: string;
  companyId: string;
  name: string;
  email?: string | null;
  role: UserRole | string;
};

type DatabaseClient = Prisma.TransactionClient | typeof prisma;

@Injectable()
export class SalesOrderTermApprovalService {
  private readonly db = prisma;

  constructor(
    private readonly mobileNotifications: MobileNotificationService,
  ) {}

  private async context(
    database: DatabaseClient,
    companyId: string,
    orderId: string,
  ) {
    const rows = await database.$queryRawUnsafe<any[]>(
      `SELECT so.id,so."companyId",so."customerId",so."paymentType",so."totalAmount",so.status::text AS status,
              COALESCE(so."orderNumber",so.code) AS "orderNumber",c.name AS "customerName",
              COALESCE(SUM(CASE WHEN ar.status NOT IN ('PAID','CANCELLED')
                                  AND ar."dueDate" < NOW() AND ar."openAmount" > 0
                                THEN ar."openAmount" ELSE 0 END),0)::numeric AS "overdueAmount",
              COUNT(CASE WHEN ar.status NOT IN ('PAID','CANCELLED')
                           AND ar."dueDate" < NOW() AND ar."openAmount" > 0 THEN 1 END)::int AS "overdueCount",
              COALESCE(MAX(CASE WHEN ar.status NOT IN ('PAID','CANCELLED')
                                  AND ar."dueDate" < NOW() AND ar."openAmount" > 0
                                THEN FLOOR(EXTRACT(EPOCH FROM (NOW()-ar."dueDate"))/86400) END),0)::int AS "maxDaysOverdue"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id=so."customerId"
         LEFT JOIN "AccountsReceivable" ar ON ar."customerId"=c.id
        WHERE so.id=$1 AND so."companyId"=$2
        GROUP BY so.id,c.id`,
      orderId,
      companyId,
    );
    const context = rows[0];
    if (!context) throw new BadRequestException("Pedido não encontrado.");
    return {
      ...context,
      totalAmount: Number(context.totalAmount ?? 0),
      overdueAmount: Number(context.overdueAmount ?? 0),
      overdueCount: Number(context.overdueCount ?? 0),
      maxDaysOverdue: Number(context.maxDaysOverdue ?? 0),
    };
  }

  private async record(
    database: DatabaseClient,
    companyId: string,
    orderId: string,
  ) {
    const rows = await database.$queryRawUnsafe<any[]>(
      `SELECT * FROM "SalesOrderTermApproval"
        WHERE "companyId"=$1 AND "salesOrderId"=$2 LIMIT 1`,
      companyId,
      orderId,
    );
    return rows[0] ?? null;
  }

  private async approvers(companyId: string) {
    const users = await this.db.user.findMany({
      where: {
        companyId,
        active: true,
        role: { in: [UserRole.ADMIN, UserRole.EXECUTIVE] },
      },
      select: { id: true, name: true, email: true, role: true },
    });
    return users.filter(isDesignatedTermCreditApprover);
  }

  async ensureForOrder(
    companyId: string,
    orderId: string,
    actor: ApprovalActor,
  ) {
    const result = await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "SalesOrder" WHERE id=${orderId} AND "companyId"=${companyId} FOR UPDATE`;
      const context = await this.context(transaction, companyId, orderId);
      const required = requiresDelinquencyApproval(context);
      if (!required) return { context, approval: null, created: false };
      const existing = await this.record(transaction, companyId, orderId);
      if (existing) return { context, approval: existing, created: false };
      const id = randomUUID();
      const rows = await transaction.$queryRawUnsafe<any[]>(
        `INSERT INTO "SalesOrderTermApproval"
          (id,"companyId","salesOrderId","customerId",reason,"orderAmount","overdueAmount","overdueCount","maxDaysOverdue",
           status,"requestedById","requestedByName","requestedByRole","requestedAt","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'DELINQUENT_CUSTOMER',$5,$6,$7,$8,'PENDING',$9,$10,$11,NOW(),NOW(),NOW())
         RETURNING *`,
        id,
        companyId,
        orderId,
        context.customerId,
        context.totalAmount,
        context.overdueAmount,
        context.overdueCount,
        context.maxDaysOverdue,
        actor.id,
        actor.name,
        actor.role,
      );
      return { context, approval: rows[0], created: true };
    });

    if (result.created && result.approval) {
      const approvers = await this.approvers(companyId);
      await this.mobileNotifications.queue({
        companyId,
        userIds: approvers.map((user) => user.id),
        idempotencyKey: `sales-order:${orderId}:term-approval:${result.approval.id}`,
        type: "TERM_SALE_APPROVAL_REQUIRED",
        title: "Venda a prazo requer autorização",
        message: `${result.context.orderNumber} · ${result.context.customerName} possui ${result.context.overdueCount} título(s) vencido(s), total de ${result.context.overdueAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        href: "/pedidos",
        entityType: "SALES_ORDER",
        entityId: orderId,
      });
    }
    return this.view(companyId, orderId, actor);
  }

  async view(companyId: string, orderId: string, actor: ApprovalActor) {
    const context = await this.context(this.db, companyId, orderId);
    const approval = await this.record(this.db, companyId, orderId);
    const requiresApproval = requiresDelinquencyApproval(context);
    return {
      requiresApproval,
      status: requiresApproval
        ? (approval?.status ?? "PENDING")
        : "NOT_REQUIRED",
      approvalId: approval?.id ?? null,
      orderAmount: context.totalAmount,
      overdueAmount: context.overdueAmount,
      overdueCount: context.overdueCount,
      maxDaysOverdue: context.maxDaysOverdue,
      customerName: context.customerName,
      requestedByName: approval?.requestedByName ?? null,
      requestedAt: approval?.requestedAt ?? null,
      decidedByName: approval?.decidedByName ?? null,
      decidedAt: approval?.decidedAt ?? null,
      decisionNote: approval?.decisionNote ?? null,
      canDecide: isDesignatedTermCreditApprover(actor),
      approverLabel: "José ou Suzi",
    };
  }

  async decide(
    companyId: string,
    orderId: string,
    actor: ApprovalActor,
    decision: "APPROVE" | "REJECT",
    note?: string,
  ) {
    if (!isDesignatedTermCreditApprover(actor)) {
      throw new UnauthorizedException(
        "Somente José ou Suzi podem autorizar venda a prazo para cliente inadimplente.",
      );
    }
    await this.db.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM "SalesOrder" WHERE id=${orderId} AND "companyId"=${companyId} FOR UPDATE`;
      const context = await this.context(transaction, companyId, orderId);
      if (context.status !== "DRAFT")
        throw new BadRequestException(
          "A autorização financeira precisa ser decidida enquanto o pedido está em rascunho.",
        );
      const approval = await this.record(transaction, companyId, orderId);
      if (!approval)
        throw new BadRequestException(
          "A solicitação de autorização financeira não foi encontrada.",
        );
      if (approval.status !== "PENDING")
        throw new BadRequestException("Esta solicitação já foi decidida.");
      await transaction.$executeRawUnsafe(
        `UPDATE "SalesOrderTermApproval"
            SET status=$3,"decidedById"=$4,"decidedByName"=$5,"decidedByRole"=$6,
                "decisionNote"=$7,"decidedAt"=NOW(),"updatedAt"=NOW()
          WHERE "companyId"=$1 AND "salesOrderId"=$2 AND status='PENDING'`,
        companyId,
        orderId,
        decision === "APPROVE" ? "APPROVED" : "REJECTED",
        actor.id,
        actor.name,
        actor.role,
        String(note ?? "").trim() || null,
      );
    });
    return this.view(companyId, orderId, actor);
  }

  async assertApproved(
    database: DatabaseClient,
    companyId: string,
    orderId: string,
  ) {
    const context = await this.context(database, companyId, orderId);
    if (!requiresDelinquencyApproval(context)) return;
    const approval = await this.record(database, companyId, orderId);
    if (approval?.status !== "APPROVED") {
      throw new BadRequestException(
        "Venda a prazo bloqueada: o cliente possui títulos vencidos e aguarda autorização de José ou Suzi.",
      );
    }
  }
}
