import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { HealthController } from "./health.controller";
import { ReceiptsController } from "./receipts.controller";
import { InventoryController } from "./inventory.controller";
import { ProductionController } from "./production.controller";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { ProductsRepository } from "./products.repository";
import { CostingController } from "./costing.controller";
import { CostingService } from "./costing.service";
import { ProductionService } from "./production.service";
import { SalesOrdersController } from "./sales-orders.controller";
import { SalesOrdersService } from "./sales-orders.service";
import { FinanceController } from "./finance.controller";
import { FinanceService } from "./finance.service";

@Module({
  controllers: [
    HealthController,
    DashboardController,
    ReceiptsController,
    InventoryController,
    ProductionController,
    ProductsController,
    CostingController,
    SalesOrdersController,
    FinanceController,
  ],
  providers: [ProductsService, ProductsRepository, ProductionService, SalesOrdersService, CostingService, FinanceService],
})
export class AppModule {}
