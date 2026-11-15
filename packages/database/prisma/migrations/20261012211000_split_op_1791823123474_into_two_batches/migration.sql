DO $$
DECLARE
  target_order_id CONSTANT TEXT := 'cmv5h82s701y7r74grdnkdang';
  first_batch_id CONSTANT TEXT := 'cmv5h8n6i01yvr74gbeg922kj';
  first_wip_id CONSTANT TEXT := 'wip-2d94b5edd9252a051477eb9d0b8ad3b7';
  second_batch_id TEXT := 'batch-' || md5('OP-1791823123474:BATCH:02');
  second_wip_id TEXT;
  target_company_id TEXT;
  target_variant_id TEXT;
  batch_machine TEXT;
  batch_operator TEXT;
  first_started_at TIMESTAMP(3);
  original_completed_at TIMESTAMP(3);
  split_at TIMESTAMP(3);
  roast_cost_per_kg DECIMAL(14,4);
BEGIN
  SELECT
    po."companyId",
    po."productVariantId",
    pb.machine,
    pb.operator,
    pb."startedAt",
    pb."completedAt",
    w."costPerKg"
  INTO
    target_company_id,
    target_variant_id,
    batch_machine,
    batch_operator,
    first_started_at,
    original_completed_at,
    roast_cost_per_kg
  FROM "ProductionOrder" po
  JOIN "ProductionBatch" pb
    ON pb.id = first_batch_id
   AND pb."productionOrderId" = po.id
  JOIN "RoastedWipLot" w
    ON w.id = first_wip_id
   AND w."productionBatchId" = pb.id
  WHERE po.id = target_order_id
    AND po.code = 'OP-1791823123474';

  IF NOT FOUND THEN
    RAISE NOTICE 'OP-1791823123474 not present in this environment; batch split skipped.';
    RETURN;
  END IF;

  PERFORM 1
  FROM "ProductionOrder"
  WHERE id = target_order_id
  FOR UPDATE;

  split_at := first_started_at + ((original_completed_at - first_started_at) / 2);

  UPDATE "ProductionBatch"
  SET
    "greenInputKg" = 15.000,
    "roastedOutputKg" = 15.000,
    "lossKg" = 0.000,
    "lossPercent" = 0.000,
    "completedAt" = split_at,
    notes = CASE
      WHEN COALESCE(notes, '') LIKE '%dividido em duas bateladas de 15 kg%'
        THEN notes
      ELSE CONCAT_WS(
        E'\n',
        NULLIF(notes, ''),
        'Registro operacional dividido em duas bateladas de 15 kg, conforme confirmação do operador.'
      )
    END
  WHERE id = first_batch_id;

  INSERT INTO "ProductionBatch" (
    id,
    "companyId",
    "productionOrderId",
    code,
    machine,
    operator,
    "greenInputKg",
    "roastedOutputKg",
    "lossKg",
    "lossPercent",
    "startedAt",
    "completedAt",
    notes
  )
  VALUES (
    second_batch_id,
    target_company_id,
    target_order_id,
    'TOR-1791823123474-02',
    batch_machine,
    batch_operator,
    15.000,
    15.000,
    0.000,
    0.000,
    split_at,
    original_completed_at,
    'Segunda batelada de 15 kg registrada após confirmação do operador.'
  )
  ON CONFLICT ("productionOrderId", code) DO NOTHING;

  SELECT id
  INTO STRICT second_batch_id
  FROM "ProductionBatch"
  WHERE "productionOrderId" = target_order_id
    AND code = 'TOR-1791823123474-02';

  SELECT id
  INTO STRICT second_wip_id
  FROM "RoastedWipLot"
  WHERE "productionBatchId" = second_batch_id;

  UPDATE "RoastedWipLot"
  SET
    "producedKg" = 15.000,
    "availableKg" = 0.000,
    "costPerKg" = roast_cost_per_kg,
    status = 'CONSUMED',
    "producedAt" = split_at,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = first_wip_id;

  UPDATE "RoastedWipLot"
  SET
    "producedKg" = 15.000,
    "availableKg" = 15.000,
    "costPerKg" = roast_cost_per_kg,
    status = 'AVAILABLE',
    "producedAt" = original_completed_at,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = second_wip_id;

  INSERT INTO "RoastedWipMovement" (
    id,
    "companyId",
    "wipLotId",
    "productionOrderId",
    type,
    "quantityKg",
    reason,
    metadata,
    "occurredAt"
  )
  VALUES (
    'wipmov-' || md5('BATCH-SPLIT-OUT:' || first_batch_id),
    target_company_id,
    first_wip_id,
    target_order_id,
    'ADJUSTMENT_OUT',
    15.000,
    'Transferência auditada para a segunda batelada da mesma OP',
    jsonb_build_object(
      'targetProductionBatchId', second_batch_id,
      'reason', 'Divisão do apontamento consolidado em duas bateladas de 15 kg'
    ),
    CURRENT_TIMESTAMP
  )
  ON CONFLICT (id) DO NOTHING;

  UPDATE "RoastedWipMovement"
  SET
    "occurredAt" = split_at,
    reason = 'Entrada da primeira torra TOR-1791823123474-01',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'registeredAsFirstBatch', true
    )
  WHERE "wipLotId" = first_wip_id
    AND type = 'ROAST_IN';

  UPDATE "RoastedWipMovement"
  SET
    "occurredAt" = original_completed_at,
    reason = 'Entrada da segunda torra TOR-1791823123474-02',
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'registeredAsSecondBatch', true
    )
  WHERE "wipLotId" = second_wip_id
    AND type = 'ROAST_IN';

  UPDATE "IndustrialEvent"
  SET
    "quantityKg" = 15.000,
    "occurredAt" = split_at,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'batchSequence', 1,
      'splitFromConsolidatedRecord', true
    )
  WHERE "productionOrderId" = target_order_id
    AND type::text = 'ROAST'
    AND metadata->>'batchId' = first_batch_id;

  UPDATE "IndustrialEvent"
  SET
    "quantityKg" = 0.000,
    "occurredAt" = split_at,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'lossPercent', 0,
      'batchSequence', 1,
      'splitFromConsolidatedRecord', true
    )
  WHERE "productionOrderId" = target_order_id
    AND type::text = 'LOSS'
    AND metadata->>'batchId' = first_batch_id;

  INSERT INTO "IndustrialEvent" (
    id,
    "companyId",
    "productionOrderId",
    type,
    "quantityKg",
    metadata,
    "occurredAt"
  )
  VALUES
    (
      'event-' || md5('ROAST:' || second_batch_id),
      target_company_id,
      target_order_id,
      'ROAST',
      15.000,
      jsonb_build_object(
        'batchId', second_batch_id,
        'machine', batch_machine,
        'operator', batch_operator,
        'batchSequence', 2,
        'registeredAfterOperatorConfirmation', true
      ),
      original_completed_at
    ),
    (
      'event-' || md5('LOSS:' || second_batch_id),
      target_company_id,
      target_order_id,
      'LOSS',
      0.000,
      jsonb_build_object(
        'batchId', second_batch_id,
        'lossPercent', 0,
        'batchSequence', 2,
        'registeredAfterOperatorConfirmation', true
      ),
      original_completed_at
    )
  ON CONFLICT (id) DO NOTHING;

  UPDATE "ProductionOrder"
  SET
    "actualInputKg" = 30.000,
    "actualOutputKg" = 15.000,
    "updatedAt" = CURRENT_TIMESTAMP
  WHERE id = target_order_id;
END $$;
