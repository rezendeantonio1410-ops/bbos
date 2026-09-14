CREATE SEQUENCE IF NOT EXISTS bbos_finished_goods_lot_seq START 1;

CREATE TABLE IF NOT EXISTS "RoastedWipLot" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "productionOrderId" TEXT NOT NULL REFERENCES "ProductionOrder"(id) ON DELETE CASCADE,
  "productionBatchId" TEXT NOT NULL REFERENCES "ProductionBatch"(id) ON DELETE CASCADE,
  "productVariantId" TEXT REFERENCES "ProductVariant"(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  "producedKg" DECIMAL(14,3) NOT NULL,
  "availableKg" DECIMAL(14,3) NOT NULL,
  "reservedKg" DECIMAL(14,3) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  "producedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("productionBatchId"),
  CHECK (status IN ('AVAILABLE','PARTIALLY_PACKED','CONSUMED','BLOCKED')),
  CHECK ("producedKg" >= 0 AND "availableKg" >= 0 AND "reservedKg" >= 0)
);
CREATE INDEX IF NOT EXISTS "RoastedWipLot_company_status_idx" ON "RoastedWipLot"("companyId",status,"producedAt");

CREATE TABLE IF NOT EXISTS "RoastedWipMovement" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "wipLotId" TEXT NOT NULL REFERENCES "RoastedWipLot"(id) ON DELETE CASCADE,
  "productionOrderId" TEXT REFERENCES "ProductionOrder"(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  "quantityKg" DECIMAL(14,3) NOT NULL,
  reason TEXT,
  metadata JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (type IN ('ROAST_IN','PACK_OUT','ADJUSTMENT_IN','ADJUSTMENT_OUT','LOSS_OUT'))
);

CREATE TABLE IF NOT EXISTS "FinishedGoodsLot" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "finishedProductId" TEXT NOT NULL REFERENCES "FinishedProduct"(id) ON DELETE CASCADE,
  "productVariantId" TEXT REFERENCES "ProductVariant"(id) ON DELETE SET NULL,
  "productionOrderId" TEXT REFERENCES "ProductionOrder"(id) ON DELETE SET NULL,
  "warehouseId" TEXT NOT NULL REFERENCES "Warehouse"(id) ON DELETE RESTRICT,
  "sourceMovementId" TEXT REFERENCES "FinishedGoodsMovement"(id) ON DELETE SET NULL,
  code TEXT NOT NULL,
  "manufacturedAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "initialUnits" INTEGER NOT NULL,
  "quantityOnHand" INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("sourceMovementId"),
  UNIQUE("companyId",code),
  CHECK (status IN ('AVAILABLE','QUARANTINE','BLOCKED','DEPLETED','EXPIRED','LEGACY')),
  CHECK ("initialUnits" >= 0 AND "quantityOnHand" >= 0)
);
CREATE INDEX IF NOT EXISTS "FinishedGoodsLot_fefo_idx" ON "FinishedGoodsLot"("finishedProductId","expiresAt","manufacturedAt");

CREATE TABLE IF NOT EXISTS "FinishedGoodsLotAllocation" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "finishedGoodsMovementId" TEXT NOT NULL REFERENCES "FinishedGoodsMovement"(id) ON DELETE CASCADE,
  "finishedGoodsLotId" TEXT NOT NULL REFERENCES "FinishedGoodsLot"(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("finishedGoodsMovementId","finishedGoodsLotId")
);

CREATE OR REPLACE FUNCTION bbos_create_roasted_wip() RETURNS trigger AS $$
DECLARE variant_id TEXT; wip_id TEXT;
BEGIN
  SELECT "productVariantId" INTO variant_id FROM "ProductionOrder" WHERE id=NEW."productionOrderId";
  wip_id := 'wip-' || md5(NEW.id);
  INSERT INTO "RoastedWipLot"(id,"companyId","productionOrderId","productionBatchId","productVariantId",code,"producedKg","availableKg","producedAt")
  VALUES(wip_id,NEW."companyId",NEW."productionOrderId",NEW.id,variant_id,'WIP-' || NEW.code,NEW."roastedOutputKg",NEW."roastedOutputKg",COALESCE(NEW."completedAt",CURRENT_TIMESTAMP))
  ON CONFLICT ("productionBatchId") DO NOTHING;
  INSERT INTO "RoastedWipMovement"(id,"companyId","wipLotId","productionOrderId",type,"quantityKg",reason)
  VALUES('wipmov-' || md5('ROAST:' || NEW.id),NEW."companyId",wip_id,NEW."productionOrderId",'ROAST_IN',NEW."roastedOutputKg",'Entrada da torra ' || NEW.code)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "ProductionBatch_create_wip_trg" ON "ProductionBatch";
CREATE TRIGGER "ProductionBatch_create_wip_trg" AFTER INSERT ON "ProductionBatch" FOR EACH ROW EXECUTE FUNCTION bbos_create_roasted_wip();

