-- Data fix approved by the owner on 26/11/2026.
-- Green coffee already roasted kept counting as "reserved" because, in the
-- bulk flow, production orders stay ROASTED and never reach COMPLETED (the
-- only step that consumed the reservation until release #186). This consumes
-- what is still reserved by ROASTED orders that have roast batches, and the
-- green sample sent to China on order B-2026-000021 (shipped by FedEx on
-- 11/11/2026). Each movement gets an IndustrialEvent, like a normal one.
-- Idempotent: a second run finds nothing pending and changes nothing.

-- 1) Roasted orders: consume the rest of their green reservation.
WITH pending AS (
  SELECT pc.id, pc."coffeeLotId", pc."productionOrderId", po."companyId", po.code AS "orderCode",
         l."warehouseId", (pc."reservedKg" - pc."consumedKg") AS remaining
    FROM "ProductionConsumption" pc
    JOIN "ProductionOrder" po ON po.id = pc."productionOrderId"
    JOIN "CoffeeLot" l ON l.id = pc."coffeeLotId"
   WHERE po.status = 'ROASTED'
     AND pc."reservedKg" > pc."consumedKg"
     AND EXISTS (SELECT 1 FROM "ProductionBatch" b WHERE b."productionOrderId" = po.id)
),
events AS (
  INSERT INTO "IndustrialEvent" (id, "companyId", "productionOrderId", "coffeeLotId", "warehouseId", type, "quantityKg", metadata)
  SELECT 'datafix-' || md5(p.id || ':roasted-green-2026-11'), p."companyId", p."productionOrderId", p."coffeeLotId", p."warehouseId",
         'TRANSFER', p.remaining,
         jsonb_build_object('movementType', 'production-consumption', 'orderCode', p."orderCode",
                            'dataFix', '2026-11-26 reserva de café verde já torrado')
    FROM pending p
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
),
lots AS (
  UPDATE "CoffeeLot" l
     SET "reservedWeightKg" = GREATEST(0, l."reservedWeightKg" - s.total), "updatedAt" = NOW()
    FROM (SELECT "coffeeLotId", SUM(remaining) AS total FROM pending GROUP BY "coffeeLotId") s
   WHERE l.id = s."coffeeLotId"
  RETURNING 1
)
UPDATE "ProductionConsumption" pc
   SET "consumedKg" = pc."reservedKg", "updatedAt" = NOW()
  FROM pending p
 WHERE pc.id = p.id;

-- 2) Roasted orders: actual input/output from their batches (they stayed NULL).
UPDATE "ProductionOrder" po
   SET "actualInputKg" = b.green, "actualOutputKg" = b.roasted, "updatedAt" = NOW()
  FROM (SELECT "productionOrderId", SUM("greenInputKg") AS green, SUM("roastedOutputKg") AS roasted
          FROM "ProductionBatch" GROUP BY "productionOrderId") b
 WHERE po.id = b."productionOrderId"
   AND po.status = 'ROASTED'
   AND po."actualInputKg" IS NULL;

-- 3) Green sample to China (B-2026-000021): the coffee left on 11/11.
WITH shipped AS (
  SELECT r.id, r."companyId", r."coffeeLotId", r."warehouseId", r."quantityKg", r."salesOrderId",
         r."salesOrderItemId", r."productVariantId"
    FROM "GreenCoffeeSalesReservation" r
    JOIN "SalesOrder" o ON o.id = r."salesOrderId"
   WHERE o."orderNumber" = 'B-2026-000021' AND r.status = 'ACTIVE'
),
events AS (
  INSERT INTO "IndustrialEvent" (id, "companyId", "coffeeLotId", "warehouseId", type, "quantityKg", metadata)
  SELECT 'datafix-' || md5(s.id || ':export-sample-2026-11'), s."companyId", s."coffeeLotId", s."warehouseId",
         'ADJUSTMENT', -s."quantityKg",
         jsonb_build_object('movementType', 'green-coffee-export-sale', 'salesOrderId', s."salesOrderId",
                            'salesOrderItemId', s."salesOrderItemId", 'productVariantId', s."productVariantId",
                            'dataFix', '2026-11-26 amostra enviada à China em 11/11 (FedEx 879951396830)')
    FROM shipped s
  ON CONFLICT (id) DO NOTHING
  RETURNING 1
),
lots AS (
  UPDATE "CoffeeLot" l
     SET "reservedWeightKg" = GREATEST(0, l."reservedWeightKg" - s.total), "updatedAt" = NOW()
    FROM (SELECT "coffeeLotId", SUM("quantityKg") AS total FROM shipped GROUP BY "coffeeLotId") s
   WHERE l.id = s."coffeeLotId"
  RETURNING 1
)
UPDATE "GreenCoffeeSalesReservation" r
   SET status = 'CONSUMED', "consumedAt" = NOW(), "updatedAt" = NOW()
  FROM shipped s
 WHERE r.id = s.id;
