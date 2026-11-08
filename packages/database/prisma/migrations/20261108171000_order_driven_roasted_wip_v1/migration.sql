-- A confirmed sales order automatically allocates roasted coffee in kilograms.
-- The coffee remains physically in WIP until packaging is confirmed; only the
-- allocatable balance is reduced. Package size comes from the ordered SKU.

CREATE TABLE "RoastedWipReservation" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "salesOrderId" TEXT NOT NULL REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  "salesOrderItemId" TEXT NOT NULL REFERENCES "SalesOrderItem"(id) ON DELETE CASCADE,
  "productVariantId" TEXT NOT NULL REFERENCES "ProductVariant"(id) ON DELETE RESTRICT,
  "packageQuantity" INTEGER NOT NULL,
  "requestedKg" DECIMAL(14,3) NOT NULL,
  "reservedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("salesOrderItemId"),
  CHECK ("packageQuantity" > 0),
  CHECK ("requestedKg" > 0 AND "reservedKg" >= 0 AND "reservedKg" <= "requestedKg"),
  CHECK (status IN ('PENDING','PARTIAL','RESERVED','CONSUMED','RELEASED'))
);

CREATE INDEX "RoastedWipReservation_company_status_idx"
  ON "RoastedWipReservation"("companyId",status,"createdAt");
CREATE INDEX "RoastedWipReservation_variant_status_idx"
  ON "RoastedWipReservation"("productVariantId",status);

CREATE TABLE "RoastedWipReservationAllocation" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "reservationId" TEXT NOT NULL REFERENCES "RoastedWipReservation"(id) ON DELETE CASCADE,
  "wipLotId" TEXT NOT NULL REFERENCES "RoastedWipLot"(id) ON DELETE RESTRICT,
  "quantityKg" DECIMAL(14,3) NOT NULL,
  "consumedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("reservationId","wipLotId"),
  CHECK ("quantityKg" > 0 AND "consumedKg" >= 0 AND "consumedKg" <= "quantityKg")
);

CREATE INDEX "RoastedWipReservationAllocation_wip_idx"
  ON "RoastedWipReservationAllocation"("wipLotId");

CREATE OR REPLACE FUNCTION bbos_allocate_new_wip_to_orders() RETURNS trigger AS $$
DECLARE
  remaining_kg DECIMAL(14,3);
  take_kg DECIMAL(14,3);
  target_product_id TEXT;
  reservation_row RECORD;
BEGIN
  remaining_kg := GREATEST(NEW."availableKg" - NEW."reservedKg", 0);
  IF remaining_kg <= 0.0005 OR NEW."productVariantId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "productId" INTO target_product_id
    FROM "ProductVariant" WHERE id=NEW."productVariantId";

  FOR reservation_row IN
    SELECT reservation.*
      FROM "RoastedWipReservation" reservation
      JOIN "ProductVariant" variant ON variant.id=reservation."productVariantId"
     WHERE reservation."companyId"=NEW."companyId"
       AND reservation.status IN ('PENDING','PARTIAL')
       AND reservation."reservedKg" < reservation."requestedKg"
       AND variant."productId"=target_product_id
     ORDER BY reservation."createdAt",reservation.id
     FOR UPDATE OF reservation
  LOOP
    EXIT WHEN remaining_kg <= 0.0005;
    take_kg := LEAST(
      remaining_kg,
      reservation_row."requestedKg" - reservation_row."reservedKg"
    );
    INSERT INTO "RoastedWipReservationAllocation"
      (id,"companyId","reservationId","wipLotId","quantityKg")
    VALUES
      ('wipalloc-'||md5(reservation_row.id||':'||NEW.id),NEW."companyId",reservation_row.id,NEW.id,take_kg)
    ON CONFLICT ("reservationId","wipLotId") DO UPDATE
      SET "quantityKg"="RoastedWipReservationAllocation"."quantityKg"+EXCLUDED."quantityKg";
    UPDATE "RoastedWipReservation"
       SET "reservedKg"="reservedKg"+take_kg,
           status=CASE WHEN "reservedKg"+take_kg >= "requestedKg"-0.0005 THEN 'RESERVED' ELSE 'PARTIAL' END,
           "updatedAt"=CURRENT_TIMESTAMP
     WHERE id=reservation_row.id;
    UPDATE "RoastedWipLot"
       SET "reservedKg"="reservedKg"+take_kg,"updatedAt"=CURRENT_TIMESTAMP
     WHERE id=NEW.id;
    remaining_kg := remaining_kg - take_kg;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "RoastedWipLot_allocate_orders_trg" ON "RoastedWipLot";
CREATE TRIGGER "RoastedWipLot_allocate_orders_trg"
AFTER INSERT ON "RoastedWipLot"
FOR EACH ROW EXECUTE FUNCTION bbos_allocate_new_wip_to_orders();

