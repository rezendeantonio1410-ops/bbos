import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Res,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  GreenCoffeeApprovalStatus,
  GreenCoffeePackagingType,
  GreenCoffeePurchaseStatus,
  GreenCoffeeSupplierType,
  PayableStatus,
  Prisma,
  PrismaClient,
  PurchaseApprovalStatus,
  PurchaseInstallmentStatus,
  PurchaseOperationalStatus,
  PurchasePaymentTermType,
} from "@bbos/database";
import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { AuthService } from "./auth.service";
import { missingPurchaseApprovalFields } from "./purchase-validation";
import {
  calculateBrokerCommission,
  ensureBrokerCommissionPayable,
} from "./broker-commission";
import { getBrazilianMunicipalities } from "./brazilian-municipalities";
import { UnconfiguredTaxRegistryProvider } from "./tax-registry.provider";
import { UnconfiguredStateRegistrationProvider } from "./state-registration.provider";
import {
  validateStateRegistration,
  validateTaxId,
} from "./supplier-verification";

type Actor = {
  userId: string;
  userName: string;
  userRole: string;
  companyId: string;
};
const normalizePostalCode = (value?: unknown) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? digits.padStart(8, "0").slice(0, 8) : null;
};
type InstallmentInput = {
  installmentNumber: number;
  percentage: number;
  amount: number;
  dueDate: string;
};
type PurchaseBody = {
  companyId: string;
  supplierId: string;
  originUnitId?: string;
  idempotencyKey: string;
  buyerId: string;
  buyerName: string;
  actorRole?: string;
  action?: "DRAFT" | "SUBMIT" | "APPROVE";
  department?: string;
  approverName?: string;
  purchasedAt: string;
  species: string;
  speciesId?: string;
  originRegion: string;
  municipality?: string;
  state?: string;
  country?: string;
  farmName?: string;
  harvest: string;
  variety?: string;
  cultivarId?: string;
  process?: string;
  supplierLotCode?: string;
  qualityCategory: string;
  qualityDescription?: string;
  additionalSpecification?: string;
  contractedScreen?: string;
  coffeeRegionId?: string;
  screenClassificationId?: string;
  maxDefects?: number;
  maxMoisturePercent?: number;
  beverageClassification?: string;
  minimumScore?: number;
  technicalSpecifications?: string;
  packagingType: GreenCoffeePackagingType;
  volumeQuantity: number;
  nominalUnitWeightKg: number;
  contractedWeightKg: number;
  weightTolerancePercent?: number;
  pricePerKg?: number;
  pricePerBag?: number;
  currency?: string;
  totalValue: number;
  paymentTermType: PurchasePaymentTermType;
  paymentTermData?: Prisma.InputJsonValue;
  installments: InstallmentInput[];
  expectedAt?: string;
  contractReference?: string;
  commercialNotes?: string;
  brokerId?: string;
  brokerCommissionPercent?: number;
};

const DEFAULT_ACCEPTANCE_TEXT =
  "O café entregue estará sujeito à conferência de quantidade, documentação e análise de qualidade pela Compradora. A aceitação definitiva ocorrerá após a verificação de conformidade com as especificações desta Ficha de Compra. Eventuais divergências poderão resultar em reclassificação, ajuste comercial, substituição ou recusa, conforme aplicável e de acordo com os Termos Gerais de Compra.";
const hashToken = (token: string) =>
  createHash("sha256").update(token).digest("hex");
const maskDestination = (value?: string | null) => {
  if (!value) return null;
  const normalized = value.replace(/\s+/g, "");
  if (normalized.includes("@")) {
    const [name = "", domain = ""] = normalized.split("@");
    return `${name.slice(0, 2)}•••@${domain}`;
  }
  return `${normalized.slice(0, 3)}••••${normalized.slice(-2)}`;
};

function simplePdf(lines: string[]) {
  const escape = (value: string) =>
    value
      .replace(/\\/g, "\\\\")
      .replace(/[()]/g, "\\$&")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const logoCandidates = [
    join(process.cwd(), "../web/public/brand/logo/bispo-logo-official.jpg"),
    join(
      process.cwd(),
      "../../apps/web/public/brand/logo/bispo-logo-official.jpg",
    ),
  ];
  const logoPath = logoCandidates.find((candidate) => existsSync(candidate));
  const logo = logoPath ? readFileSync(logoPath) : null;
  const content = [
    ...(logo ? ["q", "160 0 0 45 50 770 cm", "/Im1 Do", "Q"] : []),
    "BT",
    "/F1 10 Tf",
    logo ? "50 750 Td" : "50 790 Td",
    ...lines.flatMap((line) => [
      `(${escape(line.slice(0, 110))}) Tj`,
      "0 -15 Td",
    ]),
    "ET",
  ].join("\n");
  const pageResources = logo
    ? "/Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >>"
    : "/Resources << /Font << /F1 5 0 R >> >>";
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${pageResources} /Contents 4 0 R >>`,
    ),
    Buffer.from(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    ),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  if (logo) {
    const logoBytes = logo;
    objects.push(
      Buffer.concat([
        Buffer.from(
          `<< /Type /XObject /Subtype /Image /Width 860 /Height 240 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logoBytes.length} >>\nstream\n`,
        ),
        logoBytes,
        Buffer.from("\nendstream"),
      ]),
    );
  }
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) continue;
    offsets[index + 1] = Buffer.concat(chunks).length;
    chunks.push(
      Buffer.from(`${index + 1} 0 obj\n`),
      object,
      Buffer.from("\nendobj\n"),
    );
  }
  const xref = Buffer.concat(chunks).length;
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets
        .slice(1)
        .map((offset) => `${String(offset).padStart(10, "0")} 00000 n `)
        .join(
          "\n",
        )}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`,
    ),
  );
  return Buffer.concat(chunks);
}

const canApprove = (role?: string) => role === "EXECUTIVE" || role === "ADMIN";
const money = (value: number) => Math.round(value * 100) / 100;
const contractLabel = (value?: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const labels: Record<string, string> = {
    ARABICA: "Arábica",
    ROBUSTA: "Robusta",
    ROBUSTA_CONILON: "Robusta/Conilon",
    CANEPHORA: "Canephora/Robusta/Conilon",
    BAG_30_KG: "Sacas de 30 kg",
    BAG_60_KG: "Sacas de 60 kg",
    BIG_BAG: "Big Bag",
    NATURAL: "Natural",
    CEREJA_DESCASCADO: "Cereja descascado",
    HONEY: "Honey",
    LAVADO: "Lavado",
    FERMENTADO: "Fermentado",
  };
  return labels[String(value)] ?? String(value).replaceAll("_", " ");
};

@Controller("green-coffee-purchases")
export class GreenCoffeePurchasesController {
  private readonly db = new PrismaClient();
  constructor(
    private readonly auth: AuthService,
    private readonly taxRegistry: UnconfiguredTaxRegistryProvider,
    private readonly stateRegistration: UnconfiguredStateRegistrationProvider,
  ) {}

  private readonly include = {
    broker: true,
    supplier: {
      include: {
        contacts: {
          where: { active: true, canConfirmBusiness: true },
          orderBy: [{ isPrimary: "desc" as const }, { name: "asc" as const }],
        },
      },
    },
    originUnit: { include: { coffeeRegion: true } },
    receipts: { include: { coffeeLot: true, labSample: true } },
    approvalRequests: true,
    installments: {
      include: { accountsPayable: { include: { payments: true } } },
      orderBy: { installmentNumber: "asc" as const },
    },
    externalAcceptances: { orderBy: { createdAt: "desc" as const } },
  };

  @Get()
  async list(@Req() request: any) {
    const actor = await this.sessionActor(request);
    const rows = await this.db.greenCoffeePurchase.findMany({
      where: { companyId: actor.companyId },
      include: this.include,
      orderBy: { purchasedAt: "desc" },
    });
    return rows.map((row) => this.view(row));
  }

