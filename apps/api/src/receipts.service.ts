import { BadRequestException, Injectable } from '@nestjs/common';
import {
  CoffeeLotStatus,
  CostType,
  EventType,
  LabSampleStatus,
  LabSampleType,
  type Prisma,
  prisma,
} from '@bbos/database';
import type { LotCostBreakdown, ReceiptApproval } from '@bbos/shared';

type ReceiptEntryControls = {
  moisturePercent: number;
  waterActivity: number;
  densityGPerL: number;
  screen: string;
  defects: number;
  approval?: ReceiptApproval;
};

export type CreateReceiptBody = {
  companyId: string;
  supplierId: string;
  warehouseId: string;
  origin: string;
  harvest?: string;
  variety?: string;
  weightKg: number;
  costs: LotCostBreakdown;
  lab?: ReceiptEntryControls;
};

type ReceiptDatabase = Pick<typeof prisma, '$transaction' | 'company' | 'supplier' | 'warehouse'>;

@Injectable()
export class ReceiptsService {
  private readonly database: ReceiptDatabase = prisma;

  async options() {
    const company = await this.database.company.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!company) throw new BadRequestException('Nenhuma empresa está configurada para registrar o recebimento.');
    const [suppliers, warehouses] = await Promise.all([
      this.database.supplier.findMany({ where: { companyId: company.id }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.database.warehouse.findMany({ where: { companyId: company.id }, select: { id: true, code: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { companyId: company.id, suppliers, warehouses };
  }

  create(body: CreateReceiptBody) {
    if (!body.companyId || !body.supplierId || !body.warehouseId) throw new BadRequestException('Empresa, fornecedor e armazém são obrigatórios.');
    if (!Number.isFinite(body.weightKg) || body.weightKg <= 0) throw new BadRequestException('O peso recebido deve ser maior que zero.');

    const totalCost = Object.values(body.costs).reduce((total, value) => total + value, 0);
    const code = `CV-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    const status = body.lab?.approval === 'approved'
      ? CoffeeLotStatus.APPROVED
      : body.lab?.approval === 'rejected'
        ? CoffeeLotStatus.BLOCKED
        : CoffeeLotStatus.QUALITY_REVIEW;
    const costRows = [
      { type: CostType.RAW_MATERIAL, amount: body.costs.coffeeValue, description: 'Valor do café' },
      { type: CostType.FREIGHT, amount: body.costs.freight, description: 'Frete' },
      { type: CostType.TAX, amount: body.costs.nonRecoverableTaxes, description: 'Impostos não recuperáveis' },
      { type: CostType.OTHER, amount: body.costs.unloading, description: 'Descarga' },
      { type: CostType.OTHER, amount: body.costs.initialProcessing, description: 'Beneficiamento inicial' },
      { type: CostType.OTHER, amount: body.costs.otherDirectCosts, description: 'Outros custos diretos' },
    ].filter((row) => row.amount > 0);

    return this.database.$transaction(async (transaction: Prisma.TransactionClient) => {
      const technicalOwner = status === CoffeeLotStatus.QUALITY_REVIEW
        ? await transaction.user.findFirst({
            where: { companyId: body.companyId, active: true },
            select: { id: true },
            orderBy: { createdAt: 'asc' },
          })
        : null;
      if (status === CoffeeLotStatus.QUALITY_REVIEW && !technicalOwner) {
        throw new BadRequestException('Nenhum usuário ativo da empresa está disponível para assumir a amostra de entrada.');
      }

      const lot = await transaction.coffeeLot.create({
        data: {
          companyId: body.companyId,
          supplierId: body.supplierId,
          warehouseId: body.warehouseId,
          code,
          origin: body.origin,
          harvest: body.harvest,
          variety: body.variety,
          initialWeightKg: body.weightKg,
          currentWeightKg: body.weightKg,
          purchaseCost: body.costs.coffeeValue,
          landedCost: totalCost,
          status,
        },
      });
      await transaction.industrialEvent.create({
        data: {
          companyId: body.companyId,
          coffeeLotId: lot.id,
          warehouseId: body.warehouseId,
          type: EventType.RECEIPT,
          quantityKg: body.weightKg,
          metadata: { entryControls: body.lab ?? null, realCostPerKg: totalCost / body.weightKg },
        },
      });
      await transaction.costEvent.createMany({
        data: costRows.map((row) => ({
          companyId: body.companyId,
          coffeeLotId: lot.id,
          type: row.type,
          amount: row.amount,
          quantityBasis: body.weightKg,
          description: row.description,
        })),
      });
      const labSample = technicalOwner
        ? await transaction.labSample.create({
            data: {
              companyId: body.companyId,
              lotId: lot.id,
              sampleCode: `AM-${lot.code}`,
              sampleType: LabSampleType.ENTRY,
              status: LabSampleStatus.PENDING,
              createdById: technicalOwner.id,
              notes: 'Amostra de entrada criada automaticamente no recebimento.',
            },
          })
        : null;

      return {
        lotId: lot.id,
        code: lot.code,
        receivedAt: lot.receivedAt,
        totalCost,
        realCostPerKg: totalCost / body.weightKg,
        status: lot.status,
        labSampleId: labSample?.id ?? null,
        eventsCreated: { industrial: 1, costs: costRows.length },
      };
    });
  }
}
