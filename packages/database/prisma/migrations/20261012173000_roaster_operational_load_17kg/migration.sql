-- Referência operacional do Torrador 01: até 17 kg de café verde por ciclo.
-- O consumo permanece inalterado por ciclo: 10 min de gás e 12 min de energia.

UPDATE "ProductiveResource"
SET
  name = 'Torrador Atilla Huno 15 kg • carga operacional 17 kg',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE code = 'TOR-01';

WITH order_cycles AS (
  SELECT
    batch."productionOrderId",
    resource.id AS "resourceId",
    SUM(CEIL(batch."greenInputKg" / 17.0)) AS cycles
  FROM "ProductionBatch" batch
  JOIN "ProductionOrder" production_order
    ON production_order.id = batch."productionOrderId"
  JOIN "ProductiveResource" resource
    ON resource."companyId" = production_order."companyId"
    AND resource.code = 'TOR-01'
  GROUP BY batch."productionOrderId", resource.id
)
UPDATE "ProductionResourceUsage" usage
SET
  "machineHours" = order_cycles.cycles * (12.0 / 60.0),
  "measuredEnergy" = order_cycles.cycles * (12.0 / 60.0) * resource."energyConsumption",
  "measuredGas" = order_cycles.cycles * (10.0 / 60.0) * resource."gasConsumption",
  notes = 'Carga operacional de até 17 kg: 10 min de torra + 2 min de resfriamento por batelada.',
  "updatedAt" = CURRENT_TIMESTAMP
FROM order_cycles
JOIN "ProductiveResource" resource ON resource.id = order_cycles."resourceId"
WHERE usage."productionOrderId" = order_cycles."productionOrderId"
  AND usage."resourceId" = order_cycles."resourceId";

-- Preserva os eventos financeiros originais e acrescenta somente a diferença
-- necessária para OPs antigas que concentraram mais de 17 kg em um registro.
WITH order_cycles AS (
  SELECT
    production_order.id AS "productionOrderId",
    production_order."companyId",
    production_order."productVariantId",
    production_order.code AS "orderCode",
    production_order."completedAt",
    MAX(batch."completedAt") AS "lastBatchAt",
    resource.id AS "resourceId",
    resource."costCenterId",
    resource."energyConsumption",
    resource."energyRatePerKwh",
    resource."gasConsumption",
    resource."gasRatePerUnit",
    SUM(CEIL(batch."greenInputKg" / 17.0)) AS cycles
  FROM "ProductionOrder" production_order
  JOIN "ProductionBatch" batch
    ON batch."productionOrderId" = production_order.id
  JOIN "ProductiveResource" resource
    ON resource."companyId" = production_order."companyId"
    AND resource.code = 'TOR-01'
  GROUP BY
    production_order.id,
    production_order."companyId",
    production_order."productVariantId",
    production_order.code,
    production_order."completedAt",
    resource.id,
    resource."costCenterId",
    resource."energyConsumption",
    resource."energyRatePerKwh",
    resource."gasConsumption",
    resource."gasRatePerUnit"
),
expected AS (
  SELECT
    order_cycles.*,
    ROUND(
      order_cycles.cycles * (12.0 / 60.0)
        * order_cycles."energyConsumption"
        * order_cycles."energyRatePerKwh",
      2
    ) AS "expectedEnergyCost",
    ROUND(
      order_cycles.cycles * (10.0 / 60.0)
        * order_cycles."gasConsumption"
        * order_cycles."gasRatePerUnit",
      2
    ) AS "expectedGasCost"
  FROM order_cycles
),
recorded AS (
  SELECT
    cost_event."productionOrderId",
    SUM(cost_event.amount) FILTER (WHERE cost_event.type = 'ENERGY') AS "recordedEnergyCost",
    SUM(cost_event.amount) FILTER (WHERE cost_event.type = 'GAS') AS "recordedGasCost"
  FROM "CostEvent" cost_event
  WHERE cost_event.type IN ('ENERGY', 'GAS')
    AND cost_event."productionOrderId" IS NOT NULL
  GROUP BY cost_event."productionOrderId"
),
deltas AS (
  SELECT
    expected.*,
    'ENERGY' AS type,
    expected."expectedEnergyCost" - COALESCE(recorded."recordedEnergyCost", 0) AS amount
  FROM expected
  JOIN recorded ON recorded."productionOrderId" = expected."productionOrderId"

  UNION ALL

  SELECT
    expected.*,
    'GAS' AS type,
    expected."expectedGasCost" - COALESCE(recorded."recordedGasCost", 0) AS amount
  FROM expected
  JOIN recorded ON recorded."productionOrderId" = expected."productionOrderId"
)
INSERT INTO "CostEvent" (
  id,
  "companyId",
  "productionOrderId",
  "productVariantId",
  type,
  nature,
  "costCenterId",
  "resourceId",
  amount,
  description,
  notes,
  "competenceAt",
  "occurredAt",
  "createdAt"
)
SELECT
  'cost-adjust-17kg-' || md5(deltas."productionOrderId" || ':' || deltas.type),
  deltas."companyId",
  deltas."productionOrderId",
  deltas."productVariantId",
  deltas.type::"CostType",
  'INDIRECT_INDUSTRIAL'::"CostNature",
  deltas."costCenterId",
  deltas."resourceId",
  deltas.amount,
  deltas."orderCode" || ' • ajuste operacional: carga de 17 kg por batelada',
  'Complemento auditável de energia ou gás; os lançamentos anteriores foram preservados.',
  COALESCE(deltas."completedAt", deltas."lastBatchAt"),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM deltas
WHERE deltas.amount >= 0.01
ON CONFLICT (id) DO NOTHING;
