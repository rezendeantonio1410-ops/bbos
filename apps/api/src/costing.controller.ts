import { BadRequestException, Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { AllocationMethod, CostNature, CostTariffType, CostType } from "@bbos/database";
import { CostingService } from "./costing.service";

type CreateCostEventBody = {
  companyId: string;
  costCenterId: string;
  productionOrderId?: string;
  productVariantId?: string;
  type: CostType;
  nature: CostNature;
  amount: number;
  quantityBasis?: number;
  unit?: string;
  supplierId?: string;
  resourceId?: string;
  competenceAt?: string;
  occurredAt?: string;
  notes?: string;
  description: string;
};

@Controller("costing")
export class CostingController {
  constructor(private readonly costing: CostingService) {}

  @Get("summary")
  summary() { return this.costing.summary(); }

  @Get("cost-centers")
  listCostCenters() { return this.costing.listCostCenters(); }

  @Get("cost-centers/:id")
  getCostCenter(@Param("id") id: string) { return this.costing.getCostCenter(id); }

  @Get("resources")
  listResources() { return this.costing.listResources(); }

  @Get("product-variants/:id")
  getProductVariantCost(@Param("id") id: string) { return this.costing.getProductVariantCost(id); }

  @Get("sku/:sku")
  getSkuCost(@Param("sku") sku: string) { return this.costing.getLegacySkuCost(sku); }

  @Post("events")
  createCostEvent(@Body() body: CreateCostEventBody) {
    if (!body.costCenterId)
      throw new BadRequestException("Centro de custo é obrigatório.");
    return this.costing.createCostEvent(body);
  }

  @Get("events") listEvents() { return this.costing.listCostEvents(); }
  @Get("options") options() { return this.costing.options(); }

  @Get("tariffs") listTariffs() { return this.costing.listTariffs(); }
  @Post("tariffs") createTariff(@Body() body: { companyId: string; type: CostTariffType; name: string; unit: string; value: number; validFrom: string; validUntil?: string; supplierId?: string; costCenterId: string; resourceId?: string; active?: boolean }) { return this.costing.createTariff(body); }

  @Patch("resources/:id") updateResource(@Param("id") id: string, @Body() body: Record<string, unknown>) { return this.costing.updateResource(id, body); }

  @Get("allocation-rules") listRules() { return this.costing.listAllocationRules(); }
  @Post("allocation-rules") createRule(@Body() body: { companyId: string; periodId: string; costCenterId: string; origin: string; method: AllocationMethod; baseAmount: number; destinations: Array<{ id: string; baseValue: number; fixedPercentage?: number }> }) { return this.costing.createAllocationRule(body); }

  @Get("periods") listPeriods() { return this.costing.listPeriods(); }
  @Post("periods") createPeriod(@Body() body: { companyId: string; code: string; name: string; startsAt: string; endsAt: string }) { return this.costing.createPeriod(body); }
  @Get("periods/:id/preflight") preflight(@Param("id") id: string) { return this.costing.preflightPeriod(id); }
  @Post("periods/:id/calculate") calculate(@Param("id") id: string) { return this.costing.calculatePeriod(id); }
  @Post("periods/:id/close") close(@Param("id") id: string) { return this.costing.closePeriod(id); }
}