CREATE OR REPLACE FUNCTION bbos_trace_finished_goods() RETURNS trigger AS $$
DECLARE remaining_kg DECIMAL(14,3); remaining_units INTEGER; take_kg DECIMAL(14,3); take_units INTEGER; w RECORD; l RECORD; lot_code TEXT; lot_id TEXT; has_lots INTEGER;
BEGIN
  IF NEW.type::text='PRODUCTION_IN' AND NEW."productionOrderId" IS NOT NULL THEN
    remaining_kg := COALESCE(NEW."totalWeightKg",0);
    FOR w IN SELECT * FROM "RoastedWipLot" WHERE "productionOrderId"=NEW."productionOrderId" AND status IN ('AVAILABLE','PARTIALLY_PACKED') AND "availableKg">0 ORDER BY "producedAt",id FOR UPDATE LOOP
      EXIT WHEN remaining_kg<=0.0005;
      take_kg := LEAST(w."availableKg",remaining_kg);
      UPDATE "RoastedWipLot" SET "availableKg"="availableKg"-take_kg,status=CASE WHEN "availableKg"-take_kg<=0.0005 THEN 'CONSUMED' ELSE 'PARTIALLY_PACKED' END,"updatedAt"=CURRENT_TIMESTAMP WHERE id=w.id;
      INSERT INTO "RoastedWipMovement"(id,"companyId","wipLotId","productionOrderId",type,"quantityKg",reason,metadata)
      VALUES('wipmov-'||md5(NEW.id||':'||w.id),NEW."companyId",w.id,NEW."productionOrderId",'PACK_OUT',take_kg,'Consumo no empacotamento',jsonb_build_object('finishedGoodsMovementId',NEW.id)) ON CONFLICT (id) DO NOTHING;
      remaining_kg := remaining_kg-take_kg;
    END LOOP;
    IF remaining_kg>0.0005 THEN RAISE EXCEPTION 'WIP torrado insuficiente: faltam % kg',remaining_kg; END IF;
    lot_code := 'PA-'||to_char(CURRENT_TIMESTAMP,'YYYY')||'-'||lpad(nextval('bbos_finished_goods_lot_seq')::text,6,'0');
    lot_id := 'fglot-'||md5(NEW.id);
    INSERT INTO "FinishedGoodsLot"(id,"companyId","finishedProductId","productVariantId","productionOrderId","warehouseId","sourceMovementId",code,"manufacturedAt","initialUnits","quantityOnHand")
    VALUES(lot_id,NEW."companyId",NEW."finishedProductId",NEW."productVariantId",NEW."productionOrderId",NEW."warehouseId",NEW.id,lot_code,CURRENT_TIMESTAMP,NEW."packageQuantity",NEW."packageQuantity") ON CONFLICT ("sourceMovementId") DO NOTHING;
  ELSIF NEW.type::text='SALE_OUT' THEN
    SELECT COUNT(*) INTO has_lots FROM "FinishedGoodsLot" WHERE "finishedProductId"=NEW."finishedProductId" AND "quantityOnHand">0;
    IF has_lots>0 THEN
      remaining_units := NEW."packageQuantity";
      FOR l IN SELECT * FROM "FinishedGoodsLot" WHERE "finishedProductId"=NEW."finishedProductId" AND "quantityOnHand">0 AND status NOT IN ('BLOCKED','EXPIRED','QUARANTINE') ORDER BY "expiresAt" NULLS LAST,"manufacturedAt",id FOR UPDATE LOOP
        EXIT WHEN remaining_units<=0;
        take_units := LEAST(l."quantityOnHand",remaining_units);
        UPDATE "FinishedGoodsLot" SET "quantityOnHand"="quantityOnHand"-take_units,status=CASE WHEN "quantityOnHand"-take_units=0 THEN 'DEPLETED' ELSE status END,"updatedAt"=CURRENT_TIMESTAMP WHERE id=l.id;
        INSERT INTO "FinishedGoodsLotAllocation"(id,"companyId","finishedGoodsMovementId","finishedGoodsLotId",quantity)
        VALUES('fgalloc-'||md5(NEW.id||':'||l.id),NEW."companyId",NEW.id,l.id,take_units) ON CONFLICT DO NOTHING;
        remaining_units := remaining_units-take_units;
      END LOOP;
      IF remaining_units>0 THEN RAISE EXCEPTION 'Lotes PA insuficientes: faltam % unidades',remaining_units; END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "FinishedGoodsMovement_traceability_trg" ON "FinishedGoodsMovement";
CREATE TRIGGER "FinishedGoodsMovement_traceability_trg" AFTER INSERT ON "FinishedGoodsMovement" FOR EACH ROW EXECUTE FUNCTION bbos_trace_finished_goods();

INSERT INTO "FinishedGoodsLot"(id,"companyId","finishedProductId","productVariantId","warehouseId",code,"manufacturedAt","initialUnits","quantityOnHand",status)
SELECT 'fglot-legacy-'||md5(fp.id),fp."companyId",fp.id,fp."productVariantId",fp."warehouseId",'LEGACY-'||upper(substr(md5(fp.id),1,10)),CURRENT_TIMESTAMP,fp."quantityOnHand",fp."quantityOnHand",'LEGACY'
FROM "FinishedProduct" fp WHERE fp."quantityOnHand">0 AND NOT EXISTS (SELECT 1 FROM "FinishedGoodsLot" l WHERE l."finishedProductId"=fp.id)
ON CONFLICT DO NOTHING;
