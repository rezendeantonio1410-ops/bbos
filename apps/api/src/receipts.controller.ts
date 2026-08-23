import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
  CoffeeLotStatus,
  CostType,
  EventType,
  GreenCoffeeQualityStatus,
  ProfessionalSampleSource,
  ProfessionalSampleStatus,
  Prisma,
  PrismaClient,
} from "@bbos/database";
import { AuthService } from "./auth.service";
import { assertCompany, requireSession } from "./auth-context";
import { calculateWeightVariance } from "./receipts-weight";
import { compareQuality } from "./lab-quality";

type ConfirmReceiptBody = {
  companyId: string;
  supplierId: string;
  warehouseId: string;
  idempotencyKey: string;
  purchaseId: string;
  responsibleUserId: string;
  responsibleName: string;
  species: "ARABICA" | "ROBUSTA_CONILON";
  origin: string;
  farmName?: string;
  municipality?: string;
  state?: string;
  country?: string;
  harvest?: string;
  variety?: string;
  process?: string;
  supplierLotCode?: string;
  invoiceNumber?: string;
  transportDocument?: string;
  purchaseOrderNumber?: string;
  notes?: string;
  unit: "KG" | "BAG";
  bagQuantity?: number;
  bagWeightKg?: number;
  packagingType?: "BAG_30_KG" | "BAG_60_KG" | "BIG_BAG" | "OTHER";
  volumeQuantity?: number;
  nominalWeightKg?: number;
  grossWeightKg: number;
  tareWeightKg?: number;
  netWeightKg: number;
  qualityStatus?: GreenCoffeeQualityStatus;
  moisturePercent?: number;
  screen?: string;
  defects?: number;
  classification?: string;
  qualityNotes?: string;
  purchaseCost?: number;
};

const lotStatusFor = (quality: GreenCoffeeQualityStatus): CoffeeLotStatus => {
  if (
    quality === GreenCoffeeQualityStatus.APPROVED ||
    quality === GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION
  )
    return CoffeeLotStatus.APPROVED;
  if (
    quality === GreenCoffeeQualityStatus.REJECTED ||
    quality === GreenCoffeeQualityStatus.BLOCKED
  )
    return CoffeeLotStatus.BLOCKED;
  return CoffeeLotStatus.QUALITY_REVIEW;
};

@Controller("receipts")
export class ReceiptsController {
  private readonly database = new PrismaClient();
  constructor(private readonly auth: AuthService) {}

  @Get("lab-samples")
  async listLabSamples(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const samples = await this.database.greenCoffeeLabSample.findMany({
      where: { receipt: { companyId: actor.companyId } },
      include: { receipt: { include: { supplier: true, coffeeLot: true, purchase: true } } },
      orderBy: { createdAt: "asc" },
    });
    return samples.map((sample) => this.labSampleView(sample));
  }

  @Get("lab-samples/:id")
  async getLabSample(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const sample = await this.database.greenCoffeeLabSample.findFirst({
      where: { id, receipt: { companyId: actor.companyId } },
      include: { receipt: { include: { supplier: true, coffeeLot: true, purchase: true } } },
    });
    if (!sample) throw new NotFoundException("Amostra não encontrada.");
    return this.labSampleView(sample);
  }

