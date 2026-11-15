DO $$
DECLARE
  target_order_id CONSTANT TEXT := 'cmv5h82s701y7r74grdnkdang';
  target_order_code CONSTANT TEXT := 'OP-1791823123474';
  target_batch_id TEXT;
  target_wip_id TEXT;
  finished_weight_kg DECIMAL(14,3);
  corrected_available_kg DECIMAL(14,3);
  corrected_roast_cost_per_kg DECIMAL(14,4);
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "ProductionOrder"
    WHERE id = target_order_id
      AND code = target_order_code
  ) THEN
    RAISE NOTICE 'OP % not present in this environment; correction skipped.', target_order_code;
    RETURN;
  END IF;

  PERFORM 1
  FROM "ProductionOrder"
  WHERE id = target_order_id
  FOR UPDATE;

  SELECT id
  INTO STRICT target_batch_id
  FROM "ProductionBatch"
  WHERE "productionOrderId" = target_order_id
    AND code = 'TOR-1791823123474-01';

  SELECT id
  INTO STRICT target_wip_id
  FROM "RoastedWipLot"
  WHERE "productionOrderId" = target_order_id
    AND "productionBatchId" = target_batch_id;

  SELECT COALESCE(SUM("totalWeightKg"), 0)
  INTO finished_weight_kg
  FROM "FinishedGoodsMovement"
  WHERE "productionOrderId" = target_order_id
    AND type::text = 'PRODUCTION_IN';

  corrected_available_kg := 30.000 - finished_weight_kg;
  IF corrected_available_kg < 0 THEN
    RAISE EXCEPTION
      'Cannot correct %: finished weight % kg exceeds confirmed roasted output of 30 kg.',
      target_order_code,
      finished_weight_kg;
  END IF;

  SELECT ROUND(
    (
      COALESCE((
        SELECT SUM("reservedKg" * "realCostPerKg")
        FROM "ProductionConsumption"
        WHERE "productionOrderId" = target_order_id
      ), 0)
      + COALESCE((
        SELECT SUM(amount)
        FROM "CostEvent"
        WHERE "productionOrderId" = target_order_id
          AND type::text IN ('ENERGY', 'GAS')
      ), 0)
    ) / 30.000,
    4
  )
  INTO corrected_roast_cost_per_kg;

  UPDATE "ProductionBatch"
  SET
    "roastedOutputKg" = 30.000,
    "lossKg" = 0.000,
    "lossPercent" = 0.000,
    notes = CASE
      WHEN COALESCE(notes, '') LIKE '%saída torrada real confirmada em 30 kg%'
        THEN notes
      ELSE CONCAT_WS(
        E'\n',
        NULLIF(notes, ''),
        'Correção auditada: saída torrada real confirmada em 30 kg; apontamento anterior de 25,5 kg substituído.'
      )
    END
  WHERE id = target_batch_id;

  UPDATE "IndustrialEvent"
  SET
    "quantityKg" = 30.000,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'correctedFromKg', 25.500,
      'correctionReason', 'Saída torrada real confirmada pelo operador'
    )
  WHERE "productionOrderId" = target_order_id
    AND type::text = 'ROAST'
    AND metadata->>'batchId' = target_batch_id;

  UPDATE "IndustrialEvent"
  SET
    "quantityKg" = 0.000,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'lossPercent', 0,
      'correctedFromKg', 4.500,
      'correctionReason', 'Saída torrada real confirmada pelo operador'
    )
  WHERE "productionOrderId" = target_order_id
    AND type::text = 'LOSS'
    AND metadata->>'batchId' = target_batch_id;

  UPDATE "RoastedWipLot"
  SET
    "producedKg" = 30.000,
    "availableKg" = corrected_available_kg,
    "costPerKg" = corrected_roast_cost_per_kg,
    status = CASE
      WHEN corrected_available_kg <= 0.0005 THEN 'CONSUMED'
      WHEN corrected_available_kg < 30.000 THEN 'PARTIALLY_PACKED'
      ELSE 'AVAILABLE'
    END,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = target_wip_id;

  INSERT INTO "RoastedWipMovement" (
    id,
    "companyId",
    "wipLotId",
    "productionOrderId",
    type,
    "quantityKg",
    reason,
    metadata
  )
  SELECT
    'wipmov-' || md5('CORRECTION:30KG:' || target_batch_id),
    "companyId",
    target_wip_id,
    target_order_id,
    'ADJUSTMENT_IN',
    4.500,
    'Correção da saída torrada real de 25,5 kg para 30 kg',
    jsonb_build_object(
      'previousRoastedOutputKg', 25.500,
      'correctedRoastedOutputKg', 30.000,
      'confirmedByOperator', true
    )
  FROM "ProductionOrder"
  WHERE id = target_order_id
  ON CONFLICT (id) DO NOTHING;

  UPDATE "ProductionOrder"
  SET
    "actualInputKg" = 30.000,
    "actualOutputKg" = finished_weight_kg,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = target_order_id;
END $$;
