import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash, randomUUID } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { request as httpsRequest } from "node:https";
import { parseInboundNfe, type ParsedInboundNfe } from "./nfe-inbound";

type Actor = { id: string; name: string; companyId: string };

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const decodeXml = (value: string) => value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim();
const tag = (xml: string, name: string) => {
  const safe = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const value = xml.match(new RegExp(`<(?:[A-Za-z0-9_]+:)?${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${safe}>`, "i"))?.[1];
  return value === undefined ? null : decodeXml(value.replace(/<[^>]+>/g, ""));
};
const decimal = (value: string | null) => {
  const parsed = Number(String(value ?? "0").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const nsu = (value: string | number | null | undefined) => String(value ?? "0").replace(/\D/g, "").padStart(15, "0").slice(-15);

@Injectable()
export class FiscalInboundService {
  private readonly database = new PrismaClient();
  private readonly logger = new Logger(FiscalInboundService.name);

  readiness() {
    const intervalMinutes = Math.max(5, Number(process.env.NFE_DFE_SYNC_INTERVAL_MINUTES ?? 15) || 15);
    return {
      provider: "SEFAZ_DFE",
      configured: Boolean(process.env.NFE_DFE_PFX_BASE64?.trim() && process.env.NFE_DFE_PFX_PASSWORD?.trim()),
      environment: process.env.NFE_DFE_ENVIRONMENT === "homologation" ? "HOMOLOGATION" : "PRODUCTION",
      certificateExposed: false,
      automaticCapture: process.env.NFE_DFE_AUTO_SYNC === "true",
      intervalMinutes,
    };
  }

  async list(companyId: string) {
    const documents = await this.database.$queryRawUnsafe<any[]>(
      `SELECT f.id,f.status,f.number,f.series,f."accessKey",f."issueDate",f."operationDate",
              f."supplierId",f."totalAmount",f.source,f."issuerTaxId",f."issuerName",
              f."recipientTaxId",f."productsAmount",f."freightAmount",f."discountAmount",
              f."validationIssues",f."matchStatus",f."importedAt",f."authorizationProtocol",
              s.name AS "supplierName",
              COUNT(DISTINCT i.id)::int AS "itemCount",
              COUNT(DISTINCT a.id)::int AS "allocationCount",
              COUNT(DISTINCT a."purchaseId")::int AS "purchaseCount",
              ARRAY_REMOVE(ARRAY_AGG(DISTINCT a."purchaseId"),NULL) AS "purchaseIds"
         FROM "FiscalDocument" f
         LEFT JOIN "Supplier" s ON s.id=f."supplierId"
         LEFT JOIN "FiscalDocumentItem" i ON i."fiscalDocumentId"=f.id
         LEFT JOIN "FiscalDocumentAllocation" a ON a."fiscalDocumentId"=f.id
        WHERE f."companyId"=$1 AND f.direction='INBOUND'
        GROUP BY f.id,s.name
        ORDER BY COALESCE(f."importedAt",f."createdAt") DESC`,
      companyId,
    );
    const state = await this.state(companyId);
    return { documents, distribution: state, readiness: this.readiness() };
  }

  async detail(companyId: string, id: string) {
    const documents = await this.database.$queryRawUnsafe<any[]>(
      `SELECT f.*,s.name AS "supplierName" FROM "FiscalDocument" f
       LEFT JOIN "Supplier" s ON s.id=f."supplierId"
       WHERE f.id=$1 AND f."companyId"=$2 AND f.direction='INBOUND' LIMIT 1`, id, companyId,
    );
    if (!documents[0]) throw new BadRequestException("Nota fiscal de entrada não encontrada.");
    const [items, allocations, candidates, events, costCenters, packagingMaterials] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "FiscalDocumentItem" WHERE "fiscalDocumentId"=$1 ORDER BY "itemNumber"`, id),
      this.database.$queryRawUnsafe<any[]>(`SELECT a.*,p."purchaseNumber",p."totalValue" AS "purchaseTotal",p."contractedWeightKg",c.code AS "costCenterCode",c.name AS "costCenterName" FROM "FiscalDocumentAllocation" a LEFT JOIN "GreenCoffeePurchase" p ON p.id=a."purchaseId" LEFT JOIN "CostCenter" c ON c.id=a."costCenterId" WHERE a."fiscalDocumentId"=$1 ORDER BY a."createdAt"`, id),
      this.candidates(companyId, documents[0]),
      this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "FiscalDocumentEvent" WHERE "fiscalDocumentId"=$1 ORDER BY "occurredAt" DESC`, id),
      this.database.costCenter.findMany({ where: { companyId, active: true }, select: { id: true, code: true, name: true, category: true }, orderBy: [{ category: "asc" }, { name: "asc" }] }),
      this.database.$queryRawUnsafe<any[]>(`SELECT id,name,sku,category,unit FROM "PackagingMaterial" WHERE "companyId"=$1 AND active=TRUE ORDER BY name`, companyId).catch(() => []),
    ]);
    const document = { ...documents[0] };
    delete document.xmlContent;
    return { document, items, allocations, candidates, events, costCenters, packagingMaterials };
  }

  private async candidates(companyId: string, document: any) {
    if (!document.supplierId) return [];
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT p.id,p."purchaseNumber",p.status,p."operationalStatus",p."purchasedAt",p."totalValue",
              p."contractedWeightKg",p.species,p.variety,p."supplierLotCode",
              ABS(p."totalValue"-$3::numeric) AS "valueDifference"
         FROM "GreenCoffeePurchase" p
        WHERE p."companyId"=$1 AND p."supplierId"=$2
          AND p.status NOT IN ('CANCELLED','REJECTED')
        ORDER BY ABS(p."totalValue"-$3::numeric),p."purchasedAt" DESC LIMIT 12`,
      companyId, document.supplierId, Number(document.totalAmount ?? 0),
    );
  }

  async importXml(companyId: string, actor: Pick<Actor, "id" | "name">, xmlContent: string, source = "MANUAL_UPLOAD") {
    let parsed: ParsedInboundNfe;
    try { parsed = parseInboundNfe(xmlContent); }
    catch (error) { throw new BadRequestException(error instanceof Error ? error.message : "XML da NF-e inválido."); }
    return this.persistAuthorizedXml(companyId, actor, xmlContent, parsed, source);
  }

  private async persistAuthorizedXml(companyId: string, actor: Pick<Actor, "id" | "name">, xmlContent: string, parsed: ParsedInboundNfe, source: string) {
    const company = await this.database.company.findUnique({ where: { id: companyId }, select: { taxId: true } });
    if (!company) throw new BadRequestException("Empresa não encontrada.");
    const expectedRecipient = digits(company.taxId);
    if (expectedRecipient !== parsed.recipientTaxId) throw new BadRequestException("Esta NF-e não foi emitida para o CNPJ da empresa ativa no BBOS.");

    const existing = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,status,"accessKey" FROM "FiscalDocument" WHERE "companyId"=$1 AND "accessKey"=$2 LIMIT 1`, companyId, parsed.accessKey,
    );
    const supplier = await this.database.supplier.findFirst({ where: { companyId, taxId: { not: null } }, select: { id: true, taxId: true, name: true } }).then(async (first) => {
      if (first && digits(first.taxId) === parsed.issuerTaxId) return first;
      const all = await this.database.supplier.findMany({ where: { companyId }, select: { id: true, taxId: true, name: true } });
      return all.find((row) => digits(row.taxId) === parsed.issuerTaxId) ?? null;
    });
    const issues = supplier ? [] : [{ code: "SUPPLIER_NOT_FOUND", severity: "ATTENTION", message: "Emitente ainda não está vinculado a um fornecedor do BBOS." }];
    const xmlHash = createHash("sha256").update(xmlContent).digest("hex");
    const id = existing[0]?.id ?? `fiscal-in-${randomUUID()}`;

    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(
        `INSERT INTO "FiscalDocument"
          (id,"companyId",direction,"documentType",status,number,series,"accessKey","issueDate","operationDate",
           "supplierId","totalAmount",source,"xmlContent","xmlHash","schemaVersion","authorizationProtocol",
           "issuerTaxId","issuerName","recipientTaxId","operationNature","productsAmount","freightAmount","discountAmount",
           "paymentSnapshot","validationIssues","matchStatus","importedById","importedByName","importedAt","createdAt","updatedAt")
         VALUES ($1,$2,'INBOUND','NFE','AUTHORIZED',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24,$25,$26,NOW(),NOW(),NOW())
         ON CONFLICT ("accessKey") WHERE "accessKey" IS NOT NULL DO UPDATE SET
           status='AUTHORIZED',number=EXCLUDED.number,series=EXCLUDED.series,"issueDate"=EXCLUDED."issueDate",
           "operationDate"=EXCLUDED."operationDate","supplierId"=COALESCE(EXCLUDED."supplierId","FiscalDocument"."supplierId"),
           "totalAmount"=EXCLUDED."totalAmount",source=EXCLUDED.source,"xmlContent"=EXCLUDED."xmlContent",
           "xmlHash"=EXCLUDED."xmlHash","schemaVersion"=EXCLUDED."schemaVersion","authorizationProtocol"=EXCLUDED."authorizationProtocol",
           "issuerTaxId"=EXCLUDED."issuerTaxId","issuerName"=EXCLUDED."issuerName","recipientTaxId"=EXCLUDED."recipientTaxId",
           "operationNature"=EXCLUDED."operationNature","productsAmount"=EXCLUDED."productsAmount",
           "freightAmount"=EXCLUDED."freightAmount","discountAmount"=EXCLUDED."discountAmount",
           "paymentSnapshot"=EXCLUDED."paymentSnapshot","validationIssues"=EXCLUDED."validationIssues",
           "importedById"=EXCLUDED."importedById","importedByName"=EXCLUDED."importedByName","importedAt"=NOW(),"updatedAt"=NOW()`,
        id, companyId, parsed.number, parsed.series, parsed.accessKey,
        parsed.issueDate ? new Date(parsed.issueDate) : null, parsed.operationDate ? new Date(parsed.operationDate) : null,
        supplier?.id ?? null, parsed.totalAmount, source, xmlContent, xmlHash, parsed.schemaVersion,
        parsed.authorizationProtocol, parsed.issuerTaxId, parsed.issuerName, parsed.recipientTaxId,
        parsed.operationNature, parsed.productsAmount, parsed.freightAmount, parsed.discountAmount,
        JSON.stringify(parsed.payments), JSON.stringify(issues), "UNMATCHED", actor.id, actor.name,
      );
      for (const item of parsed.items) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO "FiscalDocumentItem"
            (id,"fiscalDocumentId","itemNumber","supplierProductCode",description,ncm,cest,cfop,"commercialUnit",quantity,"unitValue","totalValue","freightAmount","discountAmount","taxSnapshot","rawSnapshot")
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::jsonb,$16::jsonb)
           ON CONFLICT ("fiscalDocumentId","itemNumber") DO UPDATE SET
             "supplierProductCode"=EXCLUDED."supplierProductCode",description=EXCLUDED.description,ncm=EXCLUDED.ncm,cest=EXCLUDED.cest,cfop=EXCLUDED.cfop,
             "commercialUnit"=EXCLUDED."commercialUnit",quantity=EXCLUDED.quantity,"unitValue"=EXCLUDED."unitValue","totalValue"=EXCLUDED."totalValue",
             "freightAmount"=EXCLUDED."freightAmount","discountAmount"=EXCLUDED."discountAmount","taxSnapshot"=EXCLUDED."taxSnapshot","rawSnapshot"=EXCLUDED."rawSnapshot"`,
          `fiscal-item-${randomUUID()}`, id, item.itemNumber, item.supplierProductCode, item.description,
          item.ncm, item.cest, item.cfop, item.commercialUnit, item.quantity, item.unitValue,
          item.totalValue, item.freightAmount, item.discountAmount, JSON.stringify(item.taxSnapshot), JSON.stringify(item.rawSnapshot),
        );
      }
      if (parsed.items.length > 0) {
        const itemNumbers = parsed.items.map((item) => Number(item.itemNumber)).filter(Number.isInteger).join(",");
        if (itemNumbers) await transaction.$executeRawUnsafe(`DELETE FROM "FiscalDocumentItem" WHERE "fiscalDocumentId"=$1 AND "itemNumber" NOT IN (${itemNumbers})`, id);
      }
      await transaction.$executeRawUnsafe(
        `INSERT INTO "FiscalDocumentEvent" (id,"fiscalDocumentId",type,source,"eventCode","protocolNumber",status,message,payload,"occurredAt")
         VALUES ($1,$2,'AUTHORIZATION',$3,'100',$4,'AUTHORIZED',$5,$6::jsonb,$7)
         ON CONFLICT DO NOTHING`,
        `fiscal-event-${randomUUID()}`, id, source, parsed.authorizationProtocol, parsed.authorizationMessage,
        JSON.stringify({ accessKey: parsed.accessKey, xmlHash }), parsed.issueDate ? new Date(parsed.issueDate) : new Date(),
      );
    });
    return { id, duplicate: Boolean(existing[0]), accessKey: parsed.accessKey, supplierMatched: Boolean(supplier), issues };
  }

  async matchPurchase(companyId: string, actor: Pick<Actor, "id" | "name">, documentId: string, purchaseId: string) {
    const [document, purchase, items] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "FiscalDocument" WHERE id=$1 AND "companyId"=$2 AND direction='INBOUND' LIMIT 1`, documentId, companyId),
      this.database.greenCoffeePurchase.findFirst({ where: { id: purchaseId, companyId }, include: { installments: true } }),
      this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "FiscalDocumentItem" WHERE "fiscalDocumentId"=$1 ORDER BY "itemNumber"`, documentId),
    ]);
    if (!document[0] || !purchase) throw new BadRequestException("Nota ou compra não encontrada.");
    if (document[0].supplierId && document[0].supplierId !== purchase.supplierId) throw new BadRequestException("A compra pertence a outro fornecedor.");
    const valueDifference = Math.abs(Number(document[0].totalAmount ?? 0) - Number(purchase.totalValue));
    const tolerance = Math.max(1, Number(purchase.totalValue) * 0.005);
    const matchSnapshot = { valueDifference, valueWithinTolerance: valueDifference <= tolerance, payableAction: "RECONCILE_ONLY", financialTitlesCreated: false };
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`DELETE FROM "FiscalDocumentAllocation" WHERE "fiscalDocumentId"=$1`, documentId);
      if (items.length === 0) {
        await transaction.$executeRawUnsafe(
          `INSERT INTO "FiscalDocumentAllocation" (id,"fiscalDocumentId","allocationType","purchaseId","allocatedAmount",status,"matchSnapshot","createdById","createdByName") VALUES ($1,$2,'GREEN_COFFEE_PURCHASE',$3,$4,'ALLOCATED',$5::jsonb,$6,$7)`,
          `fiscal-allocation-${randomUUID()}`, documentId, purchaseId, document[0].totalAmount, JSON.stringify(matchSnapshot), actor.id, actor.name,
        );
      } else {
        for (const item of items) await transaction.$executeRawUnsafe(
          `INSERT INTO "FiscalDocumentAllocation" (id,"fiscalDocumentId","fiscalDocumentItemId","allocationType","purchaseId","allocatedQuantity","allocatedAmount",status,"matchSnapshot","createdById","createdByName") VALUES ($1,$2,$3,'GREEN_COFFEE_PURCHASE',$4,$5,$6,'ALLOCATED',$7::jsonb,$8,$9)`,
          `fiscal-allocation-${randomUUID()}`, documentId, item.id, purchaseId, item.quantity, item.totalValue, JSON.stringify(matchSnapshot), actor.id, actor.name,
        );
      }
      await transaction.$executeRawUnsafe(`UPDATE "FiscalDocument" SET "supplierId"=COALESCE("supplierId",$2),"matchStatus"=$3,"updatedAt"=NOW() WHERE id=$1`, documentId, purchase.supplierId, valueDifference <= tolerance ? "MATCHED" : "DIVERGENT");
    });
    return { matched: true, matchStatus: valueDifference <= tolerance ? "MATCHED" : "DIVERGENT", valueDifference, accountsPayableCreated: false };
  }

  async allocateItem(companyId: string, actor: Pick<Actor, "id" | "name">, documentId: string, input: { itemId?: string; allocationType?: string; purchaseId?: string; costCenterId?: string; targetReferenceId?: string; category?: string; description?: string }) {
    const allowed = new Set(["GREEN_COFFEE_PURCHASE", "PACKAGING_MATERIAL", "GAS_ENERGY", "MAINTENANCE", "FIXED_ASSET", "SERVICE", "ADMINISTRATIVE_EXPENSE", "TAX", "OTHER"]);
    if (!input.itemId || !input.allocationType || !allowed.has(input.allocationType)) throw new BadRequestException("Informe o item e um destino válido.");
    const [document, item] = await Promise.all([
      this.database.$queryRawUnsafe<any[]>(`SELECT id,"supplierId" FROM "FiscalDocument" WHERE id=$1 AND "companyId"=$2 AND direction='INBOUND' LIMIT 1`, documentId, companyId),
      this.database.$queryRawUnsafe<any[]>(`SELECT i.* FROM "FiscalDocumentItem" i JOIN "FiscalDocument" f ON f.id=i."fiscalDocumentId" WHERE i.id=$1 AND i."fiscalDocumentId"=$2 AND f."companyId"=$3 LIMIT 1`, input.itemId, documentId, companyId),
    ]);
    if (!document[0] || !item[0]) throw new BadRequestException("Nota ou item fiscal não encontrado.");
    let purchase: any = null;
    if (input.allocationType === "GREEN_COFFEE_PURCHASE") {
      if (!input.purchaseId) throw new BadRequestException("Selecione a compra de café verde.");
      purchase = await this.database.greenCoffeePurchase.findFirst({ where: { id: input.purchaseId, companyId }, select: { id: true, supplierId: true } });
      if (!purchase || (document[0].supplierId && document[0].supplierId !== purchase.supplierId)) throw new BadRequestException("A compra selecionada não corresponde ao fornecedor da NF-e.");
    }
    if (input.costCenterId) {
      const costCenter = await this.database.costCenter.findFirst({ where: { id: input.costCenterId, companyId, active: true }, select: { id: true } });
      if (!costCenter) throw new BadRequestException("Centro de custo inválido.");
    }
    if (input.allocationType === "PACKAGING_MATERIAL" && input.targetReferenceId) {
      const materials = await this.database.$queryRawUnsafe<any[]>(`SELECT id FROM "PackagingMaterial" WHERE id=$1 AND "companyId"=$2 AND active=TRUE LIMIT 1`, input.targetReferenceId, companyId);
      if (!materials[0]) throw new BadRequestException("Material de embalagem inválido.");
    }
    await this.database.$transaction(async (transaction) => {
      await transaction.$executeRawUnsafe(`DELETE FROM "FiscalDocumentAllocation" WHERE "fiscalDocumentItemId"=$1`, input.itemId);
      await transaction.$executeRawUnsafe(
        `INSERT INTO "FiscalDocumentAllocation" (id,"fiscalDocumentId","fiscalDocumentItemId","allocationType","purchaseId","costCenterId","targetReferenceId",category,description,"allocatedQuantity","allocatedAmount",status,"matchSnapshot","createdById","createdByName") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'ALLOCATED',$12::jsonb,$13,$14)`,
        `fiscal-allocation-${randomUUID()}`, documentId, input.itemId, input.allocationType, purchase?.id ?? null, input.costCenterId || null, input.targetReferenceId || null,
        input.category?.trim() || null, input.description?.trim() || null, item[0].quantity, item[0].totalValue,
        JSON.stringify({ stockAction: "WAIT_FOR_PHYSICAL_RECEIPT", payableAction: "WAIT_FOR_FINANCIAL_CONFIRMATION" }), actor.id, actor.name,
      );
      const counts = await transaction.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS total,COUNT(a.id)::int AS allocated FROM "FiscalDocumentItem" i LEFT JOIN "FiscalDocumentAllocation" a ON a."fiscalDocumentItemId"=i.id WHERE i."fiscalDocumentId"=$1`, documentId);
      const status = Number(counts[0]?.allocated ?? 0) === 0 ? "UNMATCHED" : Number(counts[0]?.allocated ?? 0) >= Number(counts[0]?.total ?? 0) ? "ALLOCATED" : "PARTIAL";
      await transaction.$executeRawUnsafe(`UPDATE "FiscalDocument" SET "matchStatus"=$2,"updatedAt"=NOW() WHERE id=$1`, documentId, status);
    });
    return { allocated: true, stockMoved: false, accountsPayableCreated: false };
  }

  async state(companyId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(`SELECT * FROM "FiscalDistributionState" WHERE "companyId"=$1 AND provider='SEFAZ_DFE' LIMIT 1`, companyId).catch(() => []);
    return rows[0] ?? { status: "NOT_STARTED", lastNsu: nsu(0), maxNsu: nsu(0), lastSyncAt: null, lastError: null };
  }

  async sync(companyId: string, actor: Pick<Actor, "id" | "name">) {
    const readiness = this.readiness();
    if (!readiness.configured) throw new BadRequestException("A captura automática aguarda a instalação do certificado digital A1 da Bispo Coffees.");
    const company = await this.database.company.findUnique({ where: { id: companyId }, select: { taxId: true } });
    const companyTaxId = digits(company?.taxId);
    if (companyTaxId.length !== 14) throw new BadRequestException("O CNPJ da empresa no BBOS é inválido para consultar a SEFAZ.");
    const current = await this.state(companyId);
    await this.upsertState(companyId, { status: "SYNCING", lastError: null });
    try {
      const response = await this.distribute(companyTaxId, nsu(current.lastNsu));
      let imported = 0;
      let summaries = 0;
      for (const document of response.documents) {
        if (/procNFe|nfeProc/i.test(document.schema) || /<nfeProc\b/i.test(document.xml)) {
          await this.importXml(companyId, actor, document.xml, "SEFAZ_DFE");
          imported += 1;
        } else if (/resNFe/i.test(document.schema) || /<resNFe\b/i.test(document.xml)) {
          await this.persistSummary(companyId, actor, document.xml, document.nsu);
          summaries += 1;
        }
      }
      await this.upsertState(companyId, { status: "IDLE", lastNsu: response.lastNsu, maxNsu: response.maxNsu, lastSyncAt: new Date(), nextSyncAt: new Date(Date.now() + this.readiness().intervalMinutes * 60_000), lastError: null });
      return { imported, summaries, lastNsu: response.lastNsu, maxNsu: response.maxNsu, hasMore: response.lastNsu !== response.maxNsu };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha na consulta da SEFAZ.";
      await this.upsertState(companyId, { status: "ERROR", lastError: message, lastSyncAt: new Date(), nextSyncAt: new Date(Date.now() + 30 * 60_000) });
      throw new BadRequestException(message);
    }
  }

  async syncConfiguredCompanies() {
    if (process.env.NFE_DFE_AUTO_SYNC !== "true" || !this.readiness().configured) return;
    const companies = await this.database.company.findMany({ select: { id: true } });
    for (const company of companies) {
      const state = await this.state(company.id);
      if (state.status === "SYNCING" || (state.nextSyncAt && new Date(state.nextSyncAt).getTime() > Date.now())) continue;
      try { await this.sync(company.id, { id: "SYSTEM", name: "Captura automática SEFAZ" }); }
      catch (error) { this.logger.error(error instanceof Error ? error.message : String(error)); }
    }
  }

  private async persistSummary(companyId: string, actor: Pick<Actor, "id" | "name">, xml: string, documentNsu: string) {
    const accessKey = digits(tag(xml, "chNFe"));
    if (accessKey.length !== 44) return;
    const issuerTaxId = digits(tag(xml, "CNPJ") ?? tag(xml, "CPF"));
    const suppliers = await this.database.supplier.findMany({ where: { companyId }, select: { id: true, taxId: true } });
    const supplier = suppliers.find((row) => digits(row.taxId) === issuerTaxId);
    const issues = [{ code: "FULL_XML_PENDING", severity: "INFO", message: "NF-e encontrada. O XML completo ainda depende da distribuição/manifestação fiscal." }];
    await this.database.$executeRawUnsafe(
      `INSERT INTO "FiscalDocument" (id,"companyId",direction,"documentType",status,"accessKey","issueDate","supplierId","totalAmount",source,"issuerTaxId","issuerName","recipientTaxId","validationIssues","matchStatus","importedById","importedByName","importedAt","payloadSnapshot","createdAt","updatedAt")
       VALUES ($1,$2,'INBOUND','NFE','PENDING',$3,$4,$5,$6,'SEFAZ_DFE',$7,$8,$9,$10::jsonb,'UNMATCHED',$11,$12,NOW(),$13::jsonb,NOW(),NOW())
       ON CONFLICT ("accessKey") WHERE "accessKey" IS NOT NULL DO UPDATE SET "supplierId"=COALESCE(EXCLUDED."supplierId","FiscalDocument"."supplierId"),"issuerTaxId"=EXCLUDED."issuerTaxId","issuerName"=EXCLUDED."issuerName","totalAmount"=EXCLUDED."totalAmount","payloadSnapshot"=EXCLUDED."payloadSnapshot","updatedAt"=NOW()`,
      `fiscal-summary-${randomUUID()}`, companyId, accessKey, tag(xml, "dhEmi") ? new Date(String(tag(xml, "dhEmi"))) : null,
      supplier?.id ?? null, decimal(tag(xml, "vNF")), issuerTaxId, tag(xml, "xNome") ?? "Emitente não informado", null,
      JSON.stringify(issues), actor.id, actor.name, JSON.stringify({ nsu: documentNsu, summaryXml: xml }),
    );
  }

  private async upsertState(companyId: string, values: Record<string, unknown>) {
    const current = await this.state(companyId);
    await this.database.$executeRawUnsafe(
      `INSERT INTO "FiscalDistributionState" (id,"companyId",provider,environment,"lastNsu","maxNsu",status,"lastSyncAt","nextSyncAt","lastError","createdAt","updatedAt")
       VALUES ($1,$2,'SEFAZ_DFE',$3,$4,$5,$6,$7,$8,$9,NOW(),NOW())
       ON CONFLICT ("companyId",provider) DO UPDATE SET environment=EXCLUDED.environment,"lastNsu"=EXCLUDED."lastNsu","maxNsu"=EXCLUDED."maxNsu",status=EXCLUDED.status,"lastSyncAt"=EXCLUDED."lastSyncAt","nextSyncAt"=EXCLUDED."nextSyncAt","lastError"=EXCLUDED."lastError","updatedAt"=NOW()`,
      `fiscal-distribution-${companyId}`, companyId, this.readiness().environment,
      values.lastNsu ?? current.lastNsu, values.maxNsu ?? current.maxNsu, values.status ?? current.status,
      values.lastSyncAt === undefined ? current.lastSyncAt : values.lastSyncAt,
      values.nextSyncAt === undefined ? current.nextSyncAt : values.nextSyncAt,
      values.lastError === undefined ? current.lastError : values.lastError,
    );
  }

  private distribute(companyTaxId: string, lastNsu: string) {
    const production = process.env.NFE_DFE_ENVIRONMENT !== "homologation";
    const endpoint = process.env.NFE_DFE_ENDPOINT?.trim() || (production
      ? "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx"
      : "https://hom.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx");
    const ufCode = String(process.env.NFE_DFE_UF_CODE ?? "41").replace(/\D/g, "");
    const dist = `<distDFeInt xmlns="http://www.portalfiscal.inf.br/nfe" versao="1.01"><tpAmb>${production ? "1" : "2"}</tpAmb><cUFAutor>${ufCode}</cUFAutor><CNPJ>${companyTaxId}</CNPJ><distNSU><ultNSU>${lastNsu}</ultNSU></distNSU></distDFeInt>`;
    const envelope = `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDistDFeInteresse xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe"><nfeDadosMsg>${dist}</nfeDadosMsg></nfeDistDFeInteresse></soap12:Body></soap12:Envelope>`;
    const certificate = Buffer.from(String(process.env.NFE_DFE_PFX_BASE64), "base64");
    const passphrase = String(process.env.NFE_DFE_PFX_PASSWORD);
    return new Promise<{ lastNsu: string; maxNsu: string; documents: Array<{ nsu: string; schema: string; xml: string }> }>((resolve, reject) => {
      const url = new URL(endpoint);
      const req = httpsRequest({ hostname: url.hostname, port: url.port || 443, path: `${url.pathname}${url.search}`, method: "POST", pfx: certificate, passphrase, headers: { "content-type": "application/soap+xml; charset=utf-8; action=\"http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse\"", "content-length": Buffer.byteLength(envelope), "user-agent": "BBOS/1.0" }, timeout: 30_000 }, (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
        response.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          if ((response.statusCode ?? 500) >= 400) return reject(new Error(`SEFAZ respondeu HTTP ${response.statusCode}.`));
          const statusCode = tag(body, "cStat") ?? "";
          if (!["137", "138"].includes(statusCode)) return reject(new Error(`SEFAZ: ${tag(body, "xMotivo") ?? `status ${statusCode || "desconhecido"}`}.`));
          try {
            const documents = [...body.matchAll(/<docZip\b([^>]*)>([\s\S]*?)<\/docZip>/gi)].map((match) => {
              const attrs = match[1] ?? "";
              const documentNsu = attrs.match(/NSU=["']([^"']+)["']/i)?.[1] ?? "";
              const schema = attrs.match(/schema=["']([^"']+)["']/i)?.[1] ?? "";
              const zipped = Buffer.from(decodeXml(match[2] ?? ""), "base64");
              return { nsu: documentNsu, schema, xml: gunzipSync(zipped).toString("utf8") };
            });
            resolve({ lastNsu: nsu(tag(body, "ultNSU")), maxNsu: nsu(tag(body, "maxNSU")), documents });
          } catch { reject(new Error("A resposta da SEFAZ contém um documento fiscal inválido.")); }
        });
      });
      req.on("timeout", () => req.destroy(new Error("A consulta da SEFAZ excedeu o tempo limite.")));
      req.on("error", (error) => reject(error));
      req.end(envelope);
    });
  }
}