  @Patch("lab-samples/:id/analysis")
  async completeLabAnalysis(
    @Param("id") id: string,
    @Body() body: { qualityStatus: GreenCoffeeQualityStatus; moisturePercent?: number; defects?: number; screen?: string; score?: number; notes?: string },
    @Req() req: Request,
  ) {
    const actor = await requireSession(req, this.auth);
    if (!Object.values(GreenCoffeeQualityStatus).includes(body.qualityStatus))
      throw new BadRequestException("Escolha uma decisão de qualidade válida.");
    if (body.qualityStatus === GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION && !body.notes?.trim())
      throw new BadRequestException("Informe a ressalva da aprovação.");
    return this.database.$transaction(async (transaction) => {
      const sample = await transaction.greenCoffeeLabSample.findFirst({
        where: { id, receipt: { companyId: actor.companyId } },
        include: { receipt: { include: { purchase: true } } },
      });
      if (!sample) throw new NotFoundException("Amostra não encontrada.");
      if (
        sample.receipt.approvalStatus === "PENDING" &&
        (body.qualityStatus === GreenCoffeeQualityStatus.APPROVED || body.qualityStatus === GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION)
      )
        throw new BadRequestException("A divergência precisa ser aprovada antes da liberação do lote.");
      const updated = await transaction.greenCoffeeReceipt.update({
        where: { id: sample.receiptId },
        data: { qualityStatus: body.qualityStatus, moisturePercent: body.moisturePercent, defects: body.defects, screen: body.screen, qualityNotes: body.notes },
      });
      await transaction.greenCoffeeLabSample.update({
        where: { id: sample.id },
        data: { status: body.qualityStatus === GreenCoffeeQualityStatus.REJECTED ? "REJECTED" : "COMPLETED" },
      });
      await transaction.coffeeLot.update({
        where: { id: sample.receipt.coffeeLotId },
        data: { status: lotStatusFor(body.qualityStatus), qualityScore: body.score },
      });
      await transaction.industrialEvent.create({
        data: { companyId: actor.companyId, coffeeLotId: sample.receipt.coffeeLotId, warehouseId: sample.receipt.warehouseId, type: EventType.QUALITY_TEST, metadata: { receiptId: sample.receiptId, sampleId: sample.id, qualityStatus: body.qualityStatus, moisturePercent: body.moisturePercent ?? null, defects: body.defects ?? null, screen: body.screen ?? null, score: body.score ?? null, notes: body.notes ?? null, userId: actor.id, userName: actor.name } },
      });
      await transaction.greenCoffeeAuditEvent.create({
        data: { companyId: actor.companyId, purchaseId: sample.receipt.purchaseId, receiptId: sample.receiptId, action: "LAB_ANALYSIS_COMPLETED", actorId: actor.id, actorName: actor.name, metadata: { sampleId: sample.id, qualityStatus: body.qualityStatus, moisturePercent: body.moisturePercent ?? null, defects: body.defects ?? null, score: body.score ?? null, screen: body.screen ?? null, notes: body.notes ?? null } },
      });
      return { sampleId: sample.id, receiptId: updated.id, qualityStatus: updated.qualityStatus, productionAvailable: lotStatusFor(updated.qualityStatus) === CoffeeLotStatus.APPROVED };
    });
  }
  @Get("options")
  async options(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const company = await this.database.company.findUnique({ where: { id: actor.companyId } });
    if (!company)
      return { company: null, suppliers: [], warehouses: [], users: [] };
    const [suppliers, warehouses, users, purchases] = await Promise.all([
      this.database.supplier.findMany({
        where: { companyId: company.id },
        orderBy: { name: "asc" },
      }),
      this.database.warehouse.findMany({
        where: { companyId: company.id },
        orderBy: { name: "asc" },
      }),
      this.database.user.findMany({
        where: { companyId: company.id, active: true },
        select: { id: true, name: true, role: true },
        orderBy: { name: "asc" },
      }),
      this.database.greenCoffeePurchase.findMany({
        where: {
          companyId: company.id,
          status: { in: ["CONFIRMED", "PARTIALLY_RECEIVED"] },
          approvalStatus: "APPROVED",
          externalAcceptanceStatus: "ACCEPTED",
          operationalStatus: {
            in: ["AWAITING_DELIVERY", "PARTIALLY_RECEIVED"],
          },
        },
        include: {
          supplier: true,
          receipts: { select: { netWeightKg: true } },
        },
        orderBy: { purchasedAt: "desc" },
      }),
    ]);
    const eligiblePurchases = purchases
      .map((purchase) => {
        const receivedKg = purchase.receipts.reduce(
          (sum, receipt) => sum + Number(receipt.netWeightKg),
          0,
        );
        return {
          ...purchase,
          receivedKg,
          balanceKg: Number(purchase.contractedWeightKg) - receivedKg,
        };
      })
      .filter((purchase) => purchase.balanceKg > 0);
    return {
      company,
      suppliers,
      warehouses,
      users,
      purchases: eligiblePurchases,
    };
  }

