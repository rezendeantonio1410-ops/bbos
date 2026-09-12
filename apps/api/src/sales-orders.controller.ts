import { BadRequestException, Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  SalesOrdersService,
  type CreateSalesOrderInput,
} from "./sales-orders.service";

const isCashTerm = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return !normalized || normalized === "à vista" || normalized === "a vista";
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
  create(@Body() body: CreateSalesOrderInput) {
    return this.salesOrders.create(body);
  }

  @Post(":id/confirm")
  async confirm(@Param("id") id: string) {
    const order = await this.salesOrders.database.salesOrder.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!order) return this.salesOrders.confirm(id);

    const customer = order.customer;
    if (!isCashTerm(customer.paymentTerms)) {
      if (!customer.active) {
        throw new BadRequestException("Cliente inativo. O pedido não pode ser confirmado.");
      }
      if (customer.creditStatus !== "APPROVED") {
        throw new BadRequestException(
          "Venda a prazo bloqueada: o cliente não possui crédito aprovado.",
        );
      }
      const rows = await this.salesOrders.database.$queryRawUnsafe<any[]>(
        `SELECT COALESCE(SUM("openAmount"),0)::numeric AS total
           FROM "AccountsReceivable"
          WHERE "customerId"=$1 AND status NOT IN ('PAID','CANCELLED')`,
        customer.id,
      );
      const usedCredit = Number(rows[0]?.total ?? 0);
      const creditLimit = Number(customer.creditLimit ?? 0);
      const availableCredit = Math.max(0, creditLimit - usedCredit);
      const orderTotal = Number(order.totalAmount ?? 0);
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
  invoice(@Param("id") id: string) {
    return this.salesOrders.transition(id, "INVOICED");
  }
}
