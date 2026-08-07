import { BadRequestException, Injectable, NotFoundException, type OnModuleDestroy } from "@nestjs/common";
import { AllocationMethod, CostNature, CostTariffType, CostType, Prisma, PrismaClient } from "@bbos/database";
import { allocateCost, assertCostPeriodMutable, calculateMachineHourCost, evaluateClosingReadiness, validateCostPeriod } from "@bbos/shared";

type CostEventInput = {
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

@Injectable()
export class CostingService implements OnModuleDestroy {
  readonly database = new PrismaClient();

  onModuleDestroy() { return this.database.$disconnect(); }

  private async defaultCompanyId() {
    const company = await this.database.company.findFirst({ orderBy: { createdAt: "asc" } });
    if (!company) throw new BadRequestException("Empresa não configurada.");
    return company.id;
  }

  async summary() {
    const period = await this.database.allocationPeriod.findFirst({ orderBy: { startsAt: "desc" } });
    const range = period ? { occurredAt: { gte: period.startsAt, lte: period.endsAt } } : {};
    const events = await this.database.costEvent.findMany({ where: range, include: { costCenter: true } });
    const snapshots = await this.database.costCalculationSnapshot.findMany({
      where: period ? { periodCode: period.code } : {},
      include: { productVariant: { include: { product: { include: { productLine: true } } } } },
      orderBy: { createdAt: "desc" },
    });
    const variants = await this.database.productVariant.findMany({
      where: { active: true },
      include: {
        product: { include: { productLine: true } },
        costSnapshots: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { sku: "asc" },
    });
    const amount = (predicate: (event: (typeof events)[number]) => boolean) =>
      events.filter(predicate).reduce((sum, event) => sum + Number(event.amount), 0);
    const industrialCost = snapshots.reduce((sum, item) => sum + Number(item.industrialCost), 0);
    const producedKg = snapshots.reduce((sum, item) => {
      const composition = item.composition as Record<string, unknown>;
      return sum + Number(composition.goodOutputKg ?? 0);
    }, 0);
    const totalBudget = await this.database.costCenter.aggregate({ _sum: { monthlyBudget: true }, where: { active: true } });
    const totalActual = events.reduce((sum, event) => sum + Number(event.amount), 0);
    const byNature = (Object.values(CostNature) as CostNature[]).map((nature) => ({
      nature,
      amount: amount((event) => event.nature === nature),
    }));
    return {
      period: period?.code ?? null,
      periodStatus: period?.status ?? "OPEN",
      source: "database",
      metrics: {
        industrialCost,
        averageCostPerKg: producedKg > 0 ? industrialCost / producedKg : 0,
        energy: amount((event) => event.type === CostType.ENERGY),
        gas: amount((event) => event.type === CostType.GAS),
        maintenance: amount((event) => event.type === CostType.MAINTENANCE),
        budgetVariance: totalActual - Number(totalBudget._sum.monthlyBudget ?? 0),
      },
      byNature,
      products: variants.map((variant) => {
        const latest = variant.costSnapshots[0];
        return {
          productVariantId: variant.id,
          sku: variant.sku,
          product: variant.product.name,
          line: variant.product.productLine.name,
          presentationGrams: variant.netWeightGrams,
          status: latest ? "CALCULATED" : "PENDING_REAL_DATA",
          industrialCost: Number(latest?.industrialCost ?? 0),
          costPerUnit: Number(latest?.costPerUnit ?? 0),
          costPerKg: Number(latest?.costPerKg ?? 0),
        };
      }),
    };
  }

  async listCostCenters() {
    const centers = await this.database.costCenter.findMany({
      include: { costEvents: true, resources: true, allocationRules: { include: { period: true }, orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: [{ category: "asc" }, { code: "asc" }],
    });
    return centers.map((center) => {
      const actual = center.costEvents.reduce((sum, event) => sum + Number(event.amount), 0);
      const budget = Number(center.monthlyBudget);
      return {
        id: center.id,
        code: center.code,
        name: center.name,
        category: center.category,
        description: center.description,
        allocationMethod: center.allocationMethod,
        actual,
        budget,
        variance: actual - budget,
        active: center.active,
        resources: center.resources.length,
        periodStatus: center.allocationRules[0]?.period.status ?? "OPEN",
      };
    });
  }

  async getCostCenter(id: string) {
    const center = await this.database.costCenter.findUnique({
      where: { id },
      include: {
        costEvents: { include: { productionOrder: true, productVariant: true, allocationRule: true }, orderBy: { occurredAt: "desc" } },
        resources: true,
        allocationRules: { include: { period: true }, orderBy: { createdAt: "desc" } },
      },
    });
    if (!center) throw new NotFoundException("Centro de custo não encontrado.");
    return center;
  }

  async listResources() {
    const resources = await this.database.productiveResource.findMany({ include: { costCenter: true, productionUsages: true }, orderBy: { code: "asc" } });
    return resources.map((resource) => {
      const input = {
        purchaseValue: Number(resource.purchaseValue),
        residualValue: Number(resource.residualValue),
        usefulLifeMonths: resource.usefulLifeMonths,
        expectedProductiveHoursPerMonth: Number(resource.expectedProductiveHours),
        maintenanceCostEstimatePerMonth: Number(resource.maintenanceCostEstimate),
        energyConsumptionKwhPerHour: Number(resource.energyConsumption),
        energyRatePerKwh: Number(resource.energyRatePerKwh),
        gasConsumptionPerHour: Number(resource.gasConsumption),
        gasRatePerUnit: Number(resource.gasRatePerUnit),
        otherHourlyCosts: Number(resource.otherHourlyCost),
      };
      return {
        id: resource.id,
        code: resource.code,
        name: resource.name,
        costCenter: resource.costCenter.name,
        costCenterId: resource.costCenterId,
        active: resource.active,
        usageHours: resource.productionUsages.reduce((sum, usage) => sum + Number(usage.machineHours), 0),
        input,
        cost: calculateMachineHourCost(input),
      };
    });
  }

  async getProductVariantCost(id: string) {
    const variant = await this.database.productVariant.findUnique({
      where: { id },
      include: {
        product: { include: { productLine: true } },
        costSnapshots: { include: { productionOrder: true }, orderBy: { createdAt: "desc" } },
        costEvents: { include: { costCenter: true, productionOrder: true, allocationRule: true }, orderBy: { occurredAt: "desc" } },
        productionOrders: {
          include: {
            costSnapshots: true,
            costEvents: { include: { costCenter: true, productionOrder: true, allocationRule: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });
    if (!variant) throw new NotFoundException("ProductVariant não encontrado.");
    const latest = variant.costSnapshots[0] ?? variant.productionOrders.flatMap((order) => order.costSnapshots)[0] ?? null;
    const linkedEvents = Array.from(
      new Map(
        [...variant.costEvents, ...variant.productionOrders.flatMap((order) => order.costEvents)]
          .map((event) => [event.id, event]),
      ).values(),
    );
    return {
      productVariantId: variant.id,
      sku: variant.sku,
      presentationGrams: variant.netWeightGrams,
      salesUnit: variant.salesUnit,
      product: variant.product.name,
      line: variant.product.productLine.name,
      active: variant.active,
      status: latest ? "CALCULATED" : "PENDING_REAL_DATA",
      snapshot: latest
        ? {
            ...latest,
            directCost: Number(latest.directCost),
            industrialCost: Number(latest.industrialCost),
            corporateAllocation: Number(latest.corporateAllocation),
            absorbedCost: Number(latest.absorbedCost),
            costPerUnit: Number(latest.costPerUnit),
            costPerKg: Number(latest.costPerKg),
          }
        : null,
      events: linkedEvents.map((event) => ({
        id: event.id,
        type: event.type,
        nature: event.nature,
        amount: Number(event.amount),
        description: event.description,
        occurredAt: event.occurredAt,
        costCenter: event.costCenter ? { id: event.costCenter.id, code: event.costCenter.code, name: event.costCenter.name } : null,
        productionOrder: event.productionOrder ? { id: event.productionOrder.id, code: event.productionOrder.code } : null,
        allocationRuleId: event.allocationRuleId,
      })),
    };
  }

  async getLegacySkuCost(sku: string) {
    const variant = await this.database.productVariant.findUnique({ where: { sku } });
    if (!variant) throw new NotFoundException("SKU não encontrado.");
    return this.getProductVariantCost(variant.id);
  }

  async createCostEvent(input: CostEventInput) {
    if (!Number.isFinite(input.amount) || input.amount < 0 || !input.description.trim())
      throw new BadRequestException("Valor e descrição do custo são obrigatórios.");
    return this.database.$transaction(async (transaction) => {
      const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
      const competenceAt = input.competenceAt ? new Date(input.competenceAt) : occurredAt;
      const closedPeriod = await transaction.allocationPeriod.findFirst({
        where: { companyId: input.companyId, status: "CLOSED", startsAt: { lte: competenceAt }, endsAt: { gte: competenceAt } },
      });
      if (closedPeriod) throw new BadRequestException("A competência pertence a um período fechado e imutável.");
      const center = await transaction.costCenter.findFirst({ where: { id: input.costCenterId, companyId: input.companyId, active: true } });
      if (!center) throw new BadRequestException("Centro de custo ativo não encontrado.");
      if (input.productVariantId) {
        const variant = await transaction.productVariant.findUnique({ where: { id: input.productVariantId }, include: { product: { include: { productLine: true } } } });
        if (!variant || variant.product.productLine.companyId !== input.companyId)
          throw new BadRequestException("ProductVariant não pertence à empresa.");
      }
      if (input.productionOrderId) {
        const order = await transaction.productionOrder.findUnique({ where: { id: input.productionOrderId } });
        if (!order || order.companyId !== input.companyId)
          throw new BadRequestException("Ordem de Produção não pertence à empresa.");
        if (input.productVariantId && order.productVariantId && order.productVariantId !== input.productVariantId)
          throw new BadRequestException("ProductVariant não corresponde à OP.");
      }
      return transaction.costEvent.create({
        data: {
          companyId: input.companyId,
          costCenterId: input.costCenterId,
          productionOrderId: input.productionOrderId,
          productVariantId: input.productVariantId,
          type: input.type,
          nature: input.nature,
          amount: input.amount,
          quantityBasis: input.quantityBasis,
          unit: input.unit,
          supplierId: input.supplierId,
          resourceId: input.resourceId,
          competenceAt,
          occurredAt,
          notes: input.notes,
          description: input.description,
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async options() {
    const companyId = await this.defaultCompanyId();
    const [centers, suppliers, resources, orders, variants] = await Promise.all([
      this.database.costCenter.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
      this.database.supplier.findMany({ where: { companyId }, orderBy: { name: "asc" } }),
      this.database.productiveResource.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }),
      this.database.productionOrder.findMany({ where: { companyId }, select: { id: true, code: true, productVariantId: true }, orderBy: { createdAt: "desc" }, take: 100 }),
      this.database.productVariant.findMany({ where: { active: true, product: { active: true, productLine: { companyId, active: true } } }, include: { product: { include: { productLine: true } } }, orderBy: { sku: "asc" } }),
    ]);
    return { companyId, centers, suppliers, resources, orders, variants: variants.map((v) => ({ id: v.id, sku: v.sku, name: v.product.name, line: v.product.productLine.name, grams: v.netWeightGrams })) };
  }

  async listCostEvents() {
    return this.database.costEvent.findMany({ include: { costCenter: true, supplier: true, resource: true, productionOrder: true, productVariant: { include: { product: true } } }, orderBy: { occurredAt: "desc" }, take: 250 });
  }

  async listTariffs() {
    return this.database.costTariff.findMany({ include: { costCenter: true, supplier: true, resource: true }, orderBy: [{ type: "asc" }, { validFrom: "desc" }] });
  }

  async createTariff(input: { companyId: string; type: CostTariffType; name: string; unit: string; value: number; validFrom: string; validUntil?: string; supplierId?: string; costCenterId: string; resourceId?: string; active?: boolean }) {
    if (!Number.isFinite(input.value) || input.value <= 0) throw new BadRequestException("Valor da tarifa deve ser maior que zero.");
    const validFrom = new Date(input.validFrom);
    const validUntil = input.validUntil ? new Date(input.validUntil) : undefined;
    if (validUntil && validUntil < validFrom) throw new BadRequestException("Fim da vigência não pode anteceder o início.");
    return this.database.$transaction(async (tx) => {
      const center = await tx.costCenter.findFirst({ where: { id: input.costCenterId, companyId: input.companyId, active: true } });
      if (!center) throw new BadRequestException("Centro de custo inválido.");
      if (input.active !== false) {
        await tx.costTariff.updateMany({
          where: { companyId: input.companyId, type: input.type, unit: input.unit, costCenterId: input.costCenterId, active: true, validFrom: { lt: validFrom } },
          data: { active: false, validUntil: new Date(validFrom.getTime() - 1) },
        });
      }
      return tx.costTariff.create({ data: { ...input, validFrom, validUntil, active: input.active !== false } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateResource(id: string, raw: Record<string, unknown>) {
    const current = await this.database.productiveResource.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Máquina ou equipamento não encontrado.");
    const period = await this.database.allocationPeriod.findFirst({ where: { companyId: current.companyId, status: "CLOSED", endsAt: { gte: current.createdAt } } });
    if (period && raw.code && raw.code !== current.code) throw new BadRequestException("Código histórico do recurso não pode ser alterado após fechamento.");
    const numeric = ["purchaseValue", "residualValue", "expectedProductiveHours", "maintenanceCostEstimate", "energyConsumption", "energyRatePerKwh", "gasConsumption", "gasRatePerUnit", "otherHourlyCost"];
    const data: Record<string, unknown> = {};
    for (const key of numeric) if (raw[key] !== undefined) {
      const value = Number(raw[key]);
      if (!Number.isFinite(value) || value < 0) throw new BadRequestException(`${key} inválido.`);
      data[key] = value;
    }
    for (const key of ["name", "code", "costCenterId", "active"]) if (raw[key] !== undefined) data[key] = raw[key];
    if (raw.usefulLifeMonths !== undefined) data.usefulLifeMonths = Number(raw.usefulLifeMonths);
    return this.database.productiveResource.update({ where: { id }, data });
  }

  async listAllocationRules() {
    return this.database.allocationRule.findMany({ include: { costCenter: true, period: true }, orderBy: { createdAt: "desc" } });
  }

  async createAllocationRule(input: { companyId: string; periodId: string; costCenterId: string; origin: string; method: AllocationMethod; baseAmount: number; destinations: Array<{ id: string; baseValue: number; fixedPercentage?: number }> }) {
    const period = await this.database.allocationPeriod.findFirst({ where: { id: input.periodId, companyId: input.companyId } });
    if (!period) throw new BadRequestException("Período não encontrado.");
    assertCostPeriodMutable(period.status as "OPEN" | "CALCULATING" | "REVIEW" | "CLOSED");
    const results = allocateCost(input.baseAmount, input.method, input.destinations);
    return this.database.allocationRule.create({ data: { companyId: input.companyId, periodId: input.periodId, costCenterId: input.costCenterId, origin: input.origin, method: input.method, baseAmount: input.baseAmount, destinations: input.destinations, results, status: "ACTIVE" } });
  }

  async listPeriods() {
    return this.database.allocationPeriod.findMany({ include: { rules: true, snapshots: true }, orderBy: { startsAt: "desc" } });
  }

  async createPeriod(input: { companyId: string; code: string; name: string; startsAt: string; endsAt: string }) {
    const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
    validateCostPeriod({ startsAt, endsAt });
    const overlap = await this.database.allocationPeriod.findFirst({ where: { companyId: input.companyId, startsAt: { lte: endsAt }, endsAt: { gte: startsAt } } });
    if (overlap) throw new BadRequestException("Já existe um período de custos sobreposto.");
    return this.database.allocationPeriod.create({ data: { ...input, startsAt, endsAt } });
  }

  async preflightPeriod(id: string) {
    const period = await this.database.allocationPeriod.findUnique({ where: { id } });
    if (!period) throw new NotFoundException("Período não encontrado.");
    const range = { gte: period.startsAt, lte: period.endsAt };
    const [withoutCenter, events, resources, orders, variants, rules] = await Promise.all([
      this.database.costEvent.count({ where: { companyId: period.companyId, competenceAt: range, costCenterId: null } }),
      this.database.costEvent.findMany({ where: { companyId: period.companyId, competenceAt: range } }),
      this.database.productiveResource.findMany({ where: { companyId: period.companyId, active: true } }),
      this.database.productionOrder.findMany({ where: { companyId: period.companyId, completedAt: range, status: "COMPLETED" }, include: { resourceUsages: true, finishedGoodsMovements: { where: { type: "PRODUCTION_IN" } } } }),
      this.database.productVariant.count({ where: { active: true, product: { productLine: { companyId: period.companyId } } } }),
      this.database.allocationRule.findMany({ where: { periodId: id, status: { in: ["ACTIVE", "APPLIED"] } } }),
    ]);
    const needsEnergy = events.some((e) => e.type === "ENERGY");
    const needsGas = events.some((e) => e.type === "GAS");
    const tariffCount = await this.database.costTariff.count({ where: { companyId: period.companyId, active: true, validFrom: { lte: period.endsAt }, OR: [{ validUntil: null }, { validUntil: { gte: period.startsAt } }] } });
    const missingTariffs = (needsEnergy || needsGas) && tariffCount === 0 ? 1 : 0;
    const unallocated = events.filter((e) => e.nature !== "DIRECT" && !e.productionOrderId && !e.allocationRuleId).length;
    const machinesWithoutParameters = resources.filter((r) => r.purchaseValue.gt(0) && (r.usefulLifeMonths <= 0 || r.expectedProductiveHours.lte(0))).length;
    const ordersWithoutUsage = orders.filter((o) => o.resourceUsages.length === 0).length;
    const producedVariantIds = new Set(orders.map((o) => o.productVariantId).filter(Boolean));
    const productsWithoutCost = orders.filter((o) => !o.productVariantId || !o.actualOutputKg || o.actualOutputKg.lte(0) || o.finishedGoodsMovements.reduce((sum, movement) => sum + movement.packageQuantity, 0) <= 0 || !events.some((e) => e.productionOrderId === o.id)).length;
    const issues = evaluateClosingReadiness({ costsWithoutCenter: withoutCenter, missingTariffs, machinesWithoutParameters, ordersWithoutUsage, unallocatedCosts: unallocated, productsWithoutCost });
    return { period, counts: { events: events.length, orders: orders.length, variants, producedVariants: producedVariantIds.size, rules: rules.length }, issues, canClose: !issues.some((issue) => issue.severity === "CRITICAL") };
  }

  async calculatePeriod(id: string) {
    const preflight = await this.preflightPeriod(id);
    assertCostPeriodMutable(preflight.period.status as "OPEN" | "CALCULATING" | "REVIEW" | "CLOSED");
    if (preflight.issues.some((issue) => issue.severity === "CRITICAL"))
      throw new BadRequestException({ message: "Corrija as inconsistências críticas antes de calcular.", issues: preflight.issues });
    return this.database.$transaction(async (tx) => {
      await tx.allocationPeriod.update({ where: { id }, data: { status: "CALCULATING" } });
      const orders = await tx.productionOrder.findMany({
        where: { companyId: preflight.period.companyId, status: "COMPLETED", completedAt: { gte: preflight.period.startsAt, lte: preflight.period.endsAt }, productVariantId: { not: null } },
        include: { costEvents: true, finishedGoodsMovements: { where: { type: "PRODUCTION_IN" } } },
      });
      for (const order of orders) {
        const existing = await tx.costCalculationSnapshot.findFirst({ where: { periodId: id, productionOrderId: order.id } });
        if (existing) continue;
        const directCost = order.costEvents.filter((e) => e.nature === "DIRECT").reduce((sum, e) => sum + Number(e.amount), 0);
        const indirectCost = order.costEvents.filter((e) => e.nature === "INDIRECT_INDUSTRIAL").reduce((sum, e) => sum + Number(e.amount), 0);
        const corporate = order.costEvents.filter((e) => e.nature === "CORPORATE").reduce((sum, e) => sum + Number(e.amount), 0);
        const industrialCost = directCost + indirectCost;
        const absorbedCost = industrialCost + corporate;
        const goodKg = Number(order.actualOutputKg ?? 0);
        const goodUnits = order.finishedGoodsMovements.reduce((sum, movement) => sum + movement.packageQuantity, 0);
        const byType = Object.fromEntries(Object.values(CostType).map((type) => [type, order.costEvents.filter((e) => e.type === type).reduce((sum, e) => sum + Number(e.amount), 0)]));
        await tx.costCalculationSnapshot.create({ data: {
          companyId: order.companyId, productionOrderId: order.id, productVariantId: order.productVariantId!, periodId: id,
          periodCode: preflight.period.code, calculationVersion: "cost-engine-v1.1", directCost, industrialCost, corporateAllocation: corporate, absorbedCost,
          costPerUnit: industrialCost / goodUnits, costPerKg: industrialCost / goodKg, absorbedCostPerUnit: absorbedCost / goodUnits, absorbedCostPerKg: absorbedCost / goodKg,
          composition: { byType, goodOutputKg: goodKg, goodUnits, eventIds: order.costEvents.map((e) => e.id) },
          sourceIds: order.costEvents.map((e) => e.id),
        } });
      }
      return tx.allocationPeriod.update({ where: { id }, data: { status: "REVIEW", calculatedAt: new Date() }, include: { snapshots: true, rules: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async closePeriod(id: string) {
    const preflight = await this.preflightPeriod(id);
    if (preflight.period.status === "CLOSED") throw new BadRequestException("Período já fechado e imutável.");
    if (preflight.period.status !== "REVIEW") throw new BadRequestException("Calcule e revise o período antes de fechar.");
    if (!preflight.canClose) throw new BadRequestException({ message: "Existem inconsistências críticas.", issues: preflight.issues });
    return this.database.$transaction(async (tx) => {
      const locked = await tx.allocationPeriod.updateMany({ where: { id, status: "REVIEW" }, data: { status: "CLOSED", closedAt: new Date() } });
      if (locked.count !== 1) throw new BadRequestException("Período foi alterado por outro processo.");
      await tx.allocationRule.updateMany({ where: { periodId: id, status: "ACTIVE" }, data: { status: "APPLIED", appliedAt: new Date() } });
      return tx.allocationPeriod.findUnique({ where: { id }, include: { rules: true, snapshots: true } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
