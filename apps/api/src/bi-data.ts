import type { prisma } from "@bbos/database";
import {
  averageRoastLoss,
  coffeeCosts,
  lineCosts,
  type CoffeeRoastRow,
  type CoffeeSettingRow,
  type CustomerOrderRow,
  type LineLotRow,
  type SaleItemRow,
} from "./business-intelligence";

type Db = Pick<typeof prisma, "$queryRawUnsafe">;

/**
 * Conta interna: cliente com o mesmo e-mail de um usuário da equipe (sócios,
 * funcionários). Parceiros com acesso ao portal (PARTNER) são clientes reais.
 */
export const NOT_INTERNAL = `NOT EXISTS (SELECT 1 FROM "Customer" ic JOIN "User" iu ON lower(iu.email)=lower(ic.email) AND iu."companyId"=ic."companyId"
                                   WHERE ic.id=o."customerId" AND ic.email IS NOT NULL AND ic.email<>'' AND iu.role::text<>'PARTNER')`;

export type DatedSaleItemRow = SaleItemRow & { customerId: string; orderedAt: Date };

/** Itens vendidos (vendas diretas, sem contas internas) entre duas datas. */
export function loadSaleItems(db: Db, companyId: string, since: Date, until: Date) {
  return db.$queryRawUnsafe<DatedSaleItemRow[]>(
        `SELECT o.id AS "orderId",o."customerId",o."orderedAt",COALESCE(ch.name,'Direto') AS channel,
                CASE WHEN line.code::text='GREEN_COFFEE' THEN NULL ELSE COALESCE(p."baseCoffeeProductId",p.id) END AS "coffeeId",
                CASE WHEN line.code::text='GREEN_COFFEE' THEN 'Café verde (revenda)' ELSE COALESCE(bp.name,i."productName") END AS "coffeeName",
                i.quantity::float AS units,
                (i.quantity*COALESCE(v."netWeightGrams",0)/1000.0)::float AS kg,
                i."totalAmount"::float AS revenue
           FROM "SalesOrderItem" i
           JOIN "SalesOrder" o ON o.id=i."salesOrderId"
           LEFT JOIN "SalesChannel" ch ON ch.id=o."salesChannelId"
           LEFT JOIN "ProductVariant" v ON v.id=i."productVariantId"
           LEFT JOIN "Product" p ON p.id=v."productId"
           LEFT JOIN "Product" bp ON bp.id=COALESCE(p."baseCoffeeProductId",p.id)
           LEFT JOIN "ProductLine" line ON line.id=bp."productLineId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED'
            AND o."orderedAt">=$2 AND o."orderedAt"<$3 AND ${NOT_INTERNAL}`,
    companyId, since, until,
  );
}

/** Pedidos por cliente (sem contas internas) desde uma data. */
export function loadCustomerOrders(db: Db, companyId: string, since: Date) {
  return db.$queryRawUnsafe<CustomerOrderRow[]>(
        `SELECT o."customerId",c.name,c.phone,o."orderedAt",o."totalAmount"::float AS amount
           FROM "SalesOrder" o JOIN "Customer" c ON c.id=o."customerId"
          WHERE o."companyId"=$1 AND o."orderType"='COMMERCIAL' AND o.status::text<>'CANCELLED'
            AND o."orderedAt">=$2 AND ${NOT_INTERNAL}`,
    companyId, since,
  );
}

