import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { join } from "node:path";
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
import { ReconciliationController } from "./reconciliation.controller";
import { ReconciliationService } from "./reconciliation.service";
import { CommerceController } from "./commerce.controller";
import { CommerceService } from "./commerce.service";
import { LaboratoryController } from "./laboratory.controller";
import { LaboratoryService } from "./laboratory.service";
import { CommercialController } from "./commercial.controller";
import { CommercialService } from "./commercial.service";
import { CommercialPriceService } from "./commercial-price.service";
import { LocalDocumentStorageProvider } from "./document-storage";
import { SalesNextActionService } from "./sales-next-action.service";
import { CuppingMobileController } from "./cupping-mobile.controller";
import { CuppingMobileService } from "./cupping-mobile.service";
import { CuppingInvitationDeliveryService } from "./cupping-invitation-delivery.service";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: join(__dirname, "../../../.env"),
    }),
  ],
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
    ReconciliationController,
    CommerceController,
    LaboratoryController,
    CommercialController,
    CuppingMobileController,
  ],
  providers: [ProductsService, ProductsRepository, ProductionService, SalesOrdersService, CostingService, FinanceService, ReconciliationService, CommerceService, LaboratoryService, CommercialService, CommercialPriceService, LocalDocumentStorageProvider, SalesNextActionService, CuppingMobileService, CuppingInvitationDeliveryService],
})
export class AppModule {}
