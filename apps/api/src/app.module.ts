import { Module } from "@nestjs/common";
import { DashboardController } from "./dashboard.controller";
import { DashboardService } from "./dashboard.service";
import { BlendsController } from "./blends.controller";
import { HealthController } from "./health.controller";
import { ReceiptsController } from "./receipts.controller";
import { GreenCoffeePurchasesController } from "./green-coffee-purchases.controller";
import { PurchaseAcceptanceController } from "./purchase-acceptance.controller";
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
import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AuthGuard } from "./auth.guard";
import { AdminCoffeeReferenceController } from "./admin-coffee-reference.controller";
import { APP_GUARD } from "@nestjs/core";
import { UnconfiguredTaxRegistryProvider } from "./tax-registry.provider";
import { UnconfiguredStateRegistrationProvider } from "./state-registration.provider";
import { BrokersController } from "./brokers.controller";

@Module({
  controllers: [
    HealthController,
    DashboardController,
    BlendsController,
    ReceiptsController,
    GreenCoffeePurchasesController,
    PurchaseAcceptanceController,
    InventoryController,
    ProductionController,
    ProductsController,
    CostingController,
    SalesOrdersController,
    FinanceController,
    ReconciliationController,
    CommerceController,
    AuthController,
    AdminCoffeeReferenceController,
    BrokersController,
  ],
  providers: [
    DashboardService,
    ProductsService,
    ProductsRepository,
    ProductionService,
    SalesOrdersService,
    CostingService,
    FinanceService,
    ReconciliationService,
    CommerceService,
    AuthService,
    UnconfiguredTaxRegistryProvider,
    UnconfiguredStateRegistrationProvider,
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
})
export class AppModule {}