/** Regra única de custo da matéria-prima (mesma da aba Margem). */
export async function loadCostContext(db: Db, companyId: string, yearAgo: Date) {
  const [coffees, roasts, settings, packaging, lineLots] = await Promise.all([
    db.$queryRawUnsafe<Array<{ coffeeId: string; coffeeName: string; line: string }>>(
        `SELECT p.id AS "coffeeId",p.name AS "coffeeName",line.code::text AS line
           FROM "Product" p JOIN "ProductLine" line ON line.id=p."productLineId"
          WHERE line."companyId"=$1 AND p."baseCoffeeProductId" IS NULL AND line.code::text<>'GREEN_COFFEE'
          ORDER BY p.name`,
      companyId,
    ),
    db.$queryRawUnsafe<CoffeeRoastRow[]>(
        `WITH op AS (
           SELECT COALESCE(p."baseCoffeeProductId",p.id) AS "coffeeId",bp.name AS "coffeeName",
                  (SELECT COALESCE(SUM(c."reservedKg"),0) FROM "ProductionConsumption" c WHERE c."productionOrderId"=po.id) AS green_kg,
                  (SELECT COALESCE(SUM(c."reservedKg"*(l."landedCost"/NULLIF(l."initialWeightKg",0))),0)
                     FROM "ProductionConsumption" c JOIN "CoffeeLot" l ON l.id=c."coffeeLotId"
                    WHERE c."productionOrderId"=po.id AND l."landedCost">0) AS green_cost,
                  (SELECT COALESCE(SUM(c."reservedKg"),0) FROM "ProductionConsumption" c JOIN "CoffeeLot" l ON l.id=c."coffeeLotId"
                    WHERE c."productionOrderId"=po.id AND (l."landedCost" IS NULL OR l."landedCost"<=0)) AS uncosted_kg,
                  (SELECT COALESCE(SUM(b."roastedOutputKg"),0) FROM "ProductionBatch" b WHERE b."productionOrderId"=po.id) AS roasted
             FROM "ProductionOrder" po
             JOIN "ProductVariant" pv ON pv.id=po."productVariantId"
             JOIN "Product" p ON p.id=pv."productId"
             JOIN "Product" bp ON bp.id=COALESCE(p."baseCoffeeProductId",p.id)
            WHERE po."companyId"=$1 AND po.status::text<>'CANCELLED' AND po."plannedAt">=$2)
         SELECT "coffeeId","coffeeName",COUNT(*)::int AS roasts,
                SUM(green_kg)::float AS "greenKg",SUM(green_cost)::float AS "greenCost",SUM(roasted)::float AS "roastedKg"
           FROM op WHERE roasted>0 AND green_cost>0 AND uncosted_kg<=0.001
          GROUP BY "coffeeId","coffeeName"`,
      companyId, yearAgo,
    ),
    db.$queryRawUnsafe<CoffeeSettingRow[]>(
        `SELECT "productId" AS "coffeeId","greenCostPerKg"::float AS "greenCostPerKg",
                "roastLossPercent"::float AS "roastLossPercent","updatedByName","updatedAt"
           FROM "CoffeeCostSetting" WHERE "companyId"=$1`,
      companyId,
    ),
    db.$queryRawUnsafe<Array<{ perUnit: number | null }>>(
        `SELECT (SUM("totalCost")/NULLIF(SUM(quantity),0))::float AS "perUnit"
           FROM "PackagingConsumption" WHERE "companyId"=$1 AND "materialType"='PACKAGE' AND quantity>0`,
      companyId,
    ),
    db.$queryRawUnsafe<LineLotRow[]>(
        `SELECT line,SUM(l."landedCost")::float AS "greenCost",SUM(l."initialWeightKg")::float AS "greenKg"
           FROM "CoffeeLot" l, unnest(l."intendedLines") AS line
          WHERE l."companyId"=$1 AND l."landedCost">0 AND l."initialWeightKg">0
          GROUP BY line`,
      companyId,
    ),
  ]);
  const packagingPerUnit = Math.round((packaging[0]?.perUnit ?? 0) * 100) / 100;
  const roastLossPercent = averageRoastLoss(roasts);
  const byLine = lineCosts(lineLots, roastLossPercent);
  const { average, costs } = coffeeCosts(coffees, roasts, settings, byLine);
  return { packagingPerUnit, roastLossPercent, byLine, average, costs };
}