  @Get()
  async list(@Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const rows = await this.database.greenCoffeeReceipt.findMany({
      where: { companyId: actor.companyId },
      include: {
        supplier: true,
        warehouse: true,
        labSample: { select: { sampleNumber: true, status: true } },
        coffeeLot: {
          include: { industrialEvents: { orderBy: { occurredAt: "desc" } } },
        },
      },
      orderBy: { confirmedAt: "desc" },
      take: 100,
    });
    return rows.map((row) => ({
      ...row,
      stockBalanceKg: row.coffeeLot.industrialEvents.reduce((sum, event) => {
        const movement = (event.metadata as { movementType?: string } | null)
          ?.movementType;
        const quantity = Number(event.quantityKg ?? 0);
        return (
          sum +
          (event.type === EventType.RECEIPT || movement === "entry"
            ? quantity
            : movement === "exit"
              ? -quantity
              : 0)
        );
      }, 0),
    }));
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const receipt = await this.database.greenCoffeeReceipt.findUnique({
      where: { id, companyId: actor.companyId },
      include: {
        supplier: true,
        warehouse: true,
        coffeeLot: {
          include: {
            industrialEvents: { orderBy: { occurredAt: "asc" } },
            costEvents: true,
          },
        },
      },
    });
    if (!receipt) throw new NotFoundException("Recebimento não encontrado.");
    return receipt;
  }