-- A separate, later packaging action can use only unreserved bulk WIP.
-- Confirming or signing a sales order never reaches this trigger.
CREATE OR REPLACE FUNCTION bbos_trace_finished_goods() RETURNS trigger AS $$
DECLARE
  remaining_kg DECIMAL(14,3);
  remaining_units INTEGER;
  take_kg DECIMAL(14,3);
  take_units INTEGER;
  w RECORD;
  l RECORD;
  lot_code TEXT;
  lot_id TEXT;
  has_lots INTEGER;
BEGIN
  IF NEW.type::text='PRODUCTION_IN' THEN
    remaining_kg := COALESCE(NEW."totalWeightKg",0);
    IF NEW."productionOrderId" IS NOT NULL THEN
      FOR w IN
        SELECT * FROM "RoastedWipLot"
         WHERE "productionOrderId"=NEW."productionOrderId"
           AND status IN ('AVAILABLE','PARTIALLY_PACKED')
           AND "availableKg"-"reservedKg">0.0005
         ORDER BY "producedAt",id
         FOR UPDATE
      LOOP
        EXIT WHEN remaining_kg<=0.0005;
        take_kg := LEAST(w."availableKg"-w."reservedKg",remaining_kg);
        UPDATE "RoastedWipLot"
           SET "availableKg"="availableKg"-take_kg,
               status=CASE WHEN "availableKg"-take_kg<=0.0005 THEN 'CONSUMED' ELSE 'PARTIALLY_PACKED' END,
               "updatedAt"=CURRENT_TIMESTAMP
         WHERE id=w.id;
        INSERT INTO "RoastedWipMovement"
          (id,"companyId","wipLotId","productionOrderId",type,"quantityKg",reason,metadata)
        VALUES
          ('wipmov-'||md5(NEW.id||':'||w.id),NEW."companyId",w.id,NEW."productionOrderId",'PACK_OUT',take_kg,
           'Consumo no empacotamento',jsonb_build_object('finishedGoodsMovementId',NEW.id))
        ON CONFLICT (id) DO NOTHING;
        remaining_kg := remaining_kg-take_kg;
      END LOOP;
      IF remaining_kg>0.0005 THEN
        RAISE EXCEPTION 'WIP torrado livre insuficiente: faltam % kg',remaining_kg;
      END IF;
    END IF;

    lot_code := 'PA-'||to_char(CURRENT_TIMESTAMP,'YYYY')||'-'||lpad(nextval('bbos_finished_goods_lot_seq')::text,6,'0');
    lot_id := 'fglot-'||md5(NEW.id);
    INSERT INTO "FinishedGoodsLot"
      (id,"companyId","finishedProductId","productVariantId","productionOrderId","warehouseId","sourceMovementId",code,"manufacturedAt","initialUnits","quantityOnHand")
    VALUES
      (lot_id,NEW."companyId",NEW."finishedProductId",NEW."productVariantId",NEW."productionOrderId",NEW."warehouseId",NEW.id,lot_code,CURRENT_TIMESTAMP,NEW."packageQuantity",NEW."packageQuantity")
    ON CONFLICT ("sourceMovementId") DO NOTHING;
  ELSIF NEW.type::text='SALE_OUT' THEN
    SELECT COUNT(*) INTO has_lots
      FROM "FinishedGoodsLot"
     WHERE "finishedProductId"=NEW."finishedProductId" AND "quantityOnHand">0;
    IF has_lots>0 THEN
      remaining_units := NEW."packageQuantity";
      FOR l IN
        SELECT * FROM "FinishedGoodsLot"
         WHERE "finishedProductId"=NEW."finishedProductId"
           AND "quantityOnHand">0
           AND status NOT IN ('BLOCKED','EXPIRED','QUARANTINE')
         ORDER BY "expiresAt" NULLS LAST,"manufacturedAt",id
         FOR UPDATE
      LOOP
        EXIT WHEN remaining_units<=0;
        take_units := LEAST(l."quantityOnHand",remaining_units);
        UPDATE "FinishedGoodsLot"
           SET "quantityOnHand"="quantityOnHand"-take_units,
               status=CASE WHEN "quantityOnHand"-take_units=0 THEN 'DEPLETED' ELSE status END,
               "updatedAt"=CURRENT_TIMESTAMP
         WHERE id=l.id;
        INSERT INTO "FinishedGoodsLotAllocation"
          (id,"companyId","finishedGoodsMovementId","finishedGoodsLotId",quantity)
        VALUES
          ('fgalloc-'||md5(NEW.id||':'||l.id),NEW."companyId",NEW.id,l.id,take_units)
        ON CONFLICT DO NOTHING;
        remaining_units := remaining_units-take_units;
      END LOOP;
      IF remaining_units>0 THEN
        RAISE EXCEPTION 'Lotes PA insuficientes: faltam % unidades',remaining_units;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Existing confirmed orders enter the same queue during deployment.