  @Get("catalog")
  async catalog(@Req() request: any, @Query("companyId") companyId?: string) {
    const actor = await this.sessionActor(request);
    if (companyId && companyId !== actor.companyId)
      throw new ForbiddenException("Acesso negado para esta empresa.");
    companyId = actor.companyId;
    return this.db.coffeeSpecies.findMany({
      where: { companyId, active: true },
      include: {
        varieties: { where: { active: true }, orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
    });
  }

  @Get("references")
  async references(@Req() request: any, @Query("state") state?: string) {
    const actor = await this.sessionActor(request);
    const [species, regions, screenClassifications, supplierRows] =
      await Promise.all([
        this.db.coffeeSpecies.findMany({
          where: { companyId: actor.companyId, active: true },
          include: {
            varieties: {
              where: { active: true },
              orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            },
          },
          orderBy: { name: "asc" },
        }),
        this.db.coffeeRegion.findMany({
          where: { companyId: actor.companyId, active: true },
          orderBy: [{ state: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
        }),
        this.db.screenClassification.findMany({
          where: { companyId: actor.companyId, active: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        }),
        this.db.supplier.findMany({
          where: {
            companyId: actor.companyId,
            active: true,
            ...(state
              ? {
                  OR: [
                    { state },
                    { originUnits: { some: { state, active: true } } },
                  ],
                }
              : {}),
          },
          include: {
            originUnits: {
              where: { active: true, ...(state ? { state } : {}) },
              include: {
                coffeeRegion: true,
                productions: {
                  where: { active: true },
                  include: { species: true, cultivar: true },
                },
              },
              orderBy: { name: "asc" },
            },
          },
          orderBy: { name: "asc" },
        }),
      ]);
    return { species, regions, screenClassifications, suppliers: supplierRows };
  }

  @Get("references/municipalities")
  async municipalities(@Req() request: any, @Query("state") state?: string) {
    await this.sessionActor(request);
    return getBrazilianMunicipalities(state);
  }

  @Get("suppliers/:supplierId/bank-accounts")
  async bankAccounts(
    @Param("supplierId") supplierId: string,
    @Query("userId") userId: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    userId = actor.userId;
    const rows = await this.db.supplierBankAccount.findMany({
      where: { supplierId, active: true, companyId: actor.companyId },
    });
    const user = userId
      ? await this.db.user.findUnique({ where: { id: userId } })
      : null;
    if (user && ["FINANCE", "EXECUTIVE", "ADMIN"].includes(user.role))
      return rows;
    const mask = (value?: string | null) =>
      value ? `••••${value.slice(-4)}` : null;
    return rows.map((row) => ({
      ...row,
      agency: mask(row.agency),
      accountNumber: mask(row.accountNumber),
      holderTaxId: mask(row.holderTaxId),
      pixKey: mask(row.pixKey),
      iban: mask(row.iban),
    }));
  }

  @Get("suppliers/:supplierId/contacts")
  async supplierContacts(
    @Param("supplierId") supplierId: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    return this.db.supplierContact.findMany({
      where: { supplierId, active: true },
      orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
    });
  }

  @Post("suppliers/:supplierId/contacts")
  async createSupplierContact(
    @Param("supplierId") supplierId: string,
    @Body()
    body: {
      name: string;
      role?: string;
      whatsapp?: string;
      email?: string;
      isPrimary?: boolean;
      canConfirmBusiness?: boolean;
      active?: boolean;
    },
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    if (!body.name?.trim())
      throw new BadRequestException("Nome do contato é obrigatório.");
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    return this.db.$transaction(async (tx) => {
      if (body.isPrimary)
        await tx.supplierContact.updateMany({
          where: { supplierId },
          data: { isPrimary: false },
        });
      return tx.supplierContact.create({
        data: {
          supplierId,
          name: body.name.trim(),
          role: body.role?.trim() || null,
          whatsapp: body.whatsapp?.trim() || null,
          email: body.email?.trim() || null,
          isPrimary: body.isPrimary ?? false,
          canConfirmBusiness: body.canConfirmBusiness ?? false,
          active: body.active ?? true,
        },
      });
    });
  }

  @Post("suppliers/:supplierId/bank-accounts")
  async createBankAccount(
    @Param("supplierId") supplierId: string,
    @Body()
    body: Actor & {
      companyId: string;
      bankName: string;
      bankCode?: string;
      agency?: string;
      accountNumber?: string;
      accountType?: string;
      holderName: string;
      holderTaxId: string;
      pixKey?: string;
      pixType?: string;
      iban?: string;
      swiftBic?: string;
      country?: string;
    },
    @Req() request: any,
  ) {
    const session = await this.sessionActor(request);
    body.companyId = session.companyId;
    body.userId = session.userId;
    body.userName = session.userName;
    if (!body.bankName || !body.holderName || !body.holderTaxId)
      throw new BadRequestException(
        "Banco, titular e documento são obrigatórios.",
      );
    return this.db.$transaction(async (tx) => {
      const actor = await tx.user.findFirst({
        where: { id: body.userId, companyId: body.companyId, active: true },
      });
      if (!actor || !["FINANCE", "EXECUTIVE", "ADMIN"].includes(actor.role))
        throw new BadRequestException(
          "Dados bancários exigem permissão financeira.",
        );
      const supplier = await tx.supplier.findFirst({
        where: { id: supplierId, companyId: body.companyId },
      });
      if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
      const account = await tx.supplierBankAccount.create({
        data: {
          companyId: body.companyId,
          supplierId,
          bankName: body.bankName,
          bankCode: body.bankCode,
          agency: body.agency,
          accountNumber: body.accountNumber,
          accountType: body.accountType,
          holderName: body.holderName,
          holderTaxId: body.holderTaxId,
          pixKey: body.pixKey,
          pixType: body.pixType,
          iban: body.iban,
          swiftBic: body.swiftBic,
          country: body.country ?? "Brasil",
        },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: body.companyId,
          action: "SUPPLIER_BANK_ACCOUNT_CREATED",
          actorId: body.userId,
          actorName: body.userName,
          metadata: {
            supplierId,
            bankAccountId: account.id,
            bankName: account.bankName,
          },
        },
      });
      return account;
    });
  }

  @Get(":id/contract.pdf")
  async contractPdf(
    @Param("id") id: string,
    @Req() request: any,
    @Res() response: any,
  ) {
    const actor = await this.sessionActor(request);
    const purchase = await this.db.greenCoffeePurchase.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        externalAcceptances: {
          where: { status: "ACCEPTED" },
          orderBy: { acceptedAt: "desc" },
          take: 1,
        },
      },
    });
    const acceptance = purchase?.externalAcceptances[0];
    if (!purchase || !acceptance)
      throw new BadRequestException(
        "O PDF só está disponível após o aceite do fornecedor.",
      );
    const snapshot: any = acceptance.snapshot;
    const lines = [
      "CONTRATO DE COMPRA DE CAFE VERDE",
      `Contrato: ${snapshot.purchaseNumber}`,
      "",
      `COMPRADOR: ${snapshot.company?.name ?? "Bispo Coffees"}`,
      `VENDEDOR: ${snapshot.supplier?.name ?? "—"}`,
      `DOCUMENTO: ${snapshot.supplier?.taxId ?? "—"}`,
      `ORIGEM: ${snapshot.coffee?.originRegion ?? "—"}`,
      `ESPECIE: ${contractLabel(snapshot.coffee?.species)}`,
      `VARIEDADE: ${contractLabel(snapshot.coffee?.variety)}`,
      `SAFRA: ${snapshot.coffee?.harvest ?? "—"}`,
      `PROCESSO: ${contractLabel(snapshot.coffee?.process)}`,
      `QUALIDADE: ${contractLabel(snapshot.specification?.qualityCategory)}`,
      `PENEIRA: ${snapshot.specification?.contractedScreen ?? "—"}`,
      `UMIDADE MAXIMA: ${snapshot.specification?.maxMoisturePercent ?? "—"}`,
      `QUANTIDADE: ${snapshot.quantity?.contractedWeightKg ?? "—"} kg`,
      `VOLUMES: ${snapshot.quantity?.volumeQuantity ?? "—"}`,
      `ACONDICIONAMENTO: ${contractLabel(snapshot.quantity?.packagingType)}`,
      `PRECO/KG: ${snapshot.commercial?.pricePerKg ?? "—"}`,
      `VALOR TOTAL: ${snapshot.commercial?.totalValue ?? "—"}`,
      `ENTREGA: ${snapshot.commercial?.expectedAt ?? "—"}`,
      `REFERENCIA: ${snapshot.commercial?.contractReference ?? "—"}`,
      "",
      "PROTECAO DE DADOS PESSOAIS",
      "As partes comprometem-se a tratar os dados pessoais relacionados a este Contrato em conformidade com a Lei nº 13.709/2018 (LGPD), utilizando-os para finalidades legitimas da relacao contratual, cumprimento de obrigacoes legais e exercicio regular de direitos, observados seguranca, necessidade e confidencialidade.",
      "",
      "CONFIRMACOES DAS PARTES",
      `BISPO COFFEES: ${purchase.approvedByName ?? "—"} · ${purchase.approvedAt?.toISOString() ?? "—"}`,
      `ENVIADO PARA: ${acceptance.contactName ?? "—"} · ${acceptance.contactRole ?? "—"} · ${acceptance.destinationMasked ?? "—"}`,
      `FORNECEDOR: ${acceptance.acceptedByName ?? "—"} · ${acceptance.acceptedAt?.toISOString() ?? "—"}`,
      "Metodo: Confirmacao eletronica registrada pelo BBOs",
      `Versao do documento: ${acceptance.termsVersion}`,
      `Versao dos Termos Gerais: ${acceptance.termsVersion}`,
      `Hash do documento: ${acceptance.documentHash}`,
      "",
      "Documento gerado eletronicamente pelo BBOs a partir da versao contratual confirmada pelas partes.",
    ];
    const pdf = simplePdf(lines);
    response.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${purchase.purchaseNumber}-contrato.pdf"`,
      "Content-Length": pdf.length,
    });
    response.send(pdf);
  }

  @Get(":id")
  async get(@Param("id") id: string, @Req() request: any) {
    const actor = await this.sessionActor(request);
    const row = await this.db.greenCoffeePurchase.findFirst({
      where: { id, companyId: actor.companyId },
      include: {
        ...this.include,
        notifications: true,
        auditEvents: { orderBy: { occurredAt: "asc" } },
      },
    });
    if (!row) throw new NotFoundException("Compra não encontrada.");
    return this.view(row);
  }

  @Get(":id/confirmation-documents")
  async confirmationDocuments(@Param("id") id: string, @Req() request: any) {
    const actor = await this.sessionActor(request);
    const purchase = await this.db.greenCoffeePurchase.findFirst({
      where: { id, companyId: actor.companyId },
      select: { id: true },
    });
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    return this.db.purchaseConfirmationDocumentVersion.findMany({
      where: { purchaseId: id },
      orderBy: { version: "desc" },
    });
  }

  @Post(":id/confirmation-documents")
  async createConfirmationDocument(
    @Param("id") id: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
        include: this.include,
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      const last = await tx.purchaseConfirmationDocumentVersion.findFirst({
        where: { purchaseId: id },
        orderBy: { version: "desc" },
        select: { version: true },
      });
      await tx.purchaseConfirmationDocumentVersion.updateMany({
        where: { purchaseId: id, status: "DRAFT" },
        data: { status: "SUPERSEDED", supersededAt: new Date() },
      });
      const snapshot = this.acceptanceSnapshot(purchase);
      const documentHash = createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex");
      return tx.purchaseConfirmationDocumentVersion.create({
        data: {
          purchaseId: id,
          version: (last?.version ?? 0) + 1,
          snapshot,
          documentHash,
        },
      });
    });
  }

  @Patch(":id")
  async updateDraft(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: Partial<PurchaseBody>,
  ) {
    const actor = await this.sessionActor(request);
    if (
      body.maxMoisturePercent !== undefined &&
      body.maxMoisturePercent !== null &&
      (body.maxMoisturePercent < 10 || body.maxMoisturePercent > 12.5)
    )
      throw new BadRequestException(
        "A umidade máxima deve estar entre 10,0% e 12,5%.",
      );
    if (
      body.brokerCommissionPercent !== undefined &&
      (!Number.isFinite(body.brokerCommissionPercent) ||
        body.brokerCommissionPercent < 0 ||
        body.brokerCommissionPercent > 100)
    )
      throw new BadRequestException(
        "A comissão do corretor deve estar entre 0% e 100%.",
      );
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      if (purchase.approvalStatus !== PurchaseApprovalStatus.DRAFT)
        throw new BadRequestException("Somente rascunhos podem ser editados.");
      const data: Prisma.GreenCoffeePurchaseUpdateInput = {};
      if (body.speciesId) {
        const species = await tx.coffeeSpecies.findFirst({
          where: {
            id: body.speciesId,
            companyId: actor.companyId,
            active: true,
          },
        });
        if (!species)
          throw new BadRequestException("Espécie inválida para a empresa.");
        data.speciesRef = { connect: { id: species.id } };
      }
      if (body.cultivarId) {
        const cultivar = await tx.coffeeVariety.findFirst({
          where: {
            id: body.cultivarId,
            active: true,
            speciesId: body.speciesId ?? purchase.speciesId ?? undefined,
          },
        });
        if (!cultivar)
          throw new BadRequestException(
            "Cultivar inválida para a espécie selecionada.",
          );
        data.cultivarRef = { connect: { id: cultivar.id } };
      }
      if (body.coffeeRegionId) {
        const region = await tx.coffeeRegion.findFirst({
          where: {
            id: body.coffeeRegionId,
            companyId: actor.companyId,
            active: true,
          },
        });
        if (!region)
          throw new BadRequestException(
            "Região cafeeira inválida para a empresa.",
          );
        data.coffeeRegion = { connect: { id: region.id } };
      }
      if (body.screenClassificationId) {
        const screen = await tx.screenClassification.findFirst({
          where: {
            id: body.screenClassificationId,
            companyId: actor.companyId,
            active: true,
          },
        });
        if (!screen)
          throw new BadRequestException(
            "Classificação de peneira inválida para a empresa.",
          );
        data.screenClassification = { connect: { id: screen.id } };
      }
      if (body.originUnitId) {
        const unit = await tx.supplierOriginUnit.findFirst({
          where: {
            id: body.originUnitId,
            supplierId: purchase.supplierId,
            active: true,
            supplier: { companyId: actor.companyId, active: true },
          },
        });
        if (!unit)
          throw new BadRequestException(
            "Unidade/fazenda inválida para a compra.",
          );
        data.originUnit = { connect: { id: unit.id } };
      }
      if (Object.prototype.hasOwnProperty.call(body, "brokerId")) {
        if (body.brokerId) {
          const broker = await tx.broker.findFirst({
            where: {
              id: body.brokerId,
              companyId: actor.companyId,
              active: true,
            },
          });
          if (!broker)
            throw new BadRequestException("Corretor inválido para a empresa.");
          data.broker = { connect: { id: broker.id } };
        } else {
          data.broker = { disconnect: true };
          data.brokerCommissionPercent = null;
          data.brokerCommissionAmount = null;
        }
      }
      for (const key of [
        "originRegion",
        "municipality",
        "state",
        "country",
        "farmName",
        "harvest",
        "variety",
        "process",
        "supplierLotCode",
        "qualityCategory",
        "qualityDescription",
        "additionalSpecification",
        "contractedScreen",
        "maxDefects",
        "maxMoisturePercent",
        "minimumScore",
        "technicalSpecifications",
        "expectedAt",
        "contractReference",
        "commercialNotes",
      ] as const) {
        if (body[key] !== undefined)
          (data as any)[key] =
            key === "expectedAt" && body[key]
              ? new Date(String(body[key]))
              : body[key];
      }
      if (body.pricePerKg !== undefined) data.pricePerKg = body.pricePerKg;
      if (body.totalValue !== undefined) data.totalValue = body.totalValue;
      if (body.brokerCommissionPercent !== undefined) {
        if (!body.brokerId && !purchase.brokerId)
          throw new BadRequestException(
            "Informe o corretor para registrar a comissão.",
          );
        data.brokerCommissionPercent = body.brokerCommissionPercent;
        data.brokerCommissionAmount = calculateBrokerCommission(
          body.totalValue ?? Number(purchase.totalValue),
          body.brokerCommissionPercent,
        );
      }
      if (Object.keys(data).length)
        await tx.greenCoffeePurchase.update({ where: { id }, data });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_UPDATED",
          actorId: actor.userId,
          actorName: actor.userName,
          metadata: { fields: Object.keys(data) },
        },
      });
      return tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
        include: this.include,
      });
    });
  }

  @Post("suppliers")
  async createSupplier(
    @Body()
    body: {
      companyId: string;
      supplierType: GreenCoffeeSupplierType;
      name: string;
      tradeName?: string;
      legalName?: string;
      taxId?: string;
      ruralRegistration?: string;
      stateRegistration?: string;
      stateRegistrationType?: string;
      farmName?: string;
      city?: string;
      state?: string;
      country?: string;
      address?: string;
      contactName?: string;
      contactRole?: string;
      contactPhone?: string;
      whatsapp?: string;
      contactEmail?: string;
      postalCode?: string;
      district?: string;
      addressComplement?: string;
      ibgeCityCode?: string;
    },
    @Req() request: any,
  ) {
    // A supplier is always created in the authenticated user's company;
    // client-provided company/actor fields are deliberately ignored.
    return this.createSupplierForSession(body, request);
  }

  private async createSupplierForSession(
    body: {
      companyId: string;
      supplierType: GreenCoffeeSupplierType;
      name: string;
      tradeName?: string;
      legalName?: string;
      taxId?: string;
      ruralRegistration?: string;
      stateRegistration?: string;
      stateRegistrationType?: string;
      farmName?: string;
      city?: string;
      state?: string;
      country?: string;
      address?: string;
      contactName?: string;
      contactRole?: string;
      contactPhone?: string;
      whatsapp?: string;
      contactEmail?: string;
      postalCode?: string;
      district?: string;
      addressComplement?: string;
      ibgeCityCode?: string;
    },
    request: any,
  ) {
    const actor = await this.sessionActor(request);
    if (!body.name)
      throw new BadRequestException("Nome ou razão social é obrigatório.");
    if (body.taxId && !validateTaxId(body.taxId))
      throw new BadRequestException("CPF/CNPJ inválido.");
    if (
      body.stateRegistrationType !== "EXEMPT" &&
      body.stateRegistrationType !== "NON_TAXPAYER" &&
      body.stateRegistration &&
      !validateStateRegistration(body.stateRegistration, body.state)
    )
      throw new BadRequestException("Inscrição Estadual inválida para a UF.");
    if (body.taxId) {
      const duplicate = await this.db.supplier.findFirst({
        where: { companyId: actor.companyId, taxId: body.taxId },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    return this.db.supplier.create({
      data: {
        ...body,
        companyId: actor.companyId,
        stateRegistration:
          body.stateRegistrationType === "NUMBER"
            ? body.stateRegistration || null
            : null,
        stateRegistrationType: body.stateRegistrationType ?? "NUMBER",
        postalCode: normalizePostalCode(body.postalCode),
      },
    });
  }

  @Get("suppliers")
  async suppliers(
    @Req() request: any,
    @Query("state") state?: string,
    @Query("active") active?: string,
  ) {
    const actor = await this.sessionActor(request);
    return this.db.supplier.findMany({
      where: {
        companyId: actor.companyId,
        ...(active === undefined ? {} : { active: active === "true" }),
        ...(state ? { state } : {}),
      },
      include: {
        originUnits: {
          include: { coffeeRegion: true },
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  @Post("suppliers/:supplierId/tax-id/verify")
  async verifySupplierTaxId(
    @Param("supplierId") supplierId: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    if (!supplier.taxId)
      throw new BadRequestException("CPF/CNPJ não informado.");
    const checkedAt = new Date();
    const documentType = validateTaxId(supplier.taxId);
    if (!documentType) {
      return this.db.supplier.update({
        where: { id: supplier.id },
        data: {
          taxIdVerificationStatus: "INVALID",
          taxIdVerifiedAt: checkedAt,
          taxIdVerificationSource: "local-format",
        },
      });
    }
    const result = await this.taxRegistry.lookup(supplier.taxId);
    const status =
      result.registrationStatus === "ACTIVE"
        ? "VERIFIED_ACTIVE"
        : result.registrationStatus === "INACTIVE"
          ? "VERIFIED_INACTIVE"
          : "NOT_VERIFIED";
    return this.db.supplier.update({
      where: { id: supplier.id },
      data: {
        taxIdVerificationStatus: status,
        taxIdVerifiedAt: checkedAt,
        taxIdVerificationSource: result.source,
      },
    });
  }

  @Post("suppliers/:supplierId/state-registration/verify")
  async verifySupplierStateRegistration(
    @Param("supplierId") supplierId: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    if (!supplier.stateRegistration)
      throw new BadRequestException("Inscrição Estadual não informada.");
    const checkedAt = new Date();
    const valid = validateStateRegistration(
      supplier.stateRegistration,
      supplier.state,
    );
    if (!valid) {
      return this.db.supplier.update({
        where: { id: supplier.id },
        data: {
          stateRegistrationVerificationStatus: "INVALID",
          stateRegistrationVerifiedAt: checkedAt,
          stateRegistrationVerificationSource: "local-format",
        },
      });
    }
    const result = await this.stateRegistration.lookup(
      supplier.stateRegistration,
      supplier.state ?? "",
    );
    const status =
      result.registrationStatus === "ACTIVE"
        ? "VERIFIED_ACTIVE"
        : result.registrationStatus === "INACTIVE"
          ? "VERIFIED_INACTIVE"
          : "NOT_VERIFIED";
    return this.db.supplier.update({
      where: { id: supplier.id },
      data: {
        stateRegistrationVerificationStatus: status,
        stateRegistrationVerifiedAt: checkedAt,
        stateRegistrationVerificationSource: result.source,
      },
    });
  }

  @Patch("suppliers/:supplierId")
  async updateSupplier(
    @Param("supplierId") supplierId: string,
    @Body() body: Record<string, unknown>,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const current = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
    });
    if (!current) throw new NotFoundException("Fornecedor não encontrado.");
    if (body.taxId && body.taxId !== current.taxId) {
      if (!validateTaxId(String(body.taxId)))
        throw new BadRequestException("CPF/CNPJ inválido.");
      const duplicate = await this.db.supplier.findFirst({
        where: {
          companyId: actor.companyId,
          taxId: String(body.taxId),
          NOT: { id: supplierId },
        },
      });
      if (duplicate)
        throw new BadRequestException(
          "CPF/CNPJ já cadastrado para esta empresa.",
        );
    }
    const allowed = [
      "supplierType",
      "name",
      "tradeName",
      "legalName",
      "taxId",
      "ruralRegistration",
      "stateRegistration",
      "stateRegistrationType",
      "city",
      "state",
      "country",
      "address",
      "postalCode",
      "district",
      "addressComplement",
      "ibgeCityCode",
      "contactName",
      "contactRole",
      "contactPhone",
      "whatsapp",
      "contactEmail",
      "active",
    ];
    const data = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowed.includes(key)),
    );
    if (typeof data.active === "string") data.active = data.active === "true";
    if (data.postalCode !== undefined)
      data.postalCode = normalizePostalCode(data.postalCode);
    if (
      data.stateRegistrationType === "EXEMPT" ||
      data.stateRegistrationType === "NON_TAXPAYER"
    )
      data.stateRegistration = null;
    if (
      data.stateRegistrationType !== undefined &&
      data.stateRegistrationType !== current.stateRegistrationType
    )
      Object.assign(data, {
        stateRegistrationVerificationStatus: "NOT_VERIFIED",
        stateRegistrationVerifiedAt: null,
        stateRegistrationVerificationSource: null,
      });
    if (
      data.stateRegistration &&
      !validateStateRegistration(
        String(data.stateRegistration),
        String(data.state ?? current.state ?? ""),
      )
    )
      throw new BadRequestException("Inscrição Estadual inválida para a UF.");
    if (data.taxId !== undefined && data.taxId !== current.taxId)
      Object.assign(data, {
        taxIdVerificationStatus: "NOT_VERIFIED",
        taxIdVerifiedAt: null,
        taxIdVerificationSource: null,
      });
    if (
      data.stateRegistration !== undefined &&
      data.stateRegistration !== current.stateRegistration
    )
      Object.assign(data, {
        stateRegistrationVerificationStatus: "NOT_VERIFIED",
        stateRegistrationVerifiedAt: null,
        stateRegistrationVerificationSource: null,
      });
    return this.db.supplier.update({ where: { id: supplierId }, data });
  }

  @Get("suppliers/:supplierId/origin-units")
  async originUnits(
    @Param("supplierId") supplierId: string,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
      select: { id: true },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    return this.db.supplierOriginUnit.findMany({
      where: {
        supplierId,
        ...(actor.companyId
          ? { supplier: { companyId: actor.companyId } }
          : {}),
      },
      include: {
        coffeeRegion: true,
        productions: {
          where: { active: true },
          include: { species: true, cultivar: true },
        },
      },
      orderBy: { name: "asc" },
    });
  }

  @Post("suppliers/:supplierId/origin-units")
  async createOriginUnit(
    @Param("supplierId") supplierId: string,
    @Body() body: Record<string, any>,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const supplier = await this.db.supplier.findFirst({
      where: { id: supplierId, companyId: actor.companyId },
    });
    if (!supplier) throw new NotFoundException("Fornecedor não encontrado.");
    if (!body.name?.trim() || !body.state)
      throw new BadRequestException(
        "Nome da unidade e Estado são obrigatórios.",
      );
    const region = body.coffeeRegionId
      ? await this.db.coffeeRegion.findFirst({
          where: {
            id: body.coffeeRegionId,
            companyId: actor.companyId,
            state: body.state,
            active: true,
          },
        })
      : null;
    if (body.coffeeRegionId && !region)
      throw new BadRequestException(
        "Região cafeeira inválida para o Estado selecionado.",
      );
    return this.db.supplierOriginUnit.create({
      data: {
        supplierId,
        name: body.name.trim(),
        taxId: body.taxId || null,
        stateRegistration: body.stateRegistration || null,
        state: body.state,
        municipality: body.municipality || null,
        country: body.country || "Brasil",
        address: body.address || null,
        postalCode: normalizePostalCode(body.postalCode),
        district: body.district || null,
        addressComplement: body.addressComplement || null,
        ibgeCityCode: body.ibgeCityCode || null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        altitudeMeters: body.altitudeMeters ?? null,
        coffeeAreaHa: body.coffeeAreaHa ?? null,
        coffeeRegionId: region?.id ?? null,
        active: body.active !== false,
      },
    });
  }

  @Patch("suppliers/:supplierId/origin-units/:unitId")
  async updateOriginUnit(
    @Param("supplierId") supplierId: string,
    @Param("unitId") unitId: string,
    @Body() body: Record<string, any>,
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const unit = await this.db.supplierOriginUnit.findFirst({
      where: {
        id: unitId,
        supplierId,
        supplier: { companyId: actor.companyId },
      },
    });
    if (!unit) throw new NotFoundException("Unidade/fazenda não encontrada.");
    if (body.coffeeRegionId) {
      const region = await this.db.coffeeRegion.findFirst({
        where: {
          id: body.coffeeRegionId,
          companyId: actor.companyId,
          state: body.state ?? unit.state,
          active: true,
        },
      });
      if (!region)
        throw new BadRequestException(
          "Região cafeeira inválida para o Estado selecionado.",
        );
    }
    const allowed = [
      "name",
      "taxId",
      "stateRegistration",
      "state",
      "municipality",
      "country",
      "address",
      "postalCode",
      "district",
      "addressComplement",
      "ibgeCityCode",
      "latitude",
      "longitude",
      "altitudeMeters",
      "coffeeAreaHa",
      "coffeeRegionId",
      "active",
    ];
    const data = Object.fromEntries(
      Object.entries(body).filter(([key]) => allowed.includes(key)),
    );
    if (data.postalCode !== undefined)
      data.postalCode = normalizePostalCode(data.postalCode);
    return this.db.supplierOriginUnit.update({ where: { id: unitId }, data });
  }

  @Post("suppliers/:supplierId/origin-units/:unitId/production")
  async createOriginProduction(
    @Param("supplierId") supplierId: string,
    @Param("unitId") unitId: string,
    @Body()
    body: {
      speciesId: string;
      cultivarIds?: string[];
      harvest?: string;
      certifications?: unknown;
    },
    @Req() request: any,
  ) {
    const actor = await this.sessionActor(request);
    const unit = await this.db.supplierOriginUnit.findFirst({
      where: {
        id: unitId,
        supplierId,
        supplier: { companyId: actor.companyId },
      },
    });
    if (!unit) throw new NotFoundException("Unidade/fazenda não encontrada.");
    const species = await this.db.coffeeSpecies.findFirst({
      where: { id: body.speciesId, companyId: actor.companyId, active: true },
    });
    if (!species) throw new BadRequestException("Espécie inválida.");
    const cultivarIds = body.cultivarIds?.length
      ? body.cultivarIds
      : [undefined];
    for (const cultivarId of cultivarIds) {
      if (
        cultivarId &&
        !(await this.db.coffeeVariety.findFirst({
          where: { id: cultivarId, speciesId: species.id, active: true },
        }))
      )
        throw new BadRequestException("Cultivar inválida para a espécie.");
    }
    return this.db.$transaction(
      cultivarIds.map((cultivarId) =>
        this.db.supplierOriginProduction.create({
          data: {
            originUnitId: unitId,
            speciesId: species.id,
            cultivarId,
            harvest: body.harvest || null,
            certifications: (body.certifications as any) ?? undefined,
          },
        }),
      ),
    );
  }

  @Post()
  async create(@Body() body: PurchaseBody, @Req() request: any) {
    const actor = await this.sessionActor(request);
    body.companyId = actor.companyId;
    body.buyerId = actor.userId;
    body.buyerName = actor.userName;
    body.actorRole = actor.userRole;
    this.validate(body);
    const duplicate = await this.db.greenCoffeePurchase.findUnique({
      where: { idempotencyKey: body.idempotencyKey },
    });
    if (duplicate) return { ...duplicate, duplicate: true };
    const action = body.action ?? "DRAFT";
    return this.db.$transaction(
      async (tx) => {
        const actor = await tx.user.findFirst({
          where: { id: body.buyerId, companyId: body.companyId, active: true },
        });
        if (!actor)
          throw new BadRequestException("Usuário responsável inválido.");
        if (action === "APPROVE" && !canApprove(actor.role))
          throw new BadRequestException(
            "Seu perfil pode criar e editar, mas não aprovar compras.",
          );
        const supplier = await tx.supplier.findFirst({
          where: { id: body.supplierId, companyId: body.companyId },
        });
        if (!supplier)
          throw new BadRequestException("Fornecedor inválido para a empresa.");
        let broker: { id: string } | null = null;
        if (body.brokerId) {
          broker = await tx.broker.findFirst({
            where: {
              id: body.brokerId,
              companyId: body.companyId,
              active: true,
            },
            select: { id: true },
          });
          if (!broker)
            throw new BadRequestException("Corretor inválido para a empresa.");
        }
        const brokerCommissionPercent = body.brokerCommissionPercent ?? null;
        if (brokerCommissionPercent !== null && !broker)
          throw new BadRequestException(
            "Informe o corretor para registrar a comissão.",
          );
        const brokerCommissionAmount =
          brokerCommissionPercent === null
            ? null
            : calculateBrokerCommission(
                body.totalValue,
                brokerCommissionPercent,
              );
        const references = await this.resolveReferences(
          tx,
          body,
          body.companyId,
        );
        if (action === "SUBMIT") {
          const missingFields = missingPurchaseApprovalFields({
            ...body,
            supplier,
          });
          if (missingFields.length)
            throw new BadRequestException({
              message: "A compra ainda não pode ser enviada para aprovação.",
              missingFields,
            });
        }
        const sequence =
          (await tx.greenCoffeePurchase.count({
            where: { companyId: body.companyId },
          })) + 1;
        const purchaseNumber = `CP-${new Date().getFullYear()}-${sequence.toString().padStart(6, "0")}`;
        const approved = action === "APPROVE";
        const approvalStatus =
          action === "DRAFT"
            ? PurchaseApprovalStatus.DRAFT
            : approved
              ? PurchaseApprovalStatus.APPROVED
              : PurchaseApprovalStatus.PENDING_APPROVAL;
        const purchase = await tx.greenCoffeePurchase.create({
          data: {
            companyId: body.companyId,
            supplierId: body.supplierId,
            brokerId: broker?.id,
            brokerCommissionPercent,
            brokerCommissionAmount,
            originUnitId: references.originUnitId,
            purchaseNumber,
            status: approved
              ? GreenCoffeePurchaseStatus.CONFIRMED
              : GreenCoffeePurchaseStatus.DRAFT,
            approvalStatus,
            operationalStatus: approved
              ? PurchaseOperationalStatus.AWAITING_DELIVERY
              : PurchaseOperationalStatus.NOT_STARTED,
            purchasedAt: new Date(body.purchasedAt),
            buyerId: body.buyerId,
            buyerName: body.buyerName,
            createdByUserId: body.buyerId,
            createdByName: body.buyerName,
            approvedByUserId: approved ? body.buyerId : undefined,
            approvedByName: approved ? body.buyerName : undefined,
            approvedAt: approved ? new Date() : undefined,
            submittedForApprovalAt:
              action === "SUBMIT" ? new Date() : undefined,
            submittedForApprovalByUserId:
              action === "SUBMIT" ? body.buyerId : undefined,
            department: body.department,
            approverName: body.approverName,
            species: body.species,
            speciesId: references.speciesId,
            originRegion: body.originRegion,
            municipality: body.municipality,
            state: body.state,
            country: body.country ?? "Brasil",
            farmName: body.farmName,
            harvest: body.harvest,
            variety: body.variety,
            cultivarId: references.cultivarId,
            process: body.process,
            supplierLotCode: body.supplierLotCode,
            qualityCategory: body.qualityCategory,
            qualityDescription: body.qualityDescription,
            additionalSpecification: body.additionalSpecification,
            contractedScreen: body.contractedScreen,
            coffeeRegionId: references.coffeeRegionId,
            screenClassificationId: references.screenClassificationId,
            maxDefects: body.maxDefects,
            maxMoisturePercent: body.maxMoisturePercent,
            beverageClassification: body.beverageClassification,
            minimumScore: body.minimumScore,
            technicalSpecifications: body.technicalSpecifications,
            packagingType: body.packagingType,
            volumeQuantity: body.volumeQuantity,
            nominalUnitWeightKg: body.nominalUnitWeightKg,
            contractedWeightKg: body.contractedWeightKg,
            weightTolerancePercent: body.weightTolerancePercent ?? 0,
            pricePerKg: body.pricePerKg,
            pricePerBag: body.pricePerBag,
            currency: body.currency ?? "BRL",
            totalValue: body.totalValue,
            paymentTerms: body.paymentTermType,
            paymentTermType: body.paymentTermType,
            paymentTermData: body.paymentTermData ?? {},
            expectedAt: body.expectedAt ? new Date(body.expectedAt) : undefined,
            contractReference: body.contractReference,
            commercialNotes: body.commercialNotes,
            idempotencyKey: body.idempotencyKey,
            confirmedAt: approved ? new Date() : undefined,
            supplierSnapshot: {
              id: supplier.id,
              name: supplier.name,
              legalName: supplier.legalName,
              taxId: supplier.taxId,
              supplierType: supplier.supplierType,
              farmName: supplier.farmName,
              municipality: supplier.city,
              state: supplier.state,
              country: supplier.country,
              address: supplier.address,
              contactName: supplier.contactName,
              contactPhone: supplier.contactPhone,
              contactEmail: supplier.contactEmail,
            },
            installments: {
              create: body.installments.map((item) => ({
                installmentNumber: item.installmentNumber,
                percentage: item.percentage,
                amount: item.amount,
                dueDate: new Date(item.dueDate),
                status: approved
                  ? PurchaseInstallmentStatus.COMMITTED
                  : PurchaseInstallmentStatus.PLANNED,
              })),
            },
          },
          include: { installments: true },
        });
        await tx.greenCoffeeAuditEvent.create({
          data: {
            companyId: body.companyId,
            purchaseId: purchase.id,
            action: "PURCHASE_CREATED",
            actorId: body.buyerId,
            actorName: body.buyerName,
            metadata: {
              purchaseNumber,
              approvalStatus,
              contractedWeightKg: body.contractedWeightKg,
              totalValue: body.totalValue,
            },
          },
        });
        if (approved) await ensureBrokerCommissionPayable(tx, purchase as any);
        if (action === "SUBMIT") {
          await tx.greenCoffeeAuditEvent.create({
            data: {
              companyId: body.companyId,
              purchaseId: purchase.id,
              action: "PURCHASE_SUBMITTED_FOR_APPROVAL",
              actorId: body.buyerId,
              actorName: body.buyerName,
            },
          });
        }
        return { ...purchase, duplicate: false };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Patch(":id/submit")
  async submit(@Param("id") id: string, @Req() request: any) {
    const actor = await this.sessionActor(request);
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
        include: { supplier: true },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      if (purchase.approvalStatus !== PurchaseApprovalStatus.DRAFT)
        throw new BadRequestException("Somente rascunhos podem ser enviados.");
      const missingFields = missingPurchaseApprovalFields(purchase);
      if (missingFields.length)
        throw new BadRequestException({
          message: "A compra ainda não pode ser enviada para aprovação.",
          missingFields,
        });
      const result = await tx.greenCoffeePurchase.update({
        where: { id },
        data: {
          approvalStatus: PurchaseApprovalStatus.PENDING_APPROVAL,
          submittedForApprovalAt: new Date(),
          submittedForApprovalByUserId: actor.userId,
        },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_SUBMITTED_FOR_APPROVAL",
          actorId: actor.userId,
          actorName: actor.userName,
        },
      });
      return result;
    });
  }

  @Patch(":id/approve")
  async approve(@Param("id") id: string, @Req() request: any) {
    const actor = await this.sessionActor(request);
    return this.db.$transaction(
      async (tx) => {
        const purchase = await tx.greenCoffeePurchase.findFirst({
          where: { id, companyId: actor.companyId },
          include: { supplier: true },
        });
        if (!purchase) throw new NotFoundException("Compra não encontrada.");
        await this.requireApprover(tx, purchase.companyId, actor);
        const missingFields = missingPurchaseApprovalFields(purchase);
        if (missingFields.length)
          throw new BadRequestException({
            message: "Esta compra ainda não pode ser aprovada.",
            missingFields,
          });
        if (purchase.approvalStatus === PurchaseApprovalStatus.APPROVED)
          return purchase;
        if (purchase.approvalStatus === PurchaseApprovalStatus.REJECTED)
          throw new BadRequestException(
            "Compra rejeitada não pode ser aprovada sem nova revisão.",
          );
        await tx.greenCoffeePurchase.update({
          where: { id },
          data: {
            approvalStatus: PurchaseApprovalStatus.APPROVED,
            operationalStatus: PurchaseOperationalStatus.NOT_STARTED,
            status: GreenCoffeePurchaseStatus.CONFIRMED,
            approvedByUserId: actor.userId,
            approvedByName: actor.userName,
            approvedAt: new Date(),
            rejectedByUserId: null,
            rejectedAt: null,
            rejectionReason: null,
            confirmedAt: new Date(),
          },
        });
        await tx.greenCoffeeAuditEvent.create({
          data: {
            companyId: purchase.companyId,
            purchaseId: id,
            action: "PURCHASE_APPROVED",
            actorId: actor.userId,
            actorName: actor.userName,
          },
        });
        const approvedPurchase = await tx.greenCoffeePurchase.findUnique({
          where: { id },
          include: this.include,
        });
        if (approvedPurchase)
          await ensureBrokerCommissionPayable(tx, approvedPurchase as any);
        return approvedPurchase;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  @Post(":id/acceptance/send")
  async sendAcceptance(
    @Param("id") id: string,
    @Req() request: any,
    @Body()
    body: Actor & {
      channel?: string;
      expiresInDays?: number;
      supplierContactId?: string;
    },
  ) {
    const sessionActor = await this.sessionActor(request);
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: sessionActor.companyId },
        include: {
          supplier: {
            include: {
              contacts: {
                where: { active: true, canConfirmBusiness: true },
                orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
              },
            },
          },
          installments: { orderBy: { installmentNumber: "asc" } },
        },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      if (purchase.approvalStatus !== PurchaseApprovalStatus.APPROVED)
        throw new BadRequestException(
          "Somente compras aprovadas internamente podem ser enviadas para aceite.",
        );
      if (purchase.externalAcceptanceStatus === "ACCEPTED")
        throw new BadRequestException(
          "Esta compra já foi aceita. Uma alteração material exige nova versão da ficha.",
        );
      const actor = await tx.user.findFirst({
        where: {
          id: sessionActor.userId,
          companyId: purchase.companyId,
          active: true,
        },
      });
      if (!actor)
        throw new BadRequestException("Usuário responsável inválido.");
      const previous = await tx.greenCoffeePurchaseAcceptance.findMany({
        where: { purchaseId: id, status: { in: ["SENT", "VIEWED"] } },
      });
      if (previous.length)
        await tx.greenCoffeePurchaseAcceptance.updateMany({
          where: { id: { in: previous.map((item) => item.id) } },
          data: { status: "EXPIRED", tokenRevokedAt: new Date() },
        });
      const token = randomBytes(32).toString("base64url");
      const tokenExpiresAt = new Date(
        Date.now() +
          Math.max(1, Math.min(90, body.expiresInDays ?? 14)) * 86400000,
      );
      const snapshot = this.acceptanceSnapshot(purchase);
      const documentHash = createHash("sha256")
        .update(JSON.stringify(snapshot))
        .digest("hex");
      const selectedContact = body.supplierContactId
        ? purchase.supplier.contacts.find(
            (item) => item.id === body.supplierContactId,
          )
        : purchase.supplier.contacts[0];
      if (body.supplierContactId && !selectedContact)
        throw new BadRequestException(
          "Contato não autorizado para confirmação.",
        );
      const contact =
        selectedContact?.name ??
        purchase.supplier.contactName ??
        purchase.supplier.name;
      const destination =
        selectedContact?.whatsapp ??
        selectedContact?.email ??
        purchase.supplier.whatsapp ??
        purchase.supplier.contactPhone ??
        purchase.supplier.contactEmail;
      const acceptance = await tx.greenCoffeePurchaseAcceptance.create({
        data: {
          purchaseId: id,
          supplierId: purchase.supplierId,
          supplierContactId: selectedContact?.id,
          status: "SENT",
          channel: body.channel ?? "WHATSAPP",
          destinationMasked: maskDestination(destination),
          contactName: contact,
          contactRole: selectedContact?.role ?? purchase.supplier.contactRole,
          contactPhoneSnapshot:
            selectedContact?.whatsapp ??
            purchase.supplier.whatsapp ??
            purchase.supplier.contactPhone,
          contactEmailSnapshot:
            selectedContact?.email ?? purchase.supplier.contactEmail,
          tokenHash: hashToken(token),
          tokenExpiresAt,
          sentAt: new Date(),
          termsVersion: purchase.termsVersion,
          termsDocumentUrl: purchase.termsDocumentUrl,
          documentHash,
          snapshot,
        },
      });
      await tx.greenCoffeePurchase.update({
        where: { id },
        data: {
          externalAcceptanceStatus: "SENT",
          acceptanceConditionText:
            purchase.acceptanceConditionText ?? DEFAULT_ACCEPTANCE_TEXT,
        },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_ACCEPTANCE_SENT",
          actorId: actor.id,
          actorName: actor.name,
          metadata: {
            acceptanceId: acceptance.id,
            channel: body.channel ?? "WHATSAPP",
          },
        },
      });
      const base =
        process.env.PUBLIC_APP_URL ??
        process.env.PUBLIC_WEB_URL ??
        process.env.WEB_URL?.split(",")[0] ??
        "http://localhost:3000";
      const url = `${base.replace(/\/$/, "")}/aceite-compra/${token}`;
      const message = `Olá, ${contact}.\n\nA Bispo Coffees disponibilizou a Ficha de Compra ${purchase.purchaseNumber} para sua conferência.\n\nAcesse o link abaixo para revisar as condições e confirmar seu aceite:\n\n${url}\n\nBispo Coffees`;
      return {
        acceptanceId: acceptance.id,
        status: "SENT",
        url,
        whatsappUrl: destination
          ? `https://wa.me/${destination.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
          : null,
        expiresAt: tokenExpiresAt,
      };
    });
  }

  @Post(":id/acceptance/revoke")
  async revokeAcceptance(@Param("id") id: string, @Req() request: any) {
    const actor = await this.sessionActor(request);
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      await this.requireApprover(tx, purchase.companyId, actor);
      const active = await tx.greenCoffeePurchaseAcceptance.findFirst({
        where: { purchaseId: id, status: { in: ["SENT", "VIEWED"] } },
        orderBy: { createdAt: "desc" },
      });
      if (!active) return { status: "NOT_SENT" };
      await tx.greenCoffeePurchaseAcceptance.update({
        where: { id: active.id },
        data: { status: "EXPIRED", tokenRevokedAt: new Date() },
      });
      await tx.greenCoffeePurchase.update({
        where: { id },
        data: { externalAcceptanceStatus: "EXPIRED" },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_ACCEPTANCE_REVOKED",
          actorId: actor.userId,
          actorName: actor.userName,
          metadata: { acceptanceId: active.id },
        },
      });
      return { status: "EXPIRED" };
    });
  }

  @Patch(":id/reject")
  async reject(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { reason: string },
  ) {
    const actor = await this.sessionActor(request);
    if (!body.reason?.trim())
      throw new BadRequestException("Reprovação exige motivo.");
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
        include: { installments: true },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      await this.requireApprover(tx, purchase.companyId, actor);
      for (const installment of purchase.installments)
        if (installment.accountsPayableId) {
          const payable = await tx.accountsPayable.findUnique({
            where: { id: installment.accountsPayableId },
          });
          if (payable && Number(payable.openAmount) < Number(payable.amount))
            throw new BadRequestException(
              "Compra com parcela paga exige estorno financeiro antes da reprovação.",
            );
          await tx.accountsPayable.update({
            where: { id: installment.accountsPayableId },
            data: { status: PayableStatus.CANCELLED },
          });
        }
      await tx.greenCoffeePurchaseInstallment.updateMany({
        where: { purchaseId: id },
        data: { status: PurchaseInstallmentStatus.CANCELLED },
      });
      const result = await tx.greenCoffeePurchase.update({
        where: { id },
        data: {
          approvalStatus: PurchaseApprovalStatus.REJECTED,
          operationalStatus: PurchaseOperationalStatus.CANCELLED,
          status: GreenCoffeePurchaseStatus.CANCELLED,
          rejectedByUserId: actor.userId,
          rejectedAt: new Date(),
          rejectionReason: body.reason,
        },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_REJECTED",
          actorId: actor.userId,
          actorName: actor.userName,
          metadata: { reason: body.reason },
        },
      });
      return result;
    });
  }

  @Patch(":id/return-adjustment")
  async returnForAdjustment(
    @Param("id") id: string,
    @Req() request: any,
    @Body() body: { returnReason?: string; correctionRequest?: string },
  ) {
    const actor = await this.sessionActor(request);
    const returnReason = body.returnReason?.trim() ?? "";
    const correctionRequest = body.correctionRequest?.trim() ?? "";
    if (!returnReason || !correctionRequest)
      throw new BadRequestException(
        "Motivo da devolução e correção solicitada são obrigatórios.",
      );
    return this.db.$transaction(async (tx) => {
      const purchase = await tx.greenCoffeePurchase.findFirst({
        where: { id, companyId: actor.companyId },
      });
      if (!purchase) throw new NotFoundException("Compra não encontrada.");
      await this.requireApprover(tx, purchase.companyId, actor);
      if (purchase.approvalStatus !== PurchaseApprovalStatus.PENDING_APPROVAL)
        throw new BadRequestException(
          "Somente compras pendentes de aprovação podem ser devolvidas para ajuste.",
        );
      const result = await tx.greenCoffeePurchase.update({
        where: { id },
        data: {
          approvalStatus: PurchaseApprovalStatus.DRAFT,
          operationalStatus: PurchaseOperationalStatus.NOT_STARTED,
          status: GreenCoffeePurchaseStatus.DRAFT,
          returnedByUserId: actor.userId,
          returnedAt: new Date(),
          returnReason,
          correctionRequest,
        },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: purchase.companyId,
          purchaseId: id,
          action: "PURCHASE_RETURNED_FOR_ADJUSTMENT",
          actorId: actor.userId,
          actorName: actor.userName,
          metadata: { returnReason, correctionRequest },
        },
      });
      return result;
    });
  }

  @Patch("approvals/:id/decision")
  async decide(
    @Param("id") id: string,
    @Body()
    body: {
      decision: GreenCoffeeApprovalStatus;
      userId: string;
      userName: string;
      userRole: string;
      justification: string;
    },
    @Req() requestContext: any,
  ) {
    if (!body.justification)
      throw new BadRequestException("Decisão exige justificativa.");
    const session = await this.sessionActor(requestContext);
    return this.db.$transaction(async (tx) => {
      const request = await tx.greenCoffeeApprovalRequest.findUnique({
        where: { id },
        include: { receipt: true },
      });
      if (!request) throw new NotFoundException("Aprovação não encontrada.");
      if (request.companyId !== session.companyId)
        throw new ForbiddenException("Acesso negado para esta empresa.");
      if (request.status !== GreenCoffeeApprovalStatus.PENDING)
        throw new BadRequestException("Solicitação já decidida.");
      const actor = await tx.user.findFirst({
        where: {
          id: session.userId,
          companyId: session.companyId,
          active: true,
        },
      });
      if (!actor || !canApprove(actor.role))
        throw new BadRequestException(
          "Somente Diretor ou Administrador ativo pode decidir.",
        );
      const decided = await tx.greenCoffeeApprovalRequest.update({
        where: { id },
        data: {
          status: body.decision,
          decidedById: actor.id,
          decidedByName: actor.name,
          justification: body.justification,
          decidedAt: new Date(),
        },
      });
      await tx.greenCoffeeReceipt.update({
        where: { id: request.receiptId },
        data: { approvalStatus: body.decision },
      });
      await tx.greenCoffeeAuditEvent.create({
        data: {
          companyId: request.companyId,
          purchaseId: request.purchaseId,
          receiptId: request.receiptId,
          action: `APPROVAL_${body.decision}`,
          actorId: actor.id,
          actorName: actor.name,
          metadata: { justification: body.justification },
        },
      });
      return decided;
    });
  }

  private validate(body: PurchaseBody) {
    if (
      !body.companyId ||
      !body.supplierId ||
      !body.buyerId ||
      !body.harvest ||
      !body.originRegion ||
      !body.species ||
      !body.qualityCategory ||
      body.contractedWeightKg <= 0 ||
      body.totalValue <= 0
    )
      throw new BadRequestException("Preencha os campos obrigatórios.");
    if (!body.installments?.length)
      throw new BadRequestException("Informe ao menos uma parcela.");
    if (
      body.maxMoisturePercent !== undefined &&
      body.maxMoisturePercent !== null &&
      (body.maxMoisturePercent < 10 || body.maxMoisturePercent > 12.5)
    )
      throw new BadRequestException(
        "A umidade máxima deve estar entre 10,0% e 12,5%.",
      );
    const amount = money(
      body.installments.reduce((sum, item) => sum + item.amount, 0),
    );
    const percentage = money(
      body.installments.reduce((sum, item) => sum + item.percentage, 0),
    );
    if (amount !== money(body.totalValue) || Math.abs(percentage - 100) > 0.01)
      throw new BadRequestException(
        "Parcelas devem somar exatamente 100% e o valor contratado.",
      );
  }

  private async resolveReferences(
    tx: Prisma.TransactionClient,
    body: PurchaseBody,
    companyId: string,
  ) {
    if (body.originUnitId) {
      const unit = await tx.supplierOriginUnit.findFirst({
        where: {
          id: body.originUnitId,
          supplierId: body.supplierId,
          state: body.state,
          active: true,
          supplier: { companyId, active: true },
        },
        include: { coffeeRegion: true },
      });
      if (!unit)
        throw new BadRequestException(
          "Unidade/fazenda inválida para o fornecedor e estado selecionados.",
        );
      if (
        unit.coffeeRegionId &&
        body.coffeeRegionId &&
        unit.coffeeRegionId !== body.coffeeRegionId
      )
        throw new BadRequestException(
          "A região deve corresponder à unidade/fazenda selecionada.",
        );
    }
    const species = body.speciesId
      ? await tx.coffeeSpecies.findFirst({
          where: { id: body.speciesId, companyId, active: true },
        })
      : await tx.coffeeSpecies.findFirst({
          where: { companyId, code: body.species, active: true },
        });
    if (!species)
      throw new BadRequestException("Espécie inválida para a empresa.");
    const cultivar = body.cultivarId
      ? await tx.coffeeVariety.findFirst({
          where: { id: body.cultivarId, speciesId: species.id, active: true },
        })
      : body.variety
        ? await tx.coffeeVariety.findFirst({
            where: { speciesId: species.id, code: body.variety, active: true },
          })
        : null;
    if (body.cultivarId && !cultivar)
      throw new BadRequestException(
        "Cultivar inválida para a espécie selecionada.",
      );
    const region = body.coffeeRegionId
      ? await tx.coffeeRegion.findFirst({
          where: { id: body.coffeeRegionId, companyId, active: true },
        })
      : body.originRegion
        ? await tx.coffeeRegion.findFirst({
            where: {
              companyId,
              name: body.originRegion,
              ...(body.state ? { state: body.state } : {}),
              active: true,
            },
          })
        : null;
    if (body.coffeeRegionId && !region)
      throw new BadRequestException("Região cafeeira inválida para a empresa.");
    const screen = body.screenClassificationId
      ? await tx.screenClassification.findFirst({
          where: { id: body.screenClassificationId, companyId, active: true },
        })
      : body.contractedScreen
        ? await tx.screenClassification.findFirst({
            where: { companyId, name: body.contractedScreen, active: true },
          })
        : null;
    if (body.screenClassificationId && !screen)
      throw new BadRequestException(
        "Classificação de peneira inválida para a empresa.",
      );
    return {
      speciesId: species.id,
      cultivarId: cultivar?.id,
      coffeeRegionId: region?.id,
      screenClassificationId: screen?.id,
      originUnitId: body.originUnitId,
    };
  }

  private async commitInstallments(
    tx: Prisma.TransactionClient,
    purchaseId: string,
  ) {
    const purchase = await tx.greenCoffeePurchase.findUnique({
      where: { id: purchaseId },
      include: { installments: true },
    });
    if (!purchase) throw new NotFoundException("Compra não encontrada.");
    for (const installment of purchase.installments) {
      if (installment.accountsPayableId) continue;
      const payable = await tx.accountsPayable.create({
        data: {
          companyId: purchase.companyId,
          supplierId: purchase.supplierId,
          description: `${purchase.purchaseNumber} · parcela ${installment.installmentNumber}`,
          issueDate: purchase.purchasedAt,
          dueDate: installment.dueDate,
          amount: installment.amount,
          openAmount: installment.amount,
          purchaseId: purchase.id,
          category: "COMPRA_CAFE_VERDE",
          notes: `Gerado automaticamente pela aprovação da compra ${purchase.purchaseNumber}`,
        },
      });
      await tx.greenCoffeePurchaseInstallment.update({
        where: { id: installment.id },
        data: {
          status: PurchaseInstallmentStatus.COMMITTED,
          accountsPayableId: payable.id,
        },
      });
    }
    await tx.greenCoffeeAuditEvent.create({
      data: {
        companyId: purchase.companyId,
        purchaseId: purchase.id,
        action: "FINANCIAL_COMMITMENT_CREATED",
        actorId: purchase.createdByUserId,
        actorName: purchase.createdByName,
        metadata: { installmentCount: purchase.installments.length },
      },
    });
  }

  private async requireApprover(
    tx: Prisma.TransactionClient,
    companyId: string,
    actor: Actor,
  ) {
    const user = await tx.user.findFirst({
      where: { id: actor.userId, companyId, active: true },
    });
    if (!user || !canApprove(user.role))
      throw new ForbiddenException(
        "Somente Diretor ou Administrador ativo pode aprovar.",
      );
    return user;
  }

  private async sessionActor(request: any): Promise<Actor> {
    const user = await this.auth.resolve(this.auth.readToken(request));
    if (!user) throw new ForbiddenException("Sessão autenticada obrigatória.");
    return {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      companyId: user.companyId,
    };
  }

  private view(row: any) {
    const returnEvent = row.auditEvents?.find(
      (event: any) => event.action === "PURCHASE_RETURNED_FOR_ADJUSTMENT",
    );
    const receivedKg =
      row.receipts?.reduce(
        (sum: number, receipt: any) => sum + Number(receipt.netWeightKg),
        0,
      ) ?? 0;
    const installments = row.installments ?? [];
    const committed = installments
      .filter((item: any) => ["COMMITTED", "PAID"].includes(item.status))
      .reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    const paid = installments.reduce(
      (sum: number, item: any) =>
        sum +
        (item.accountsPayable?.payments?.reduce(
          (paymentSum: number, payment: any) =>
            paymentSum + Number(payment.amount),
          0,
        ) ?? 0),
      0,
    );
    const financialStatus =
      row.approvalStatus === "REJECTED" || row.operationalStatus === "CANCELLED"
        ? "CANCELLED"
        : committed <= 0
          ? "NOT_COMMITTED"
          : paid <= 0
            ? "SCHEDULED"
            : paid < committed
              ? "PARTIALLY_PAID"
              : "PAID";
    const next = installments
      .filter(
        (item: any) =>
          item.status === "COMMITTED" &&
          (!item.accountsPayable ||
            Number(item.accountsPayable.openAmount) > 0),
      )
      .sort((a: any, b: any) => +new Date(a.dueDate) - +new Date(b.dueDate))[0];
    return {
      ...row,
      contractedWeightKg: Number(row.contractedWeightKg),
      totalValue: Number(row.totalValue),
      brokerCommissionPercent:
        row.brokerCommissionPercent == null
          ? null
          : Number(row.brokerCommissionPercent),
      brokerCommissionAmount:
        row.brokerCommissionAmount == null
          ? null
          : Number(row.brokerCommissionAmount),
      receivedKg,
      receivedPercent: Number(row.contractedWeightKg)
        ? Math.min(100, (receivedKg / Number(row.contractedWeightKg)) * 100)
        : 0,
      balanceKg: Math.max(0, Number(row.contractedWeightKg) - receivedKg),
      financialStatus,
      financial: {
        contracted: Number(row.totalValue),
        brokerCommission: row.brokerCommissionAmount == null ? 0 : Number(row.brokerCommissionAmount),
        totalCost: Number(row.totalValue) + (row.brokerCommissionAmount == null ? 0 : Number(row.brokerCommissionAmount)),
        committed,
        paid,
        balance: Math.max(0, Number(row.totalValue) - paid),
        nextPayment: next
          ? { dueDate: next.dueDate, amount: Number(next.amount) }
          : null,
      },
      externalAcceptanceStatus: row.externalAcceptanceStatus ?? "NOT_SENT",
      returnedByName: returnEvent?.actorName ?? null,
      externalAcceptance: row.externalAcceptances?.[0]
        ? {
            id: row.externalAcceptances[0].id,
            status: row.externalAcceptances[0].status,
            channel: row.externalAcceptances[0].channel,
            destinationMasked: row.externalAcceptances[0].destinationMasked,
            contactName: row.externalAcceptances[0].contactName,
            contactRole: row.externalAcceptances[0].contactRole,
            sentAt: row.externalAcceptances[0].sentAt,
            viewedAt: row.externalAcceptances[0].viewedAt,
            acceptedAt: row.externalAcceptances[0].acceptedAt,
            termsVersion: row.externalAcceptances[0].termsVersion,
            snapshot: row.externalAcceptances[0].snapshot,
            acceptedByName: row.externalAcceptances[0].acceptedByName,
            acceptedByRole: row.externalAcceptances[0].acceptedByRole,
            documentHash: row.externalAcceptances[0].documentHash,
          }
        : null,
    };
  }

  private acceptanceSnapshot(purchase: any) {
    return {
      purchaseNumber: purchase.purchaseNumber,
      companyId: purchase.companyId,
      company: { name: "Bispo Coffees" },
      supplier: {
        name: purchase.supplier.name,
        taxId: purchase.supplier.taxId,
        farmName: purchase.farmName ?? purchase.supplier.farmName,
        municipality: purchase.municipality ?? purchase.supplier.city,
        state: purchase.state ?? purchase.supplier.state,
      },
      coffee: {
        species: purchase.species,
        harvest: purchase.harvest,
        variety: purchase.variety,
        process: purchase.process,
        originRegion: purchase.originRegion,
      },
      specification: {
        qualityCategory: purchase.qualityCategory,
        contractedScreen: purchase.contractedScreen,
        maxDefects: purchase.maxDefects,
        maxMoisturePercent: purchase.maxMoisturePercent,
        minimumScore: purchase.minimumScore,
        additionalSpecification: purchase.additionalSpecification,
      },
      quantity: {
        packagingType: purchase.packagingType,
        volumeQuantity: purchase.volumeQuantity,
        nominalUnitWeightKg: Number(purchase.nominalUnitWeightKg),
        contractedWeightKg: Number(purchase.contractedWeightKg),
        tolerancePercent: Number(purchase.weightTolerancePercent),
      },
      commercial: {
        pricePerKg: purchase.pricePerKg ? Number(purchase.pricePerKg) : null,
        totalValue: Number(purchase.totalValue),
        broker: purchase.broker
          ? {
              id: purchase.broker.id,
              name: purchase.broker.name,
              commissionPercent: purchase.brokerCommissionPercent == null ? null : Number(purchase.brokerCommissionPercent),
              commissionAmount: purchase.brokerCommissionAmount == null ? null : Number(purchase.brokerCommissionAmount),
            }
          : null,
        currency: purchase.currency,
        expectedAt: purchase.expectedAt,
        contractReference: purchase.contractReference,
      },
      payment: {
        type: purchase.paymentTermType,
        installments: purchase.installments?.map((item: any) => ({
          number: item.installmentNumber,
          amount: Number(item.amount),
          dueDate: item.dueDate,
        })),
      },
      terms: {
        version: purchase.termsVersion,
        documentUrl: purchase.termsDocumentUrl,
        acceptanceConditionText:
          purchase.acceptanceConditionText ?? DEFAULT_ACCEPTANCE_TEXT,
      },
    };
  }
}
