import { Controller, Get, Injectable, Req } from "@nestjs/common";
import type { Request } from "express";
import { Prisma, prisma } from "@bbos/database";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";

type BulkReservationRow = {
  id: string;
  status: "PENDING" | "PARTIAL" | "RESERVED";
  salesOrderId: string;
  salesOrderItemId: string;
  orderNumber: string;
  customerName: string;
  productVariantId: string;
  productName: string;
  sku: string;
  packageWeightG: number;
  packageQuantity: number;
  requestedKg: Prisma.Decimal;
  reservedKg: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class OrderPackagingService {
  private readonly database = prisma;

  async list(companyId: string, salesOrderId?: string) {
    const rows = await this.database.$queryRawUnsafe<BulkReservationRow[]>(
      `SELECT reservation.id,reservation.status,reservation."salesOrderId",
              reservation."salesOrderItemId",
              COALESCE(orders."orderNumber",orders.code) AS "orderNumber",
              customer.name AS "customerName",reservation."productVariantId",
              item."productName",item.sku,variant."netWeightGrams" AS "packageWeightG",
              reservation."packageQuantity",reservation."requestedKg",
              reservation."reservedKg",reservation."createdAt"
         FROM "RoastedWipReservation" reservation
         JOIN "SalesOrder" orders ON orders.id=reservation."salesOrderId"
         JOIN "SalesOrderItem" item ON item.id=reservation."salesOrderItemId"
         JOIN "Customer" customer ON customer.id=orders."customerId"
         JOIN "ProductVariant" variant ON variant.id=reservation."productVariantId"
        WHERE reservation."companyId"=$1
          AND ($2::text IS NULL OR reservation."salesOrderId"=$2)
          AND reservation.status IN ('PENDING','PARTIAL','RESERVED')
          AND orders.status::text IN ('CONFIRMED','IN_PRODUCTION')
        ORDER BY CASE reservation.status WHEN 'RESERVED' THEN 0 WHEN 'PARTIAL' THEN 1 ELSE 2 END,
                 reservation."createdAt",reservation.id`,
      companyId,
      salesOrderId ?? null,
    );
    return rows.map((row) => ({
      ...row,
      packageWeightG: Number(row.packageWeightG),
      packageQuantity: Number(row.packageQuantity),
      requestedKg: Number(row.requestedKg),
      reservedKg: Number(row.reservedKg),
      fullyReserved: row.status === "RESERVED",
      reference: `${Number(row.packageQuantity).toLocaleString("pt-BR")} unidade(s) de ${Number(row.packageWeightG).toLocaleString("pt-BR")} g`,
      stockForm: "BULK_ROASTED_COFFEE",
    }));
  }
}

@Controller("production/bulk-reservations")
export class OrderPackagingController {
  constructor(
    private readonly auth: AuthService,
    private readonly reservations: OrderPackagingService,
  ) {}

  @Get()
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    return this.reservations.list(actor.companyId);
  }
}
