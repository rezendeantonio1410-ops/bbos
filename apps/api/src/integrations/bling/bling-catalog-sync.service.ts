import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHash } from "node:crypto";
import { BlingService } from "./bling.service";

function stableId(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

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

  private async mapped(companyId: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT "internalKey","externalId",metadata
         FROM "IntegrationResourceMap"
        WHERE "companyId"=$1 AND provider='BLING' AND "resourceType"='STOREFRONT_PRODUCT'`,
      companyId,
    );
  }

  private async saveMap(companyId: string, slug: string, externalId: string, metadata: unknown) {
    const id = `bling-map-${stableId(`${companyId}:STOREFRONT_PRODUCT:${slug}`)}`;
    await this.database.$executeRawUnsafe(
      `INSERT INTO "IntegrationResourceMap"
        (id,"companyId",provider,"resourceType","internalKey","externalId",metadata,"lastSyncedAt","createdAt","updatedAt")
       VALUES ($1,$2,'BLING','STOREFRONT_PRODUCT',$3,$4,$5::jsonb,NOW(),NOW(),NOW())
       ON CONFLICT ("companyId",provider,"resourceType","internalKey") DO UPDATE SET
         "externalId"=EXCLUDED."externalId",metadata=EXCLUDED.metadata,
         "lastSyncedAt"=NOW(),"updatedAt"=NOW()`,
      id,
      companyId,
      slug,
      externalId,
      JSON.stringify(metadata ?? {}),
    );
  }

  private async fetchBlingProducts(companyId: string) {
    const products: any[] = [];
    // Conservative pagination: enough for a normal SME catalog while respecting Bling limits.
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
    const [local, maps] = await Promise.all([this.localCatalog(), this.mapped(companyId)]);
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
}
