DO $$
DECLARE
  target_order_id TEXT;
  released_kg DECIMAL(14,3);
BEGIN
  SELECT po.id
  INTO target_order_id
  FROM "ProductionOrder" po
  WHERE po.id = 'cmv5mmnib00npol4h4qrm5kfx'
    AND po.code = 'OP-1791832201499'
    AND po.status::text = 'RESERVED'
    AND po."plannedWeightKg" = 17.000
    AND po."actualOutputKg" IS NULL
  FOR UPDATE;

  IF target_order_id IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ProductionConsumption" pc
    WHERE pc."productionOrderId" = target_order_id
      AND pc."consumedKg" <> 0
  ) OR EXISTS (
    SELECT 1 FROM "ProductionBatch" pb
    WHERE pb."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "FinishedGoodsMovement" fgm
    WHERE fgm."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "PackagingConsumption" pc
    WHERE pc."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "CostEvent" ce
    WHERE ce."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "ProductionResourceUsage" pru
    WHERE pru."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "CostCalculationSnapshot" ccs
    WHERE ccs."productionOrderId" = target_order_id
  ) OR EXISTS (
    SELECT 1 FROM "RoastedWipLot" w
    WHERE w."productionOrderId" = target_order_id
  ) THEN
    RAISE EXCEPTION
      'A OP-1791832201499 possui execução ou custos e não pode ser excluída automaticamente.';
  END IF;

  SELECT COALESCE(SUM(pc."reservedKg"), 0)
  INTO released_kg
  FROM "ProductionConsumption" pc
  WHERE pc."productionOrderId" = target_order_id;

  IF released_kg <> 17.000 THEN
    RAISE EXCEPTION
      'A reserva da OP-1791832201499 mudou: esperado 17 kg, encontrado % kg.',
      released_kg;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "ProductionConsumption" pc
    JOIN "CoffeeLot" cl ON cl.id = pc."coffeeLotId"
    WHERE pc."productionOrderId" = target_order_id
      AND cl."reservedWeightKg" < pc."reservedKg"
  ) THEN
    RAISE EXCEPTION
      'O lote de café não possui saldo reservado suficiente para desfazer a OP-1791832201499.';
  END IF;

  WITH release_by_lot AS (
    SELECT pc."coffeeLotId", SUM(pc."reservedKg") AS quantity
    FROM "ProductionConsumption" pc
    WHERE pc."productionOrderId" = target_order_id
    GROUP BY pc."coffeeLotId"
  )
  UPDATE "CoffeeLot" cl
  SET
    "currentWeightKg" = cl."currentWeightKg" + release_by_lot.quantity,
    "reservedWeightKg" = cl."reservedWeightKg" - release_by_lot.quantity,
    "updatedAt" = CURRENT_TIMESTAMP
  FROM release_by_lot
  WHERE cl.id = release_by_lot."coffeeLotId";

  DELETE FROM "IndustrialEvent"
  WHERE "productionOrderId" = target_order_id;

  DELETE FROM "ProductionOrder"
  WHERE id = target_order_id;
END;
$$;
