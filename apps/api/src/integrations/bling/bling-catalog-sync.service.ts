import { Injectable } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";
import {
  resolveSampleFiscalRoute,
  SAMPLE_CFOP_INTER,
  SAMPLE_CFOP_INTRA,
  SAMPLE_FISCAL_POLICY_VERSION,
} from "../../sample-fiscal-route";
import { resolveExportFiscalRoute } from "../../export-fiscal-route";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

const DEFAULT_NCM = "09012100";
export const BLING_CATALOG_PRICE_BY_SLUG: Readonly<Record<string, number>> = {
  essencial: 52,
  intenso: 52,
  caramelo: 68,
  "doce-de-leite": 68,
  tangerina: 68,
  singular: 84,
  sublime: 84,
  raros: 54,
  "white-label-essencial": 19.5,
  "white-label-classico": 22,
  "white-label-frutado": 27.5,
  "white-label-raro": 38,
};

type CompanyFiscalProfile = {
  taxRegime: "LUCRO_REAL";
  pisCofinsRegime: "NAO_CUMULATIVO";
  state: string;
  cstIcms?: string | null;
  cstPis?: string | null;
  cstCofins?: string | null;
  cfopIntra?: string | null;
  cfopInter?: string | null;
  sampleCfopIntra: typeof SAMPLE_CFOP_INTRA;
  sampleCfopInter: typeof SAMPLE_CFOP_INTER;
  sampleNatureOperationId?: string | null;
  sampleNatureOperationName?: string | null;
  sampleValidatedByAccountant: boolean;
  sampleFiscalPolicyVersion: typeof SAMPLE_FISCAL_POLICY_VERSION;
  exportCfop?: string | null;
  exportNatureOperationId?: string | null;
  exportNatureOperationName?: string | null;
  exportDepartureLocation?: string | null;
  exportDepartureState?: string | null;
  exportValidatedByAccountant: boolean;
  notes?: string | null;
  validatedByAccountant: boolean;
};

type FiscalProfile = {
  ncm: string;
  origem: number;
  unidade: string;
  preco: number;
  pesoLiquido: number;
  pesoBruto: number;
  tipo: "P";
  situacao: "A" | "I";
  formato: "S";
  tipoProducao: "P" | "T";
  descricaoCurta: string;
  cest?: string | null;
};

@Injectable()
export class BlingCatalogSyncService {
  private readonly database = prisma;

  constructor(private readonly bling: BlingService) {}

