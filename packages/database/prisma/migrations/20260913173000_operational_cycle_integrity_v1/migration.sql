-- BBOS operational cycle integrity v1
-- Protect the source-of-truth from silent cost loss and production over-consumption.

CREATE OR REPLACE FUNCTION bbos_derive_receipt_lot_cost()
RETURNS trigger AS $$
DECLARE
  derived_cost numeric;
BEGIN
  SELECT COALESCE(
           NULLIF(p."pricePerKg", 0),
           p."totalValue" / NULLIF(p."contractedWeightKg", 0),
           0
         ) * NEW."netWeightKg"
    INTO derived_cost
    FROM "GreenCoffeePurchase" p
   WHERE p.id = NEW."purchaseId";

  IF COALESCE(derived_cost, 0) > 0 THEN
    UPDATE "CoffeeLot"
       SET "purchaseCost" = CASE WHEN COALESCE("purchaseCost", 0) = 0 THEN derived_cost ELSE "purchaseCost" END,
           "landedCost"   = CASE WHEN COALESCE("landedCost", 0) = 0 THEN derived_cost ELSE "landedCost" END
     WHERE id = NEW."coffeeLotId";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "GreenCoffeeReceipt_derive_lot_cost_trg" ON "GreenCoffeeReceipt";
CREATE TRIGGER "GreenCoffeeReceipt_derive_lot_cost_trg"
AFTER INSERT OR UPDATE OF "netWeightKg", "purchaseId" ON "GreenCoffeeReceipt"
FOR EACH ROW EXECUTE FUNCTION bbos_derive_receipt_lot_cost();

-- Backfill historical lots whose receipt is linked to a priced purchase but whose lot cost was left at zero.
UPDATE "CoffeeLot" l
   SET "purchaseCost" = COALESCE(NULLIF(p."pricePerKg", 0), p."totalValue" / NULLIF(p."contractedWeightKg", 0), 0) * r."netWeightKg",
       "landedCost"   = COALESCE(NULLIF(p."pricePerKg", 0), p."totalValue" / NULLIF(p."contractedWeightKg", 0), 0) * r."netWeightKg"
  FROM "GreenCoffeeReceipt" r
  JOIN "GreenCoffeePurchase" p ON p.id = r."purchaseId"
 WHERE r."coffeeLotId" = l.id
   AND COALESCE(l."purchaseCost", 0) = 0
   AND COALESCE(l."landedCost", 0) = 0
   AND COALESCE(NULLIF(p."pricePerKg", 0), p."totalValue" / NULLIF(p."contractedWeightKg", 0), 0) > 0;

CREATE OR REPLACE FUNCTION bbos_guard_production_batch_input()
RETURNS trigger AS $$
DECLARE
  reserved_total numeric;
  existing_input numeric;
BEGIN
  SELECT COALESCE(SUM("reservedKg"), 0)
    INTO reserved_total
    FROM "ProductionConsumption"
   WHERE "productionOrderId" = NEW."productionOrderId";

  SELECT COALESCE(SUM("greenInputKg"), 0)
    INTO existing_input
    FROM "ProductionBatch"
   WHERE "productionOrderId" = NEW."productionOrderId"
     AND id <> NEW.id;

  IF reserved_total <= 0 THEN
    RAISE EXCEPTION 'OP sem reserva de café verde não pode receber batch de torra.';
  END IF;

  IF existing_input + NEW."greenInputKg" > reserved_total + 0.001 THEN
    RAISE EXCEPTION 'Entrada acumulada de torra excede a reserva da OP (% kg > % kg).', existing_input + NEW."greenInputKg", reserved_total;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductionBatch_guard_reserved_input_trg" ON "ProductionBatch";
CREATE TRIGGER "ProductionBatch_guard_reserved_input_trg"
BEFORE INSERT OR UPDATE OF "greenInputKg", "productionOrderId" ON "ProductionBatch"
FOR EACH ROW EXECUTE FUNCTION bbos_guard_production_batch_input();

CREATE OR REPLACE FUNCTION bbos_guard_production_completion()
RETURNS trigger AS $$
DECLARE
  reserved_total numeric;
  batch_input_total numeric;
BEGIN
  IF NEW.status::text = 'COMPLETED' AND OLD.status::text IS DISTINCT FROM 'COMPLETED' THEN
    SELECT COALESCE(SUM("reservedKg"), 0)
      INTO reserved_total
      FROM "ProductionConsumption"
     WHERE "productionOrderId" = NEW.id;

    SELECT COALESCE(SUM("greenInputKg"), 0)
      INTO batch_input_total
      FROM "ProductionBatch"
     WHERE "productionOrderId" = NEW.id;

    IF batch_input_total <= 0 THEN
      RAISE EXCEPTION 'OP sem batch de torra não pode ser concluída.';
    END IF;

    IF ABS(batch_input_total - reserved_total) > 0.001 THEN
      RAISE EXCEPTION 'OP não pode ser concluída com reserva e consumo divergentes (% kg reservados; % kg torrados).', reserved_total, batch_input_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "ProductionOrder_guard_completion_trg" ON "ProductionOrder";
CREATE TRIGGER "ProductionOrder_guard_completion_trg"
BEFORE UPDATE OF status ON "ProductionOrder"
FOR EACH ROW EXECUTE FUNCTION bbos_guard_production_completion();

-- Every finished-goods production entry must leave an auditable packaging event in the industrial timeline.
CREATE OR REPLACE FUNCTION bbos_record_pack_event_from_finished_goods()
RETURNS trigger AS $$
BEGIN
  IF NEW.type::text = 'PRODUCTION_IN' THEN
    INSERT INTO "IndustrialEvent" (
      id, "companyId", "productionOrderId", "warehouseId", type, "quantityKg", metadata, "occurredAt"
    ) VALUES (
      'pack-event-' || md5(NEW.id),
      NEW."companyId",
      NEW."productionOrderId",
      NEW."warehouseId",
      'PACK',
      NEW."totalWeightKg",
      jsonb_build_object(
        'finishedGoodsMovementId', NEW.id,
        'finishedProductId', NEW."finishedProductId",
        'productVariantId', NEW."productVariantId",
        'packageQuantity', NEW."packageQuantity",
        'unit', NEW.unit
      ),
      NEW."occurredAt"
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "FinishedGoodsMovement_pack_event_trg" ON "FinishedGoodsMovement";
CREATE TRIGGER "FinishedGoodsMovement_pack_event_trg"
AFTER INSERT ON "FinishedGoodsMovement"
FOR EACH ROW EXECUTE FUNCTION bbos_record_pack_event_from_finished_goods();
