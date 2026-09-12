import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  SalesOrdersService,
  type CreateSalesOrderInput,
} from "./sales-orders.service";

const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
};
const termDays = (value: unknown) => {
  const match = String(value ?? "").match(/(\d+)/);
  return match ? Math.max(0, Number(match[1])) : 0;
};

@Controller("sales-orders")
export class SalesOrdersController {
  constructor(private readonly salesOrders: SalesOrdersService) {}

  @Get()
  list() {
    return this.salesOrders.list();
  }

  @Get("options")
  options() {
    return this.salesOrders.options();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.salesOrders.get(id);
  }

  @Post()
  async create(@Body() body: CreateSalesOrderInput & { paymentType?: string; paymentTerms?: string }) {
    const paymentType = String(body.paymentType ?? "CASH").toUpperCase();
    if (!["CASH", "TERM"].includes(paymentType)) {
      throw new BadRequestException("Forma de pagamento inválida.");
    }
    const paymentTerms = paymentType === "TERM" ? String(body.paymentTerms ?? "").trim() : "À vista";
    if (paymentType === "TERM" && !paymentTerms) {
      throw new BadRequestException("Informe a condição de pagamento da venda a prazo.");
    }

    const order = await this.salesOrders.create(body);
    await this.salesOrders.database.$executeRawUnsafe(
      `UPDATE "SalesOrder"
          SET "paymentType"=$2, "paymentTermsSnapshot"=$3, "updatedAt"=NOW()
        WHERE id=$1`,
      order.id,
      paymentType,
      paymentTerms,
    );
    return { ...order, paymentType, paymentTermsSnapshot: paymentTerms };
  }

  @Post(":id/confirm")
  async confirm(@Param("id") id: string) {
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT so.id, so."totalAmount", so."paymentType", so."paymentTermsSnapshot",
              c.id AS "customerId", c.active, c."paymentTerms", c."creditStatus", c."creditLimit"
         FROM "SalesOrder" so
         JOIN "Customer" c ON c.id = so."customerId"
        WHERE so.id=$1`,
      id,
    );
    const context = rows[0];
    if (!context) return this.salesOrders.confirm(id);

    const saleIsTerm = context.paymentType === "TERM"
      || (context.paymentType === "LEGACY" && !isCashTerm(context.paymentTerms));

    if (saleIsTerm) {
      if (!context.active) {
        throw new BadRequestException("Cliente inativo. O pedido não pode ser confirmado.");
      }
      if (context.creditStatus !== "APPROVED") {
        throw new BadRequestException(
          "Venda a prazo bloqueada: o cliente não possui crédito vigente aprovado.",
        );
      }
      const exposureRows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM("openAmount"),0)::numeric AS total
           FROM "AccountsReceivable"
          WHERE "customerId"=$1 AND status NOT IN ('PAID','CANCELLED')`,
        context.customerId,
      );
      const usedCredit = Number(exposureRows[0]?.total ?? 0);
      const creditLimit = Number(context.creditLimit ?? 0);
      const availableCredit = Math.max(0, creditLimit - usedCredit);
      const orderTotal = Number(context.totalAmount ?? 0);
      if (orderTotal > availableCredit) {
        throw new BadRequestException(
          `Venda a prazo bloqueada: pedido de ${orderTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} excede o crédito disponível de ${availableCredit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}.`,
        );
      }
    }

    return this.salesOrders.confirm(id);
  }

  @Post(":id/reserve")
  reserve(
    @Param("id") id: string,
    @Body() body: { warehouseByVariant?: Record<string, string> },
  ) {
    return this.salesOrders.reserve(id, body.warehouseByVariant);
  }

  @Post(":id/cancel")
  cancel(@Param("id") id: string) {
    return this.salesOrders.cancel(id);
  }

  @Post(":id/ship")
  ship(@Param("id") id: string) {
    return this.salesOrders.ship(id);
  }

  @Post(":id/picking")
  picking(@Param("id") id: string) {
    return this.salesOrders.transition(id, "PICKING");
  }

  @Post(":id/ready-to-ship")
  readyToShip(@Param("id") id: string) {
    return this.salesOrders.transition(id, "READY_TO_SHIP");
  }

  @Post(":id/picking/confirm")
  confirmPicking(
    @Param("id") id: string,
    @Body() body: { pickedByItem: Record<string, number> },
  ) {
    return this.salesOrders.confirmPicking(id, body.pickedByItem);
  }

  @Post(":id/invoice")
  async invoice(@Param("id") id: string) {
    const result = await this.salesOrders.transition(id, "INVOICED");
    const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
      `SELECT "paymentType", "paymentTermsSnapshot" FROM "SalesOrder" WHERE id=$1`,
      id,
    );
    const payment = rows[0];
    if (payment && payment.paymentType !== "LEGACY") {
      const days = payment.paymentType === "CASH" ? 0 : termDays(payment.paymentTermsSnapshot);
      await this.salesOrders.database.$executeRawUnsafe(
        `UPDATE "AccountsReceivable"
            SET "dueDate" = "issueDate" + ($2::int * INTERVAL '1 day'), "updatedAt"=NOW()
          WHERE "salesOrderId"=$1`,
        id,
        days,
      );
    }
    return result;
  }
}
