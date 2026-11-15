ALTER TABLE "RoastedWipLot"
  ADD COLUMN IF NOT EXISTS "costPerKg" DECIMAL(14,4),
  ADD COLUMN IF NOT EXISTS "producedCost" DECIMAL(14,2),
  ADD COLUMN IF NOT EXISTS "availableCost" DECIMAL(14,2);

ALTER TABLE "RoastedWipLot"
  DROP CONSTRAINT IF EXISTS "RoastedWipLot_non_negative_cost_check";
ALTER TABLE "RoastedWipLot"
  ADD CONSTRAINT "RoastedWipLot_non_negative_cost_check"
  CHECK (
    ("costPerKg" IS NULL OR "costPerKg" >= 0) AND
    ("producedCost" IS NULL OR "producedCost" >= 0) AND
    ("availableCost" IS NULL OR "availableCost" >= 0)
  );

CREATE OR REPLACE FUNCTION bbos_value_roasted_wip() RETURNS trigger AS $$
BEGIN
  IF NEW."costPerKg" IS NULL THEN
    NEW."producedCost" := NULL;
    NEW."availableCost" := NULL;
  ELSE
    NEW."producedCost" := ROUND(NEW."producedKg" * NEW."costPerKg", 2);
    NEW."availableCost" := ROUND(NEW."availableKg" * NEW."costPerKg", 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "RoastedWipLot_value_trg" ON "RoastedWipLot";
CREATE TRIGGER "RoastedWipLot_value_trg"
BEFORE INSERT OR UPDATE OF "producedKg", "availableKg", "costPerKg"
ON "RoastedWipLot"
FOR EACH ROW EXECUTE FUNCTION bbos_value_roasted_wip();

WITH green_cost AS (
  SELECT
    pc."productionOrderId",
    SUM(pc."reservedKg" * pc."realCostPerKg") AS amount
  FROM "ProductionConsumption" pc
  GROUP BY pc."productionOrderId"
), utility_cost AS (
  SELECT
    ce."productionOrderId",
    SUM(ce.amount) AS amount
  FROM "CostEvent" ce
  WHERE ce."productionOrderId" IS NOT NULL
    AND ce.type::text IN ('ENERGY', 'GAS')
  GROUP BY ce."productionOrderId"
), roasted_output AS (
  SELECT
    pb."productionOrderId",
    SUM(pb."roastedOutputKg") AS quantity
  FROM "ProductionBatch" pb
  GROUP BY pb."productionOrderId"
), order_roast_cost AS (
  SELECT
    ro."productionOrderId",
    (COALESCE(gc.amount, 0) + COALESCE(uc.amount, 0)) /
      NULLIF(ro.quantity, 0) AS "costPerKg"
  FROM roasted_output ro
  LEFT JOIN green_cost gc
    ON gc."productionOrderId" = ro."productionOrderId"
  LEFT JOIN utility_cost uc
    ON uc."productionOrderId" = ro."productionOrderId"
)
UPDATE "RoastedWipLot" w
SET
  "costPerKg" = ROUND(orc."costPerKg", 4),
  "updatedAt" = CURRENT_TIMESTAMP
FROM order_roast_cost orc
WHERE orc."productionOrderId" = w."productionOrderId"
  AND orc."costPerKg" IS NOT NULL;