  @Post()
  async confirm(@Body() body: ConfirmReceiptBody, @Req() req: Request) {
    const actor = await requireSession(req, this.auth);
    const companyId = assertCompany(actor, body.companyId);
    body.companyId = companyId;
    body.responsibleUserId = actor.id;
    body.responsibleName = actor.name;
    this.validate(body);
    const existing = await this.database.greenCoffeeReceipt.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
      include: { coffeeLot: true },
    });
    if (existing)
      return {
        receiptId: existing.id,
        receiptNumber: existing.receiptNumber,
        lotId: existing.coffeeLotId,
        lotCode: existing.coffeeLot.code,
        status: existing.qualityStatus,
        duplicate: true,
      };
    return this.database.$transaction(
      async (transaction) => {
        const [supplier, warehouse, purchase] = await Promise.all([
          transaction.supplier.findFirst({
            where: { id: body.supplierId, companyId: body.companyId },
          }),
          transaction.warehouse.findFirst({
            where: { id: body.warehouseId, companyId: body.companyId },
          }),
          transaction.greenCoffeePurchase.findFirst({
            where: { id: body.purchaseId, companyId: body.companyId },
            include: { receipts: { select: { netWeightKg: true } }, professionalSample: true },
          }),
        ]);
        if (
          !supplier ||
          !warehouse ||
          !purchase ||
          purchase.supplierId !== supplier.id
        )
          throw new BadRequestException(
            "Compra, fornecedor, armazém e empresa devem pertencer ao mesmo contexto.",
          );
        if (purchase.approvalStatus !== "APPROVED")
          throw new BadRequestException("A compra precisa estar aprovada internamente.");
        if (purchase.externalAcceptanceStatus !== "ACCEPTED")
          throw new BadRequestException("O aceite externo do fornecedor é necessário antes do recebimento.");
        const sequence =
          (await transaction.greenCoffeeReceipt.count({
            where: { companyId: body.companyId },
          })) + 1;
        const suffix = sequence.toString().padStart(6, "0");
        const receiptNumber = `REC-${new Date().getFullYear()}-${suffix}`;
        const lotCode = `LV-${new Date().getFullYear()}-${suffix}`;
        const qualityStatus = GreenCoffeeQualityStatus.AWAITING_ANALYSIS;
        const receivedBefore = purchase.receipts.reduce(
          (sum, receipt) => sum + Number(receipt.netWeightKg),
          0,
        );
        const balanceBefore =
          Number(purchase.contractedWeightKg) - receivedBefore;
        const weightDifference = body.netWeightKg - balanceBefore;
        const differences: Prisma.InputJsonObject[] = [];
        if (
          weightDifference >
          (balanceBefore * Number(purchase.weightTolerancePercent)) / 100
        )
          differences.push({
            field: "weightKg",
            contracted: balanceBefore,
            received: body.netWeightKg,
            critical: true,
          });
        if (body.species !== purchase.species)
          differences.push({
            field: "species",
            contracted: purchase.species,
            received: body.species,
            critical: true,
          });
        if (body.origin !== purchase.originRegion)
          differences.push({
            field: "origin",
            contracted: purchase.originRegion,
            received: body.origin,
            critical: true,
          });
        if (
          purchase.maxMoisturePercent &&
          body.moisturePercent &&
          body.moisturePercent > Number(purchase.maxMoisturePercent)
        )
          differences.push({
            field: "moisturePercent",
            contracted: Number(purchase.maxMoisturePercent),
            received: body.moisturePercent,
            critical: true,
          });
        const requiresApproval =
          differences.some((difference) => difference.critical) ||
          body.netWeightKg > balanceBefore;
        const purchaseCost = body.purchaseCost ?? 0;
        const lot = await transaction.coffeeLot.create({
          data: {
            companyId: body.companyId,
            supplierId: body.supplierId,
            warehouseId: body.warehouseId,
            code: lotCode,
            origin: body.origin,
            harvest: body.harvest,
            variety: body.variety,
            initialWeightKg: body.netWeightKg,
            currentWeightKg: body.netWeightKg,
            purchaseCost,
            landedCost: purchaseCost,
            status: lotStatusFor(qualityStatus),
          },
        });
        const receipt = await transaction.greenCoffeeReceipt.create({
          data: {
            companyId: body.companyId,
            supplierId: body.supplierId,
            warehouseId: body.warehouseId,
            coffeeLotId: lot.id,
            purchaseId: purchase.id,
            receiptNumber,
            idempotencyKey: body.idempotencyKey,
            qualityStatus,
            species: body.species,
            farmName: body.farmName,
            municipality: body.municipality,
            state: body.state,
            country: body.country,
            origin: body.origin,
            harvest: body.harvest,
            variety: body.variety,
            process: body.process,
            supplierLotCode: body.supplierLotCode,
            invoiceNumber: body.invoiceNumber,
            transportDocument: body.transportDocument,
            purchaseOrderNumber: body.purchaseOrderNumber,
            notes: body.notes,
            unit: body.unit,
            bagQuantity: body.bagQuantity,
            bagWeightKg: body.bagWeightKg,
            grossWeightKg: body.grossWeightKg,
            tareWeightKg: body.tareWeightKg ?? 0,
            netWeightKg: body.netWeightKg,
            moisturePercent: body.moisturePercent,
            screen: body.screen,
            defects: body.defects,
            classification: body.classification,
            qualityNotes: body.qualityNotes,
            packagingType: body.packagingType ?? "OTHER",
            volumeQuantity: body.volumeQuantity ?? body.bagQuantity,
            nominalWeightKg: body.nominalWeightKg ?? body.bagWeightKg,
            sampleCollected: true,
            visualCondition: "NORMAL",
            approvalStatus: requiresApproval ? "PENDING" : undefined,
            confirmedById: body.responsibleUserId,
            confirmedByName: body.responsibleName,
          },
        });
        const labSequence =
          (await transaction.greenCoffeeLabSample.count()) + 1;
        const sampleNumber = `LAB-${new Date().getFullYear()}-${labSequence.toString().padStart(6, "0")}`;
        await transaction.greenCoffeeLabSample.create({
          data: { receiptId: receipt.id, sampleNumber },
        });
        if (purchase.professionalSample) {
          const professionalSequence =
            (await transaction.professionalCoffeeSample.count({ where: { companyId: body.companyId } })) + 1;
          await transaction.professionalCoffeeSample.create({
            data: {
              companyId: body.companyId,
              source: ProfessionalSampleSource.RECEIPT,
              code: `AM-${new Date().getFullYear()}-${String(professionalSequence).padStart(6, "0")}`,
              status: ProfessionalSampleStatus.RECEIVED,
              supplierId: receipt.supplierId,
              contactName: purchase.professionalSample.contactName,
              country: receipt.country,
              state: receipt.state,
              municipality: receipt.municipality,
              region: receipt.origin,
              harvest: receipt.harvest,
              species: receipt.species,
              cultivar: receipt.variety,
              process: receipt.process,
              screen: receipt.screen,
              informedDefects: receipt.defects,
              informedMoisture: receipt.moisturePercent,
              supplierLotCode: receipt.supplierLotCode,
              receivedAt: receipt.confirmedAt,
              notes: receipt.notes,
              purchaseId: purchase.id,
              receiptId: receipt.id,
              sourceSampleId: purchase.professionalSample.id,
              createdById: actor.id,
              createdByName: actor.name,
            },
          });
        }
        if (requiresApproval) {
          const request = await transaction.greenCoffeeApprovalRequest.create({
            data: {
              companyId: body.companyId,
              purchaseId: purchase.id,
              receiptId: receipt.id,
              requiredRole:
                Math.abs(weightDifference) / Math.max(balanceBefore, 1) > 0.05
                  ? "EXECUTIVE"
                  : "ADMIN",
              reason: "Divergência crítica entre compra e recebimento",
              differences,
            },
          });
          await transaction.operationalNotification.createMany({
            data: ["ADMIN", "EXECUTIVE"].map((targetRole) => ({
              companyId: body.companyId,
              purchaseId: purchase.id,
              type: "GREEN_COFFEE_RECEIPT_DIVERGENCE",
              title: "Divergência no recebimento",
              message: `${purchase.purchaseNumber} · ${receiptNumber} · aprovação necessária (${request.id})`,
              targetRole,
            })),
          });
        }
        await transaction.industrialEvent.create({
          data: {
            companyId: body.companyId,
            coffeeLotId: lot.id,
            warehouseId: body.warehouseId,
            type: EventType.RECEIPT,
            quantityKg: body.netWeightKg,
            metadata: {
              movementType: "entry",
              movementCode: "ENTRADA_RECEBIMENTO",
              receiptId: receipt.id,
              receiptNumber,
              supplierLotCode: body.supplierLotCode ?? null,
              userId: body.responsibleUserId,
              userName: body.responsibleName,
              availableAfterKg: body.netWeightKg,
            },
          },
        });
        if (purchaseCost > 0)
          await transaction.costEvent.create({
            data: {
              companyId: body.companyId,
              coffeeLotId: lot.id,
              supplierId: body.supplierId,
              type: CostType.RAW_MATERIAL,
              amount: purchaseCost,
              quantityBasis: body.netWeightKg,
              unit: "KG",
              description: `Café verde — ${receiptNumber}`,
            },
          });
        const receivedAfter = receivedBefore + body.netWeightKg;
        await transaction.greenCoffeePurchase.update({
          where: { id: purchase.id },
          data: {
            status:
              receivedAfter >= Number(purchase.contractedWeightKg)
                ? "RECEIVED"
                : "PARTIALLY_RECEIVED",
            operationalStatus:
              receivedAfter >= Number(purchase.contractedWeightKg)
                ? "RECEIVED"
                : "PARTIALLY_RECEIVED",
          },
        });
        await transaction.greenCoffeeAuditEvent.create({
          data: {
            companyId: body.companyId,
            purchaseId: purchase.id,
            receiptId: receipt.id,
            action: "RECEIPT_REGISTERED",
            actorId: body.responsibleUserId,
            actorName: body.responsibleName,
            metadata: { receiptNumber, lotCode, sampleNumber, differences },
          },
        });
        await transaction.greenCoffeeAuditEvent.create({
          data: {
            companyId: body.companyId,
            purchaseId: purchase.id,
            receiptId: receipt.id,
            action:
              receivedAfter >= Number(purchase.contractedWeightKg)
                ? "PURCHASE_FULLY_RECEIVED"
                : "PURCHASE_PARTIALLY_RECEIVED",
            actorId: body.responsibleUserId,
            actorName: body.responsibleName,
            metadata: {
              receivedAfter,
              contractedWeightKg: purchase.contractedWeightKg,
            },
          },
        });
        const variance = calculateWeightVariance(
          Number(purchase.contractedWeightKg),
          receivedBefore,
          body.netWeightKg,
          Number(purchase.weightTolerancePercent ?? 0),
        );
        return {
          receiptId: receipt.id,
          receiptNumber,
          lotId: lot.id,
          lotCode,
          sampleNumber,
          status: qualityStatus,
          approvalPending: requiresApproval,
          stockBalanceKg: body.netWeightKg,
          contractedWeightKg: variance.contractedKg,
          receivedAfterKg: variance.receivedKg,
          differenceKg: variance.differenceKg,
          differencePercent: variance.differencePercent,
          tolerancePercent: variance.tolerancePercent,
          withinTolerance: variance.withinTolerance,
          productionAvailable: false,
          duplicate: false,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Patch(":id/quality")
  async updateQuality(
    @Param("id") id: string,
    @Body()
    body: {
      qualityStatus: GreenCoffeeQualityStatus;
      responsibleUserId: string;
      responsibleName: string;
      notes?: string;
    },
    @Req() req: Request,
  ) {
    const actor = await requireSession(req, this.auth);
    body.responsibleUserId = actor.id;
    body.responsibleName = actor.name;
    return this.database.$transaction(async (transaction) => {
      const receipt = await transaction.greenCoffeeReceipt.findUnique({
        where: { id, companyId: actor.companyId },
      });
      if (!receipt) throw new NotFoundException("Recebimento não encontrado.");
      if (
        receipt.approvalStatus === "PENDING" &&
        (body.qualityStatus === GreenCoffeeQualityStatus.APPROVED ||
          body.qualityStatus ===
            GreenCoffeeQualityStatus.APPROVED_WITH_RESTRICTION)
      )
        throw new BadRequestException(
          "Divergência exige aprovação antes da liberação.",
        );
      const updated = await transaction.greenCoffeeReceipt.update({
        where: { id },
        data: { qualityStatus: body.qualityStatus, qualityNotes: body.notes },
      });
      await transaction.coffeeLot.update({
        where: { id: receipt.coffeeLotId },
        data: { status: lotStatusFor(body.qualityStatus) },
      });
      await transaction.industrialEvent.create({
        data: {
          companyId: receipt.companyId,
          coffeeLotId: receipt.coffeeLotId,
          warehouseId: receipt.warehouseId,
          type: EventType.QUALITY_TEST,
          metadata: {
            receiptId: receipt.id,
            qualityStatus: body.qualityStatus,
            userId: body.responsibleUserId,
            userName: body.responsibleName,
            notes: body.notes ?? null,
          },
        },
      });
      return {
        receiptId: updated.id,
        qualityStatus: updated.qualityStatus,
        productionAvailable:
          lotStatusFor(updated.qualityStatus) === CoffeeLotStatus.APPROVED,
      };
    });
  }

  private labSampleView(sample: {
    id: string;
    sampleNumber: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    receipt: {
      id: string;
      receiptNumber: string;
      qualityStatus: GreenCoffeeQualityStatus;
      confirmedAt: Date;
      netWeightKg: unknown;
      species: string;
      farmName: string | null;
      municipality: string | null;
      state: string | null;
      origin: string;
      harvest: string | null;
      variety: string | null;
      process: string | null;
      moisturePercent: unknown;
      defects: number | null;
      screen: string | null;
      qualityNotes: string | null;
      supplier: { id: string; name: string };
      coffeeLot: { id: string; code: string; status: CoffeeLotStatus; qualityScore: unknown };
      purchase: {
        purchaseNumber: string;
        maxMoisturePercent: unknown;
        maxDefects: number | null;
        minimumScore: unknown;
        contractedScreen: string | null;
        contractedWeightKg: unknown;
      } | null;
    };
  }) {
    const purchase = sample.receipt.purchase;
    const comparison = compareQuality({
      maxMoisturePercent: purchase?.maxMoisturePercent == null ? null : Number(purchase.maxMoisturePercent),
      measuredMoisturePercent: sample.receipt.moisturePercent == null ? null : Number(sample.receipt.moisturePercent),
      maxDefects: purchase?.maxDefects,
      measuredDefects: sample.receipt.defects,
      minimumScore: purchase?.minimumScore == null ? null : Number(purchase.minimumScore),
      measuredScore: sample.receipt.coffeeLot.qualityScore == null ? null : Number(sample.receipt.coffeeLot.qualityScore),
      contractedScreen: purchase?.contractedScreen,
      measuredScreen: sample.receipt.screen,
    });
    return {
      id: sample.id,
      sampleNumber: sample.sampleNumber,
      status: sample.status,
      createdAt: sample.createdAt,
      updatedAt: sample.updatedAt,
      receipt: {
        id: sample.receipt.id,
        receiptNumber: sample.receipt.receiptNumber,
        confirmedAt: sample.receipt.confirmedAt,
        netWeightKg: Number(sample.receipt.netWeightKg),
        qualityStatus: sample.receipt.qualityStatus,
        qualityNotes: sample.receipt.qualityNotes,
      },
      supplier: sample.receipt.supplier,
      origin: { farmName: sample.receipt.farmName, municipality: sample.receipt.municipality, state: sample.receipt.state, region: sample.receipt.origin, harvest: sample.receipt.harvest, species: sample.receipt.species, variety: sample.receipt.variety, process: sample.receipt.process },
      lot: sample.receipt.coffeeLot,
      contract: purchase ? { purchaseNumber: purchase.purchaseNumber, contractedWeightKg: Number(purchase.contractedWeightKg), maxMoisturePercent: purchase.maxMoisturePercent == null ? null : Number(purchase.maxMoisturePercent), maxDefects: purchase.maxDefects, minimumScore: purchase.minimumScore == null ? null : Number(purchase.minimumScore), contractedScreen: purchase.contractedScreen } : null,
      measured: { moisturePercent: sample.receipt.moisturePercent == null ? null : Number(sample.receipt.moisturePercent), defects: sample.receipt.defects, screen: sample.receipt.screen, score: sample.receipt.coffeeLot.qualityScore == null ? null : Number(sample.receipt.coffeeLot.qualityScore) },
      comparison,
    };
  }

  private validate(body: ConfirmReceiptBody) {
    const required = [
      body.companyId,
      body.purchaseId,
      body.supplierId,
      body.warehouseId,
      body.idempotencyKey,
      body.responsibleUserId,
      body.responsibleName,
      body.species,
      body.origin,
    ];
    if (required.some((value) => !value))
      throw new BadRequestException("Preencha todos os campos obrigatórios.");
    if (
      !Number.isFinite(body.netWeightKg) ||
      body.netWeightKg <= 0 ||
      !Number.isFinite(body.grossWeightKg) ||
      body.grossWeightKg <= 0
    )
      throw new BadRequestException("Os pesos devem ser maiores que zero.");
    if (
      (body.tareWeightKg ?? 0) < 0 ||
      Math.abs(
        body.grossWeightKg - (body.tareWeightKg ?? 0) - body.netWeightKg,
      ) > 0.01
    )
      throw new BadRequestException(
        "Peso líquido deve ser igual ao peso bruto menos a tara.",
      );
    if (
      body.unit === "BAG" &&
      (!body.bagQuantity ||
        !body.bagWeightKg ||
        Math.abs(body.bagQuantity * body.bagWeightKg - body.netWeightKg) > 0.01)
    )
      throw new BadRequestException(
        "Quantidade e peso das sacas devem corresponder ao peso líquido.",
      );
  }
}
