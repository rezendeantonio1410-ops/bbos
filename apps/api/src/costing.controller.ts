import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  AllocationMethod,
  CostNature,
  CostTariffType,
  CostType,
} from "@bbos/database";
import { CostingService } from "./costing.service";
import { AuthService } from "./auth.service";
import { requireSession } from "./auth-context";

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
  constructor(
    private readonly costing: CostingService,
    private readonly auth: AuthService,
  ) {}

  @Get("summary")
  async summary(@Req() req: Request) {
    return this.costing.summary(
      (await requireSession(req, this.auth)).companyId,
    );
  }

  @Get("cost-centers")
  async listCostCenters(@Req() req: Request) {
    return this.costing.listCostCenters(
      (await requireSession(req, this.auth)).companyId,
    );
  }

  @Get("cost-centers/:id")
  async getCostCenter(@Param("id") id: string, @Req() req: Request) {
    return this.costing.getCostCenter(
      (await requireSession(req, this.auth)).companyId,
      id,
    );
  }

  @Get("resources")
  async listResources(@Req() req: Request) {
    return this.costing.listResources(
      (await requireSession(req, this.auth)).companyId,
    );
  }

  @Get("product-variants/:id")
  async getProductVariantCost(@Param("id") id: string, @Req() req: Request) {
    return this.costing.getProductVariantCost(
      (await requireSession(req, this.auth)).companyId,
      id,
    );
  }

  @Get("sku/:sku")
  async getSkuCost(@Param("sku") sku: string, @Req() req: Request) {
    return this.costing.getLegacySkuCost(
      (await requireSession(req, this.auth)).companyId,
      sku,
    );
  }

  @Post("events")
  async createCostEvent(
    @Body() body: CreateCostEventBody,
    @Req() req: Request,
  ) {
    if (!body.costCenterId)
      throw new BadRequestException("Centro de custo é obrigatório.");
    return this.costing.createCostEvent({
      ...body,
      companyId: (await requireSession(req, this.auth)).companyId,
    });
  }

  @Get("events") async listEvents(@Req() req: Request) {
    return this.costing.listCostEvents(
      (await requireSession(req, this.auth)).companyId,
    );
  }
  @Get("options") async options(@Req() req: Request) {
    return this.costing.options(
      (await requireSession(req, this.auth)).companyId,
    );
  }

  @Get("tariffs") async listTariffs(@Req() req: Request) {
    return this.costing.listTariffs(
      (await requireSession(req, this.auth)).companyId,
    );
  }
  @Post("tariffs") async createTariff(
    @Body()
    body: {
      companyId: string;
      type: CostTariffType;
      name: string;
      unit: string;
      value: number;
      validFrom: string;
      validUntil?: string;
      supplierId?: string;
      costCenterId: string;
      resourceId?: string;
      active?: boolean;
    },
    @Req() req: Request,
  ) {
    return this.costing.createTariff({
      ...body,
      companyId: (await requireSession(req, this.auth)).companyId,
    });
  }

  @Patch("resources/:id") async updateResource(
    @Param("id") id: string,
    @Body() body: Record<string, unknown>,
    @Req() req: Request,
  ) {
    return this.costing.updateResource(
      (await requireSession(req, this.auth)).companyId,
      id,
      body,
    );
  }

  @Get("allocation-rules") async listRules(@Req() req: Request) {
    return this.costing.listAllocationRules(
      (await requireSession(req, this.auth)).companyId,
    );
  }
  @Post("allocation-rules") async createRule(
    @Body()
    body: {
      companyId: string;
      periodId: string;
      costCenterId: string;
      origin: string;
      method: AllocationMethod;
      baseAmount: number;
      destinations: Array<{
        id: string;
        baseValue: number;
        fixedPercentage?: number;
      }>;
    },
    @Req() req: Request,
  ) {
    return this.costing.createAllocationRule({
      ...body,
      companyId: (await requireSession(req, this.auth)).companyId,
    });
  }

  @Get("periods") async listPeriods(@Req() req: Request) {
    return this.costing.listPeriods(
      (await requireSession(req, this.auth)).companyId,
    );
  }
  @Post("periods") async createPeriod(
    @Body()
    body: {
      companyId: string;
      code: string;
      name: string;
      startsAt: string;
      endsAt: string;
    },
    @Req() req: Request,
  ) {
    return this.costing.createPeriod({
      ...body,
      companyId: (await requireSession(req, this.auth)).companyId,
    });
  }
  @Get("periods/:id/preflight") async preflight(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.costing.preflightPeriod(
      (await requireSession(req, this.auth)).companyId,
      id,
    );
  }
  @Post("periods/:id/calculate") async calculate(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.costing.calculatePeriod(
      (await requireSession(req, this.auth)).companyId,
      id,
    );
  }
  @Post("periods/:id/close") async close(
    @Param("id") id: string,
    @Req() req: Request,
  ) {
    return this.costing.closePeriod(
      (await requireSession(req, this.auth)).companyId,
      id,
    );
  }
}
