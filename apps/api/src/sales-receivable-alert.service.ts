import { Injectable } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";

type OverdueReceivable = {
  id: string;
  companyId: string;
  customerId: string;
  customerName: string;
  orderNumber: string | null;
  dueDate: Date;
  openAmount: unknown;
  daysOverdue: number;
};

export const salesOverdueNotificationType = (
  customerId: string,
  receivableId: string,
) => `SALES_RECEIVABLE_OVERDUE:${customerId}:${receivableId}`;

export const salesOverdueMessage = (item: {
  customerName: string;
  orderNumber?: string | null;
  openAmount: unknown;
  daysOverdue: number;
}) => {
  const amount = Number(item.openAmount ?? 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const order = item.orderNumber ? `Pedido ${item.orderNumber} · ` : "";
  return `${order}${item.customerName} possui ${amount} vencidos há ${item.daysOverdue} dia(s). Consulte o histórico antes do próximo atendimento.`;
};

@Injectable()
export class SalesReceivableAlertService {
  private readonly db = prisma;
  private nextSyncAt = 0;

  async sync(force = false) {
    const now = Date.now();
    if (!force && now < this.nextSyncAt) return 0;

    const overdue = await this.db.$queryRawUnsafe<OverdueReceivable[]>(
      `SELECT ar.id,ar."companyId",ar."customerId",c.name AS "customerName",
              COALESCE(so."orderNumber",so.code) AS "orderNumber",ar."dueDate",ar."openAmount",
              GREATEST(1,FLOOR(EXTRACT(EPOCH FROM (NOW()-ar."dueDate"))/86400))::int AS "daysOverdue"
         FROM "AccountsReceivable" ar
         JOIN "Customer" c ON c.id=ar."customerId" AND c."companyId"=ar."companyId"
         LEFT JOIN "SalesOrder" so ON so.id=ar."salesOrderId" AND so."companyId"=ar."companyId"
        WHERE ar.status NOT IN ('PAID','CANCELLED')
          AND ar."openAmount" > 0
          AND ar."dueDate" < CURRENT_DATE
        ORDER BY ar."dueDate" ASC
        LIMIT 200`,
    );

    let created = 0;
    for (const item of overdue) {
      const type = salesOverdueNotificationType(item.customerId, item.id);
      const inserted = await this.db.$executeRawUnsafe(
        `INSERT INTO "OperationalNotification"
          (id,"companyId",type,title,message,"targetRole","createdAt")
         VALUES ($1,$2,$3,'Cliente com pagamento vencido',$4,'SALES',NOW())
         ON CONFLICT DO NOTHING`,
        randomUUID(),
        item.companyId,
        type,
        salesOverdueMessage(item),
      );
      created += inserted;
    }
    this.nextSyncAt = Date.now() + 15 * 60_000;
    return created;
  }
}