WITH active_reservations AS (
  SELECT "salesOrderItemId",SUM(quantity)::int AS reserved
    FROM "InventoryReservation"
   WHERE status='ACTIVE'
   GROUP BY "salesOrderItemId"
), finished_stock AS (
  SELECT "companyId","productVariantId",
         MAX("quantityOnHand"-"reservedQuantity")::int AS available
    FROM "FinishedProduct"
   WHERE "productVariantId" IS NOT NULL
   GROUP BY "companyId","productVariantId"
), open_items AS (
  SELECT item.id,item."companyId",item."salesOrderId",item."productVariantId",item.quantity,
         variant."netWeightGrams",orders."orderedAt",
         GREATEST(item.quantity-COALESCE(active.reserved,0),0)::int AS open_units,
         COALESCE(stock.available,0)::int AS available_finished
    FROM "SalesOrderItem" item
    JOIN "SalesOrder" orders ON orders.id=item."salesOrderId"
    JOIN "ProductVariant" variant ON variant.id=item."productVariantId"
    LEFT JOIN active_reservations active ON active."salesOrderItemId"=item.id
    LEFT JOIN finished_stock stock ON stock."companyId"=item."companyId" AND stock."productVariantId"=item."productVariantId"
   WHERE orders.status::text IN ('CONFIRMED','IN_PRODUCTION')
), distributed AS (
  SELECT open_items.*,
         COALESCE(SUM(open_units) OVER (
           PARTITION BY "companyId","productVariantId"
           ORDER BY "orderedAt",id
           ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
         ),0)::int AS prior_demand
    FROM open_items
), candidates AS (
  SELECT *,GREATEST(0,open_units-GREATEST(0,available_finished-prior_demand))::int AS packages
    FROM distributed
)
INSERT INTO "RoastedWipReservation"
  (id,"companyId","salesOrderId","salesOrderItemId","productVariantId","packageQuantity","requestedKg","reservedKg",status)
SELECT 'wipres-'||md5(id),"companyId","salesOrderId",id,"productVariantId",packages,
       ROUND((packages*"netWeightGrams")::numeric/1000,3),0,'PENDING'
  FROM candidates
 WHERE packages>0
ON CONFLICT ("salesOrderItemId") DO NOTHING;

DO $$
DECLARE
  reservation_row RECORD;
  wip_row RECORD;
  target_product_id TEXT;
  remaining_kg DECIMAL(14,3);
  take_kg DECIMAL(14,3);
BEGIN
  FOR reservation_row IN
    SELECT * FROM "RoastedWipReservation"
     WHERE status IN ('PENDING','PARTIAL')
     ORDER BY "createdAt",id
     FOR UPDATE
  LOOP
    SELECT "productId" INTO target_product_id
      FROM "ProductVariant" WHERE id=reservation_row."productVariantId";
    remaining_kg := reservation_row."requestedKg"-reservation_row."reservedKg";
    FOR wip_row IN
      SELECT wip.*
        FROM "RoastedWipLot" wip
        JOIN "ProductVariant" variant ON variant.id=wip."productVariantId"
       WHERE wip."companyId"=reservation_row."companyId"
         AND variant."productId"=target_product_id
         AND wip.status IN ('AVAILABLE','PARTIALLY_PACKED')
         AND wip."availableKg"-wip."reservedKg">0.0005
       ORDER BY wip."producedAt",wip.id
       FOR UPDATE OF wip
    LOOP
      EXIT WHEN remaining_kg<=0.0005;
      take_kg := LEAST(wip_row."availableKg"-wip_row."reservedKg",remaining_kg);
      UPDATE "RoastedWipLot"
         SET "reservedKg"="reservedKg"+take_kg,"updatedAt"=CURRENT_TIMESTAMP
       WHERE id=wip_row.id;
      INSERT INTO "RoastedWipReservationAllocation"
        (id,"companyId","reservationId","wipLotId","quantityKg")
      VALUES
        ('wipalloc-'||md5(reservation_row.id||':'||wip_row.id),reservation_row."companyId",reservation_row.id,wip_row.id,take_kg)
      ON CONFLICT ("reservationId","wipLotId") DO UPDATE
        SET "quantityKg"="RoastedWipReservationAllocation"."quantityKg"+EXCLUDED."quantityKg";
      remaining_kg := remaining_kg-take_kg;
    END LOOP;
    UPDATE "RoastedWipReservation"
       SET "reservedKg"="requestedKg"-remaining_kg,
           status=CASE WHEN remaining_kg<=0.0005 THEN 'RESERVED' WHEN "requestedKg"-remaining_kg>0 THEN 'PARTIAL' ELSE 'PENDING' END,
           "updatedAt"=CURRENT_TIMESTAMP
     WHERE id=reservation_row.id;
  END LOOP;
END;
$$;
