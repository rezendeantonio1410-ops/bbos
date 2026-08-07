import { Body, Controller, Get, Param, Post } from "@nestjs/common";
import {
  SalesOrdersService,
  type CreateSalesOrderInput,
} from "./sales-orders.service";

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
  confirm(@Param("id") id: string) {
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
