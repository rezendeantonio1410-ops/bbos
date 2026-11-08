ALTER TABLE "Product"
  ADD COLUMN "commercialKind" TEXT NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "baseCoffeeProductId" TEXT;

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_commercial_kind_check"
    CHECK ("commercialKind" IN ('STANDARD','WHITE_LABEL')),
  ADD CONSTRAINT "Product_base_coffee_product_fkey"
    FOREIGN KEY ("baseCoffeeProductId") REFERENCES "Product"(id) ON DELETE RESTRICT;

CREATE INDEX "Product_baseCoffeeProductId_idx"
  ON "Product"("baseCoffeeProductId");

-- Os cadastros legados ficam identificados para revisão, sem inventar um
-- café-base. Novos White Labels exigem o vínculo completo na API.
UPDATE "Product"
   SET "commercialKind"='WHITE_LABEL'
 WHERE lower(name) LIKE '%white label%'
    OR lower(name) LIKE '%private label%'
    OR lower(name) LIKE '%marca branca%';

CREATE TABLE "SalesOrderTermApproval" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "salesOrderId" TEXT NOT NULL UNIQUE REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"(id) ON DELETE CASCADE,
  reason TEXT NOT NULL DEFAULT 'DELINQUENT_CUSTOMER',
  "orderAmount" DECIMAL(14,2) NOT NULL,
  "overdueAmount" DECIMAL(14,2) NOT NULL,
  "overdueCount" INTEGER NOT NULL,
  "maxDaysOverdue" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  "requestedById" TEXT,
  "requestedByName" TEXT NOT NULL,
  "requestedByRole" TEXT,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decidedById" TEXT,
  "decidedByName" TEXT,
  "decidedByRole" TEXT,
  "decisionNote" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SalesOrderTermApproval_reason_check"
    CHECK (reason IN ('DELINQUENT_CUSTOMER')),
  CONSTRAINT "SalesOrderTermApproval_status_check"
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  CONSTRAINT "SalesOrderTermApproval_amounts_check"
    CHECK ("orderAmount" >= 0 AND "overdueAmount" > 0 AND "overdueCount" > 0 AND "maxDaysOverdue" >= 0)
);

CREATE INDEX "SalesOrderTermApproval_company_status_requested_idx"
  ON "SalesOrderTermApproval"("companyId",status,"requestedAt");
CREATE INDEX "SalesOrderTermApproval_customer_requested_idx"
  ON "SalesOrderTermApproval"("customerId","requestedAt");

CREATE TABLE "SalesOrderEditAudit" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "salesOrderId" TEXT NOT NULL REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "actorRole" TEXT NOT NULL,
  reason TEXT NOT NULL,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SalesOrderEditAudit_order_created_idx"
  ON "SalesOrderEditAudit"("salesOrderId","createdAt" DESC);
CREATE INDEX "SalesOrderEditAudit_company_created_idx"
  ON "SalesOrderEditAudit"("companyId","createdAt" DESC);

-- Pedido embalado consome a reserva de WIP do próprio item. Outros lançamentos
-- de produção continuam consumindo apenas o saldo torrado livre.
CREATE OR REPLACE FUNCTION bbos_trace_finished_goods() RETURNS trigger AS $$
DECLARE
  remaining_kg DECIMAL(14,3);
  remaining_units INTEGER;
  take_kg DECIMAL(14,3);
  take_units INTEGER;
  w RECORD;
  l RECORD;
  allocation_row RECORD;
  reservation_row RECORD;
  lot_code TEXT;
  lot_id TEXT;
  has_lots INTEGER;
BEGIN
  IF NEW.type::text='PRODUCTION_IN' THEN
    remaining_kg := COALESCE(NEW."totalWeightKg",0);
    IF NEW."sourceType"='SALES_ORDER_WIP_PACKAGING' AND NEW."salesOrderItemId" IS NOT NULL THEN
      SELECT * INTO reservation_row
        FROM "RoastedWipReservation"
       WHERE "salesOrderItemId"=NEW."salesOrderItemId"
         AND "companyId"=NEW."companyId"
         AND status IN ('PARTIAL','RESERVED')
       FOR UPDATE;
      IF reservation_row.id IS NULL THEN
        RAISE EXCEPTION 'Reserva de café torrado não encontrada para o item do pedido';
      END IF;
      FOR allocation_row IN
        SELECT allocation.*,wip."availableKg",wip."reservedKg"
          FROM "RoastedWipReservationAllocation" allocation
          JOIN "RoastedWipLot" wip ON wip.id=allocation."wipLotId"
         WHERE allocation."reservationId"=reservation_row.id
           AND allocation."quantityKg"-allocation."consumedKg">0.0005
         ORDER BY wip."producedAt",allocation.id
         FOR UPDATE OF allocation,wip
      LOOP
        EXIT WHEN remaining_kg<=0.0005;
        take_kg := LEAST(
          allocation_row."quantityKg"-allocation_row."consumedKg",
          remaining_kg
        );
        UPDATE "RoastedWipReservationAllocation"
           SET "consumedKg"="consumedKg"+take_kg
         WHERE id=allocation_row.id;
        UPDATE "RoastedWipLot"
           SET "availableKg"="availableKg"-take_kg,
               "reservedKg"=GREATEST(0,"reservedKg"-take_kg),
               status=CASE WHEN "availableKg"-take_kg<=0.0005 THEN 'CONSUMED' ELSE 'PARTIALLY_PACKED' END,
               "updatedAt"=CURRENT_TIMESTAMP
         WHERE id=allocation_row."wipLotId";
        INSERT INTO "RoastedWipMovement"
          (id,"companyId","wipLotId","productionOrderId",type,"quantityKg",reason,metadata)
        VALUES
          ('wipmov-'||md5(NEW.id||':'||allocation_row."wipLotId"),NEW."companyId",allocation_row."wipLotId",NEW."productionOrderId",'PACK_OUT',take_kg,
           'Consumo da reserva no empacotamento do pedido',jsonb_build_object('finishedGoodsMovementId',NEW.id,'salesOrderItemId',NEW."salesOrderItemId"))
        ON CONFLICT (id) DO NOTHING;
        remaining_kg := remaining_kg-take_kg;
      END LOOP;
      IF remaining_kg>0.0005 THEN
        RAISE EXCEPTION 'Reserva de WIP torrado insuficiente: faltam % kg',remaining_kg;
      END IF;
      UPDATE "RoastedWipReservation" reservation
         SET status=CASE
               WHEN NOT EXISTS (
                 SELECT 1 FROM "RoastedWipReservationAllocation" allocation
                  WHERE allocation."reservationId"=reservation.id
                    AND allocation."quantityKg"-allocation."consumedKg">0.0005
               ) THEN 'CONSUMED'
               ELSE reservation.status
             END,
             "updatedAt"=CURRENT_TIMESTAMP
       WHERE id=reservation_row.id;
    ELSIF NEW."productionOrderId" IS NOT NULL THEN
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
