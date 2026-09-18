import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

const DEFAULT_NCM = "09012100";
const PRICE_BY_SLUG: Record<string, number> = {
  essencial: 52,
  caramelo: 68,
  "doce-de-leite": 68,
  tangerina: 68,
  singular: 84,
  sublime: 84,
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
};

@Injectable()
export class BlingCatalogSyncService {
  private readonly database = new PrismaClient();

  constructor(private readonly bling: BlingService) {}

  private async localCatalog() {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT p.slug,p.name,pv.id AS "variantId",pv.sku,pv."netWeightGrams"
         FROM "Product" p
         JOIN "ProductVariant" pv ON pv."productId"=p.id
        WHERE p.active=true AND pv.active=true
          AND p.slug IN ('essencial','caramelo','doce-de-leite','tangerina','singular','sublime')
        ORDER BY p.slug,pv."netWeightGrams"`,
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

  private async getResourceMap(companyId: string, resourceType: string, internalKey: string) {
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

  private async saveMap(companyId: string, slug: string, externalId: string, metadata: unknown) {
    return this.saveResourceMap(companyId, "STOREFRONT_PRODUCT", slug, externalId, metadata);
  }

  private defaultProfile(row: any): FiscalProfile {
    const kg = Math.max(0.001, Number(row.netWeightGrams ?? 0) / 1000);
    return {
      ncm: DEFAULT_NCM,
      origem: 0,
      unidade: "UN",
      preco: PRICE_BY_SLUG[String(row.slug)] ?? 0,
      pesoLiquido: kg,
      pesoBruto: kg,
      tipo: "P",
      situacao: "A",
      formato: "S",
      tipoProducao: "P",
      descricaoCurta: `${row.name} — café torrado`,
    };
  }

  private normalizeProfile(row: any, metadata?: any): FiscalProfile {
    const base = this.defaultProfile(row);
    const source = metadata && typeof metadata === "object" ? metadata : {};
    return {
      ...base,
      ...source,
      ncm: String(source.ncm ?? base.ncm).replace(/\D/g, ""),
      origem: Number.isInteger(Number(source.origem)) ? Number(source.origem) : base.origem,
      unidade: String(source.unidade ?? base.unidade).trim().toUpperCase(),
      preco: Number.isFinite(Number(source.preco)) ? Number(source.preco) : base.preco,
      pesoLiquido: Number.isFinite(Number(source.pesoLiquido)) ? Number(source.pesoLiquido) : base.pesoLiquido,
      pesoBruto: Number.isFinite(Number(source.pesoBruto)) ? Number(source.pesoBruto) : base.pesoBruto,
      tipo: "P",
      formato: "S",
      situacao: source.situacao === "I" ? "I" : "A",
      tipoProducao: source.tipoProducao === "T" ? "T" : "P",
      descricaoCurta: String(source.descricaoCurta ?? base.descricaoCurta).trim(),
    };
  }

  private validateProfile(profile: FiscalProfile) {
    if (!/^\d{8}$/.test(profile.ncm)) throw new Error("NCM deve conter exatamente 8 dígitos.");
    if (!Number.isInteger(profile.origem) || profile.origem < 0 || profile.origem > 8) {
      throw new Error("Origem fiscal deve ser um código entre 0 e 8.");
    }
    if (!profile.unidade || profile.unidade.length > 6) throw new Error("Unidade fiscal inválida.");
    if (!Number.isFinite(profile.preco) || profile.preco < 0) throw new Error("Preço de venda inválido.");
    if (!Number.isFinite(profile.pesoLiquido) || profile.pesoLiquido <= 0) throw new Error("Peso líquido inválido.");
    if (!Number.isFinite(profile.pesoBruto) || profile.pesoBruto < profile.pesoLiquido) {
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
      this.localCatalog(),
      this.resourceMaps(companyId, "STOREFRONT_PRODUCT"),
    ]);
    const bySlug = new Map(maps.map((row) => [String(row.internalKey), row]));
    const items = local.map((row) => ({
      slug: row.slug,
      name: row.name,
      sku: row.sku,
      weightGrams: Number(row.netWeightGrams),
      mapped: Boolean(bySlug.get(String(row.slug))?.externalId),
      blingProductId: bySlug.get(String(row.slug))?.externalId ?? null,
    }));
    return {
      total: items.length,
      mapped: items.filter((item) => item.mapped).length,
      missing: items.filter((item) => !item.mapped).map((item) => item.sku),
      ready: items.length > 0 && items.every((item) => item.mapped),
      items,
    };
  }

  async profiles(companyId: string) {
    const [local, profileMaps, productMaps] = await Promise.all([
      this.localCatalog(),
      this.resourceMaps(companyId, "STOREFRONT_PRODUCT_PROFILE"),
      this.resourceMaps(companyId, "STOREFRONT_PRODUCT"),
    ]);
    const profiles = new Map(profileMaps.map((row) => [String(row.internalKey), row]));
    const products = new Map(productMaps.map((row) => [String(row.internalKey), row]));

    return {
      defaultNcm: DEFAULT_NCM,
      items: local.map((row) => ({
        slug: row.slug,
        name: row.name,
        sku: row.sku,
        mapped: Boolean(products.get(String(row.slug))?.externalId),
        blingProductId: products.get(String(row.slug))?.externalId ?? null,
        profile: this.normalizeProfile(row, profiles.get(String(row.slug))?.metadata),
      })),
    };
  }

  async saveProfile(companyId: string, slug: string, patch: Record<string, unknown>) {
    const local = await this.localCatalog();
    const row = local.find((item) => String(item.slug) === slug);
    if (!row) throw new Error("Produto BBOS não encontrado.");

    const current = await this.getResourceMap(companyId, "STOREFRONT_PRODUCT_PROFILE", slug);
    const next = this.normalizeProfile(row, { ...(current?.metadata ?? {}), ...patch });
    this.validateProfile(next);

    await this.saveResourceMap(
      companyId,
      "STOREFRONT_PRODUCT_PROFILE",
      slug,
      slug,
      next,
    );

    const productMap = await this.getResourceMap(companyId, "STOREFRONT_PRODUCT", slug);
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
            },
          }),
        },
      );
    }

    return {
      slug,
      profile: next,
      syncedToBling: Boolean(productMap?.externalId),
      blingProductId: productMap?.externalId ?? null,
    };
  }

  async reconcile(companyId: string) {
    const local = await this.localCatalog();
    const remote = await this.fetchBlingProducts(companyId);

    const remoteBySku = new Map<string, any>();
    const duplicateSkus = new Set<string>();
    for (const product of remote) {
      const sku = String(product?.codigo ?? "").trim().toUpperCase();
      if (!sku) continue;
      if (remoteBySku.has(sku)) duplicateSkus.add(sku);
      else remoteBySku.set(sku, product);
    }

    const matched: any[] = [];
    const missing: any[] = [];
    const ambiguous: any[] = [];

    for (const row of local) {
      const sku = String(row.sku ?? "").trim().toUpperCase();
      if (!sku) {
        missing.push({ slug: row.slug, name: row.name, sku: null, reason: "LOCAL_SKU_MISSING" });
        continue;
      }
      if (duplicateSkus.has(sku)) {
        ambiguous.push({ slug: row.slug, name: row.name, sku, reason: "DUPLICATE_SKU_IN_BLING" });
        continue;
      }
      const product = remoteBySku.get(sku);
      const externalId = String(product?.id ?? "").trim();
      if (!externalId) {
        missing.push({ slug: row.slug, name: row.name, sku, reason: "NOT_FOUND_IN_BLING" });
        continue;
      }
      await this.saveMap(companyId, String(row.slug), externalId, {
        sku,
        productVariantId: row.variantId,
        blingName: product?.nome ?? null,
        source: "SKU_EXACT_MATCH",
      });
      matched.push({ slug: row.slug, name: row.name, sku, blingProductId: externalId });
    }

    return {
      safeMode: true,
      createsProducts: false,
      remoteProductsScanned: remote.length,
      matched,
      missing,
      ambiguous,
      ready: missing.length === 0 && ambiguous.length === 0 && matched.length === local.length,
    };
  }

  async createMissing(companyId: string) {
    const local = await this.localCatalog();
    const remote = await this.fetchBlingProducts(companyId);
    const remoteBySku = new Map<string, any>();

    for (const product of remote) {
      const sku = String(product?.codigo ?? "").trim().toUpperCase();
      if (sku && !remoteBySku.has(sku)) remoteBySku.set(sku, product);
    }

    const profileMaps = await this.resourceMaps(companyId, "STOREFRONT_PRODUCT_PROFILE");
    const profiles = new Map(profileMaps.map((row) => [String(row.internalKey), row]));

    const created: any[] = [];
    const linkedExisting: any[] = [];
    const failed: any[] = [];

    for (const row of local) {
      const slug = String(row.slug);
      const sku = String(row.sku ?? "").trim().toUpperCase();
      if (!sku) {
        failed.push({ slug, name: row.name, reason: "LOCAL_SKU_MISSING" });
        continue;
      }

      const alreadyMapped = await this.getResourceMap(companyId, "STOREFRONT_PRODUCT", slug);
      if (alreadyMapped?.externalId) continue;

      const existing = remoteBySku.get(sku);
      if (existing?.id) {
        const externalId = String(existing.id);
        await this.saveMap(companyId, slug, externalId, {
          sku,
          productVariantId: row.variantId,
          blingName: existing.nome ?? null,
          source: "SKU_EXACT_MATCH_DURING_CREATE",
        });
        linkedExisting.push({ slug, name: row.name, sku, blingProductId: externalId });
        continue;
      }

      try {
        const profile = this.normalizeProfile(row, profiles.get(slug)?.metadata);
        this.validateProfile(profile);
        await this.saveResourceMap(companyId, "STOREFRONT_PRODUCT_PROFILE", slug, slug, profile);

        const result = await this.bling.request(companyId, "/produtos", {
          method: "POST",
          body: JSON.stringify(this.productPayload(row, profile)),
        });
        const externalId = String(result?.data?.id ?? result?.id ?? "").trim();
        if (!externalId) throw new Error("Bling criou o produto sem retornar ID.");

        await this.saveMap(companyId, slug, externalId, {
          sku,
          productVariantId: row.variantId,
          blingName: row.name,
          source: "CREATED_BY_BBOS",
          fiscalProfile: profile,
        });
        created.push({ slug, name: row.name, sku, blingProductId: externalId, profile });
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
      created,
      linkedExisting,
      failed,
      ready: status.ready,
      status,
    };
  }
}