  private async localCatalog(companyId: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT p.slug,p.name,pv.id AS "variantId",pv.sku,pv."netWeightGrams",
              COALESCE((
                SELECT pp.price
                  FROM "ProductPrice" pp
                 WHERE pp."companyId"=$1
                   AND pp."productVariantId"=pv.id
                   AND pp.active=true
                   AND pp."validFrom" <= NOW()
                   AND (pp."validUntil" IS NULL OR pp."validUntil" > NOW())
                 ORDER BY pp."validFrom" DESC,pp."updatedAt" DESC
                 LIMIT 1
              ),0) AS "catalogPrice"
         FROM "Product" p
         JOIN "ProductVariant" pv ON pv."productId"=p.id
        WHERE p.active=true AND pv.active=true
          AND NULLIF(TRIM(pv.sku),'') IS NOT NULL
        ORDER BY p.slug,pv."netWeightGrams"`,
      companyId,
    );
  }

  private catalogKey(row: any) {
    return String(row?.variantId ?? "").trim();
  }

  private mapForCatalogRow(maps: any[], row: any) {
    const variantId = this.catalogKey(row);
    const sku = String(row?.sku ?? "")
      .trim()
      .toUpperCase();
    const slug = String(row?.slug ?? "").trim();
    return (
      maps.find((map) => String(map.internalKey) === variantId) ??
      maps.find(
        (map) => String(map?.metadata?.productVariantId ?? "") === variantId,
      ) ??
      maps.find(
        (map) =>
          sku &&
          String(map?.metadata?.sku ?? "")
            .trim()
            .toUpperCase() === sku,
      ) ??
      maps.find(
        (map) =>
          String(map.internalKey) === slug &&
          (!map?.metadata?.sku ||
            String(map.metadata.sku).trim().toUpperCase() === sku),
      ) ??
      null
    );
  }

  private async resourceMaps(companyId: string, resourceType: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT "internalKey","externalId",metadata
         FROM "IntegrationResourceMap"
        WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"=$2`,
      companyId,
      resourceType,
    );
  }

  private async getResourceMap(
    companyId: string,
    resourceType: string,
    internalKey: string,
  ) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT "internalKey","externalId",metadata
         FROM "IntegrationResourceMap"
        WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"=$2 AND "internalKey"=$3
        LIMIT 1`,
      companyId,
      resourceType,
      internalKey,
    );
    return rows[0] ?? null;
  }

  private async saveResourceMap(
    companyId: string,
    resourceType: string,
    internalKey: string,
    externalId: string,
    metadata: unknown,
  ) {
    const id = `bling-map-${stableId(`${companyId}:${resourceType}:${internalKey}`)}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationResourceMap"
        (id,"companyId",provider,"resourceType","internalKey","externalId",metadata,"lastSyncedAt","createdAt","updatedAt")
       VALUES ($1,$2,'BLING',$3,$4,$5,$6::jsonb,NOW(),NOW(),NOW())
       ON CONFLICT ("companyId",provider,"resourceType","internalKey") DO UPDATE SET
         "externalId"=EXCLUDED."externalId",metadata=EXCLUDED.metadata,
         "lastSyncedAt"=NOW(),"updatedAt"=NOW()`,
      id,
      companyId,
      resourceType,
      internalKey,
      externalId,
      JSON.stringify(metadata ?? {}),
    );
  }

  private async saveMap(
    companyId: string,
    row: any,
    externalId: string,
    metadata: unknown,
  ) {
    return this.saveResourceMap(
      companyId,
      "STOREFRONT_PRODUCT",
      this.catalogKey(row),
      externalId,
      metadata,
    );
  }

  private defaultCompanyFiscalProfile(): CompanyFiscalProfile {
    return {
      taxRegime: "LUCRO_REAL",
      pisCofinsRegime: "NAO_CUMULATIVO",
      state: "PR",
      cstIcms: null,
      cstPis: null,
      cstCofins: null,
      cfopIntra: null,
      cfopInter: null,
      sampleCfopIntra: SAMPLE_CFOP_INTRA,
      sampleCfopInter: SAMPLE_CFOP_INTER,
      sampleNatureOperationId: null,
      sampleNatureOperationName: null,
      sampleValidatedByAccountant: false,
      sampleFiscalPolicyVersion: SAMPLE_FISCAL_POLICY_VERSION,
      exportCfop: null,
      exportNatureOperationId: null,
      exportNatureOperationName: null,
      exportDepartureLocation: null,
      exportDepartureState: "PR",
      exportValidatedByAccountant: false,
      notes:
        "CST, CFOP e alíquotas devem ser validados com a contabilidade antes da primeira NF-e real.",
      validatedByAccountant: false,
    };
  }

  async companyFiscalProfile(companyId: string) {
    const row = await this.getResourceMap(
      companyId,
      "COMPANY_FISCAL_PROFILE",
      "company",
    );
    const metadata =
      row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
    const usesCurrentSamplePolicy =
      metadata.sampleFiscalPolicyVersion === SAMPLE_FISCAL_POLICY_VERSION;
    return {
      ...this.defaultCompanyFiscalProfile(),
      ...metadata,
      taxRegime: "LUCRO_REAL",
      pisCofinsRegime: "NAO_CUMULATIVO",
      sampleCfopIntra: SAMPLE_CFOP_INTRA,
      sampleCfopInter: SAMPLE_CFOP_INTER,
      sampleFiscalPolicyVersion: SAMPLE_FISCAL_POLICY_VERSION,
      sampleValidatedByAccountant:
        usesCurrentSamplePolicy &&
        Boolean(metadata.sampleValidatedByAccountant),
    } as CompanyFiscalProfile;
  }

  async saveCompanyFiscalProfile(
    companyId: string,
    patch: Record<string, unknown>,
  ) {
    const current = await this.companyFiscalProfile(companyId);
    const next: CompanyFiscalProfile = {
      ...current,
      ...patch,
      taxRegime: "LUCRO_REAL",
      pisCofinsRegime: "NAO_CUMULATIVO",
      state: String(patch.state ?? current.state ?? "PR")
        .trim()
        .toUpperCase(),
      cstIcms:
        patch.cstIcms == null
          ? (current.cstIcms ?? null)
          : String(patch.cstIcms).trim() || null,
      cstPis:
        patch.cstPis == null
          ? (current.cstPis ?? null)
          : String(patch.cstPis).trim() || null,
      cstCofins:
        patch.cstCofins == null
          ? (current.cstCofins ?? null)
          : String(patch.cstCofins).trim() || null,
      cfopIntra:
        patch.cfopIntra == null
          ? (current.cfopIntra ?? null)
          : String(patch.cfopIntra).trim() || null,
      cfopInter:
        patch.cfopInter == null
          ? (current.cfopInter ?? null)
          : String(patch.cfopInter).trim() || null,
      sampleCfopIntra: SAMPLE_CFOP_INTRA,
      sampleCfopInter: SAMPLE_CFOP_INTER,
      sampleNatureOperationId:
        patch.sampleNatureOperationId == null
          ? (current.sampleNatureOperationId ?? null)
          : String(patch.sampleNatureOperationId).replace(/\D/g, "") || null,
      sampleNatureOperationName:
        patch.sampleNatureOperationName == null
          ? (current.sampleNatureOperationName ?? null)
          : String(patch.sampleNatureOperationName).trim() || null,
      sampleValidatedByAccountant: Boolean(
        patch.sampleValidatedByAccountant ??
        current.sampleValidatedByAccountant,
      ),
      sampleFiscalPolicyVersion: SAMPLE_FISCAL_POLICY_VERSION,
      exportCfop:
        patch.exportCfop == null
          ? (current.exportCfop ?? null)
          : String(patch.exportCfop).replace(/\D/g, "") || null,
      exportNatureOperationId:
        patch.exportNatureOperationId == null
          ? (current.exportNatureOperationId ?? null)
          : String(patch.exportNatureOperationId).replace(/\D/g, "") || null,
      exportNatureOperationName:
        patch.exportNatureOperationName == null
          ? (current.exportNatureOperationName ?? null)
          : String(patch.exportNatureOperationName).trim() || null,
      exportDepartureLocation:
        patch.exportDepartureLocation == null
          ? (current.exportDepartureLocation ?? null)
          : String(patch.exportDepartureLocation).trim() || null,
      exportDepartureState: String(
        patch.exportDepartureState ?? current.exportDepartureState ?? "PR",
      )
        .trim()
        .toUpperCase(),
      exportValidatedByAccountant: Boolean(
        patch.exportValidatedByAccountant ??
        current.exportValidatedByAccountant,
      ),
      notes:
        patch.notes == null
          ? (current.notes ?? null)
          : String(patch.notes).trim() || null,
      validatedByAccountant: Boolean(
        patch.validatedByAccountant ?? current.validatedByAccountant,
      ),
    };
    if (!/^[A-Z]{2}$/.test(next.state)) throw new Error("UF fiscal inválida.");
    for (const value of [next.cfopIntra, next.cfopInter]) {
      if (value && !/^\d{4}$/.test(value))
        throw new Error("CFOP deve conter 4 dígitos.");
    }
    if (next.sampleValidatedByAccountant && !next.sampleNatureOperationId) {
      throw new Error(
        "Selecione a natureza de operação de amostra do Bling antes de confirmar a validação contábil.",
      );
    }
    if (next.exportCfop && !/^7\d{3}$/.test(next.exportCfop)) {
      throw new Error("CFOP de exportação deve ter 4 dígitos e iniciar por 7.");
    }
    if (
      next.exportDepartureState &&
      !/^[A-Z]{2}$/.test(next.exportDepartureState)
    ) {
      throw new Error("UF de embarque inválida.");
    }
    if (next.exportValidatedByAccountant) resolveExportFiscalRoute(next);
    await this.saveResourceMap(
      companyId,
      "COMPANY_FISCAL_PROFILE",
      "company",
      companyId,
      next,
    );
    return next;
  }

  async sampleFiscalRoute(companyId: string, destinationState: unknown) {
    return resolveSampleFiscalRoute(
      await this.companyFiscalProfile(companyId),
      destinationState,
    );
  }

  async exportFiscalRoute(companyId: string) {
    return resolveExportFiscalRoute(await this.companyFiscalProfile(companyId));
  }

  async operationNatures(companyId: string) {
    const response = await this.bling.request(
      companyId,
      "/naturezas-operacoes?pagina=1&limite=100",
      { method: "GET" },
    );
    const rows = Array.isArray(response?.data) ? response.data : [];
    return rows
      .map((row: any) => ({
        id: String(row?.id ?? "").replace(/\D/g, ""),
        name: String(
          row?.descricao ?? row?.nome ?? row?.description ?? "",
        ).trim(),
        type: row?.tipo ?? row?.type ?? null,
      }))
      .filter((row: { id: string; name: string }) => row.id && row.name)
      .sort((left: { name: string }, right: { name: string }) =>
        left.name.localeCompare(right.name, "pt-BR"),
      );
  }

  private defaultProfile(row: any): FiscalProfile {
    const kg = Math.max(0.001, Number(row.netWeightGrams ?? 0) / 1000);
    const governedPrice = Number(row.catalogPrice ?? 0);
    return {
      ncm: DEFAULT_NCM,
      origem: 0,
      unidade: "UN",
      preco:
        governedPrice > 0
          ? governedPrice
          : (BLING_CATALOG_PRICE_BY_SLUG[String(row.slug)] ?? 0),
      pesoLiquido: kg,
      pesoBruto: kg,
      tipo: "P",
      situacao: "A",
      formato: "S",
      tipoProducao: "P",
      descricaoCurta: `${row.name} — café torrado`,
      cest: null,
    };
  }

  private normalizeProfile(row: any, metadata?: any): FiscalProfile {
    const base = this.defaultProfile(row);
    const source = metadata && typeof metadata === "object" ? metadata : {};
    return {
      ...base,
      ...source,
      ncm: String(source.ncm ?? base.ncm).replace(/\D/g, ""),
      origem: Number.isInteger(Number(source.origem))
        ? Number(source.origem)
        : base.origem,
      unidade: String(source.unidade ?? base.unidade)
        .trim()
        .toUpperCase(),
      preco: Number.isFinite(Number(source.preco))
        ? Number(source.preco)
        : base.preco,
      pesoLiquido: Number.isFinite(Number(source.pesoLiquido))
        ? Number(source.pesoLiquido)
        : base.pesoLiquido,
      pesoBruto: Number.isFinite(Number(source.pesoBruto))
        ? Number(source.pesoBruto)
        : base.pesoBruto,
      tipo: "P",
      formato: "S",
      situacao: source.situacao === "I" ? "I" : "A",
      tipoProducao: source.tipoProducao === "T" ? "T" : "P",
      descricaoCurta: String(
        source.descricaoCurta ?? base.descricaoCurta,
      ).trim(),
      cest: source.cest ? String(source.cest).replace(/\D/g, "") : null,
    };
  }

  private validateProfile(profile: FiscalProfile) {
    if (!/^\d{8}$/.test(profile.ncm))
      throw new Error("NCM deve conter exatamente 8 dígitos.");
    if (
      !Number.isInteger(profile.origem) ||
      profile.origem < 0 ||
      profile.origem > 8
    ) {
      throw new Error("Origem fiscal deve ser um código entre 0 e 8.");
    }
    if (profile.cest && !/^\d{7}$/.test(profile.cest))
      throw new Error("CEST deve conter 7 dígitos.");
    if (!profile.unidade || profile.unidade.length > 6)
      throw new Error("Unidade fiscal inválida.");
    if (!Number.isFinite(profile.preco) || profile.preco < 0)
      throw new Error("Preço de venda inválido.");
    if (!Number.isFinite(profile.pesoLiquido) || profile.pesoLiquido <= 0)
      throw new Error("Peso líquido inválido.");
    if (
      !Number.isFinite(profile.pesoBruto) ||
      profile.pesoBruto < profile.pesoLiquido
    ) {
      throw new Error("Peso bruto não pode ser menor que o peso líquido.");
    }
  }

  private productPayload(row: any, profile: FiscalProfile) {
    return {
      nome: row.name,
      tipo: profile.tipo,
      situacao: profile.situacao,
      formato: profile.formato,
      codigo: String(row.sku ?? "").trim(),
      preco: profile.preco,
      descricaoCurta: profile.descricaoCurta,
      unidade: profile.unidade,
      pesoLiquido: profile.pesoLiquido,
      pesoBruto: profile.pesoBruto,
      volumes: 1,
      itensPorCaixa: 1,
      tipoProducao: profile.tipoProducao,
      condicao: 0,
      freteGratis: false,
      marca: "Bispo Coffees",
      observacoes: `Criado e governado pelo BBOS · SKU ${row.sku}`,
      tributacao: {
        origem: profile.origem,
        ncm: profile.ncm,
        ...(profile.cest ? { cest: profile.cest } : {}),
      },
    };
  }

  private async fetchBlingProducts(companyId: string) {
    const products: any[] = [];
    for (let page = 1; page <= 20; page += 1) {
      const response = await this.bling.request(
        companyId,
        `/produtos?pagina=${page}&limite=100`,
        { method: "GET" },
      );
      const batch = Array.isArray(response?.data) ? response.data : [];
      products.push(...batch);
      if (batch.length < 100) break;
    }
    return products;
  }

  async status(companyId: string) {
    const [local, maps] = await Promise.all([
      this.localCatalog(companyId),
      this.resourceMaps(companyId, "STOREFRONT_PRODUCT"),
    ]);
    const items = local.map((row) => {
      const mapping = this.mapForCatalogRow(maps, row);
      return {
        catalogKey: this.catalogKey(row),
        variantId: row.variantId,
        slug: row.slug,
        name: row.name,
        sku: row.sku,
        weightGrams: Number(row.netWeightGrams),
        mapped: Boolean(mapping?.externalId),
        blingProductId: mapping?.externalId ?? null,
      };
    });
    return {
      total: items.length,
      mapped: items.filter((item) => item.mapped).length,
      missing: items.filter((item) => !item.mapped).map((item) => item.sku),
      ready: items.length > 0 && items.every((item) => item.mapped),
      items,
    };
  }

  async profiles(companyId: string) {
    const [local, profileMaps, productMaps, companyProfile] = await Promise.all(
      [
        this.localCatalog(companyId),
        this.resourceMaps(companyId, "STOREFRONT_PRODUCT_PROFILE"),
        this.resourceMaps(companyId, "STOREFRONT_PRODUCT"),
        this.companyFiscalProfile(companyId),
      ],
    );
    return {
      defaultNcm: DEFAULT_NCM,
      companyProfile,
      items: local.map((row) => {
        const productMap = this.mapForCatalogRow(productMaps, row);
        const profileMap = this.mapForCatalogRow(profileMaps, row);
        return {
          catalogKey: this.catalogKey(row),
          variantId: row.variantId,
          slug: row.slug,
          name: row.name,
          sku: row.sku,
          mapped: Boolean(productMap?.externalId),
          blingProductId: productMap?.externalId ?? null,
          profile: this.normalizeProfile(row, profileMap?.metadata),
        };
      }),
    };
  }

  async saveProfile(
    companyId: string,
    catalogKey: string,
    patch: Record<string, unknown>,
  ) {
    const local = await this.localCatalog(companyId);
    const direct = local.find(
      (item) => this.catalogKey(item) === String(catalogKey),
    );
    const legacyMatches = local.filter(
      (item) => String(item.slug) === String(catalogKey),
    );
    const row =
      direct ?? (legacyMatches.length === 1 ? legacyMatches[0] : null);
    if (!row) throw new Error("Produto BBOS não encontrado.");

    const profileMaps = await this.resourceMaps(
      companyId,
      "STOREFRONT_PRODUCT_PROFILE",
    );
    const current = this.mapForCatalogRow(profileMaps, row);
    const next = this.normalizeProfile(row, {
      ...(current?.metadata ?? {}),
      ...patch,
    });
    this.validateProfile(next);

    await this.saveResourceMap(
      companyId,
      "STOREFRONT_PRODUCT_PROFILE",
      this.catalogKey(row),
      this.catalogKey(row),
      next,
    );

    const productMaps = await this.resourceMaps(
      companyId,
      "STOREFRONT_PRODUCT",
    );
    const productMap = this.mapForCatalogRow(productMaps, row);
    if (productMap?.externalId) {
      const currentRemote = await this.bling.request(
        companyId,
        `/produtos/${encodeURIComponent(String(productMap.externalId))}`,
        { method: "GET" },
      );
      const existing = currentRemote?.data ?? {};
      await this.bling.request(
        companyId,
        `/produtos/${encodeURIComponent(String(productMap.externalId))}`,
        {
          method: "PUT",
          body: JSON.stringify({
            ...existing,
            ...this.productPayload(row, next),
            id: Number(productMap.externalId),
            tributacao: {
              ...(existing?.tributacao ?? {}),
              origem: next.origem,
              ncm: next.ncm,
              ...(next.cest ? { cest: next.cest } : {}),
            },
          }),
        },
      );
    }

    return {
      catalogKey: this.catalogKey(row),
      slug: row.slug,
      profile: next,
      syncedToBling: Boolean(productMap?.externalId),
      blingProductId: productMap?.externalId ?? null,
    };
  }

  async reconcile(companyId: string) {
    const local = await this.localCatalog(companyId);
    const remote = await this.fetchBlingProducts(companyId);

    const remoteBySku = new Map<string, any>();
    const duplicateSkus = new Set<string>();
    for (const product of remote) {
      const sku = String(product?.codigo ?? "")
        .trim()
        .toUpperCase();
      if (!sku) continue;
      if (remoteBySku.has(sku)) duplicateSkus.add(sku);
      else remoteBySku.set(sku, product);
    }

    const matched: any[] = [];
    const missing: any[] = [];
    const ambiguous: any[] = [];

    for (const row of local) {
      const sku = String(row.sku ?? "")
        .trim()
        .toUpperCase();
      if (!sku) {
        missing.push({
          slug: row.slug,
          name: row.name,
          sku: null,
          reason: "LOCAL_SKU_MISSING",
        });
        continue;
      }
      if (duplicateSkus.has(sku)) {
        ambiguous.push({
          slug: row.slug,
          name: row.name,
          sku,
          reason: "DUPLICATE_SKU_IN_BLING",
        });
        continue;
      }
      const product = remoteBySku.get(sku);
      const externalId = String(product?.id ?? "").trim();
      if (!externalId) {
        missing.push({
          slug: row.slug,
          name: row.name,
          sku,
          reason: "NOT_FOUND_IN_BLING",
        });
        continue;
      }
      await this.saveMap(companyId, row, externalId, {
        sku,
        productVariantId: row.variantId,
        blingName: product?.nome ?? null,
        source: "SKU_EXACT_MATCH",
      });
      matched.push({
        slug: row.slug,
        name: row.name,
        sku,
        blingProductId: externalId,
      });
    }

    return {
      safeMode: true,
      createsProducts: false,
      remoteProductsScanned: remote.length,
      matched,
      missing,
      ambiguous,
      ready:
        missing.length === 0 &&
        ambiguous.length === 0 &&
        matched.length === local.length,
    };
  }

  async createMissing(companyId: string) {
    const local = await this.localCatalog(companyId);
    const remote = await this.fetchBlingProducts(companyId);
    const remoteBySku = new Map<string, any>();

    for (const product of remote) {
      const sku = String(product?.codigo ?? "")
        .trim()
        .toUpperCase();
      if (sku && !remoteBySku.has(sku)) remoteBySku.set(sku, product);
    }

    const profileMaps = await this.resourceMaps(
      companyId,
      "STOREFRONT_PRODUCT_PROFILE",
    );
    const companyProfile = await this.companyFiscalProfile(companyId);
    const productMaps = await this.resourceMaps(
      companyId,
      "STOREFRONT_PRODUCT",
    );

    const created: any[] = [];
    const linkedExisting: any[] = [];
    const failed: any[] = [];

    for (const row of local) {
      const slug = String(row.slug);
      const sku = String(row.sku ?? "")
        .trim()
        .toUpperCase();
      if (!sku) {
        failed.push({ slug, name: row.name, reason: "LOCAL_SKU_MISSING" });
        continue;
      }

      const alreadyMapped = this.mapForCatalogRow(productMaps, row);
      if (alreadyMapped?.externalId) continue;

      const existing = remoteBySku.get(sku);
      if (existing?.id) {
        const externalId = String(existing.id);
        await this.saveMap(companyId, row, externalId, {
          sku,
          productVariantId: row.variantId,
          blingName: existing.nome ?? null,
          source: "SKU_EXACT_MATCH_DURING_CREATE",
        });
        linkedExisting.push({
          slug,
          name: row.name,
          sku,
          blingProductId: externalId,
        });
        continue;
      }

      try {
        const profile = this.normalizeProfile(
          row,
          this.mapForCatalogRow(profileMaps, row)?.metadata,
        );
        this.validateProfile(profile);
        await this.saveResourceMap(
          companyId,
          "STOREFRONT_PRODUCT_PROFILE",
          this.catalogKey(row),
          this.catalogKey(row),
          profile,
        );

        const result = await this.bling.request(companyId, "/produtos", {
          method: "POST",
          body: JSON.stringify(this.productPayload(row, profile)),
        });
        const externalId = String(result?.data?.id ?? result?.id ?? "").trim();
        if (!externalId)
          throw new Error("Bling criou o produto sem retornar ID.");

        await this.saveMap(companyId, row, externalId, {
          sku,
          productVariantId: row.variantId,
          blingName: row.name,
          source: "CREATED_BY_BBOS",
          fiscalProfile: profile,
          companyFiscalProfile: {
            taxRegime: companyProfile.taxRegime,
            pisCofinsRegime: companyProfile.pisCofinsRegime,
          },
        });
        created.push({
          slug,
          name: row.name,
          sku,
          blingProductId: externalId,
          profile,
        });
      } catch (error) {
        failed.push({
          slug,
          name: row.name,
          sku,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const status = await this.status(companyId);
    return {
      governedBy: "BBOS",
      companyFiscalProfile: companyProfile,
      created,
      linkedExisting,
      failed,
      ready: status.ready,
      status,
    };
  }
}
