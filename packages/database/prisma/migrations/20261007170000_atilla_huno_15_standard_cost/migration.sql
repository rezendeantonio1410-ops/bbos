-- Base operacional da torra Bispo Coffees.
-- Fontes: ficha técnica Atilla Huno 15 kg e tarifa Copel grupo B vigente.

INSERT INTO "CostCenter" (
  id, "companyId", code, name, category, description, active,
  "allocationMethod", "monthlyBudget", "createdAt", "updatedAt"
)
SELECT
  'cc-' || md5(company.id || ':IND-TOR'), company.id, 'IND-TOR', 'Torrefação',
  'INDUSTRIAL', 'Torra e utilidades do processo industrial', true,
  'MACHINE_HOURS', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
ON CONFLICT ("companyId", code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  active = true,
  "allocationMethod" = EXCLUDED."allocationMethod",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CostCenter" (
  id, "companyId", code, name, category, description, active,
  "allocationMethod", "monthlyBudget", "createdAt", "updatedAt"
)
SELECT
  'cc-' || md5(company.id || ':IND-EMP'), company.id, 'IND-EMP', 'Empacotamento',
  'INDUSTRIAL', 'Embalagem e entrada de produto acabado', true,
  'UNITS_PRODUCED', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
ON CONFLICT ("companyId", code) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  active = true,
  "allocationMethod" = EXCLUDED."allocationMethod",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "ProductiveResource" (
  id, "companyId", "costCenterId", name, code, "purchaseValue",
  "residualValue", "usefulLifeMonths", "expectedProductiveHours",
  "maintenanceCostEstimate", "energyConsumption", "energyRatePerKwh",
  "gasConsumption", "gasRatePerUnit", "otherHourlyCost", active,
  "createdAt", "updatedAt"
)
SELECT
  'pr-' || md5(company.id || ':TOR-01'), company.id, center.id,
  'Torrador Atilla Huno 15 kg', 'TOR-01', 0, 0, 120, 176, 0,
  1.3700, 1.0300, 3.5000, 8.8889, 0, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
JOIN "CostCenter" center
  ON center."companyId" = company.id AND center.code = 'IND-TOR'
ON CONFLICT ("companyId", code) DO UPDATE SET
  "costCenterId" = EXCLUDED."costCenterId",
  name = EXCLUDED.name,
  "energyConsumption" = EXCLUDED."energyConsumption",
  "energyRatePerKwh" = EXCLUDED."energyRatePerKwh",
  "gasConsumption" = EXCLUDED."gasConsumption",
  "gasRatePerUnit" = EXCLUDED."gasRatePerUnit",
  active = true,
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "CostTariff" (
  id, "companyId", type, name, unit, value, "validFrom", "validUntil",
  "supplierId", "costCenterId", "resourceId", active, "createdAt", "updatedAt"
)
SELECT
  'ct-' || md5(company.id || ':ENERGY:2026-06-24'), company.id, 'ENERGY',
  'Copel grupo B convencional — padrão operacional', 'R$/kWh', 1.030000,
  TIMESTAMP '2026-06-24 00:00:00', NULL, NULL, center.id, resource.id, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
JOIN "CostCenter" center
  ON center."companyId" = company.id AND center.code = 'IND-TOR'
JOIN "ProductiveResource" resource
  ON resource."companyId" = company.id AND resource.code = 'TOR-01'
WHERE NOT EXISTS (
  SELECT 1 FROM "CostTariff" tariff
  WHERE tariff."companyId" = company.id
    AND tariff.type = 'ENERGY'
    AND tariff.name = 'Copel grupo B convencional — padrão operacional'
    AND tariff."validFrom" = TIMESTAMP '2026-06-24 00:00:00'
);

INSERT INTO "CostTariff" (
  id, "companyId", type, name, unit, value, "validFrom", "validUntil",
  "supplierId", "costCenterId", "resourceId", active, "createdAt", "updatedAt"
)
SELECT
  'ct-' || md5(company.id || ':GAS:2026-10-07'), company.id, 'GAS',
  'GLP P45 — R$ 400,00 por 45 kg', 'R$/kg', 8.888889,
  TIMESTAMP '2026-10-07 00:00:00', NULL, NULL, center.id, resource.id, true,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Company" company
JOIN "CostCenter" center
  ON center."companyId" = company.id AND center.code = 'IND-TOR'
JOIN "ProductiveResource" resource
  ON resource."companyId" = company.id AND resource.code = 'TOR-01'
WHERE NOT EXISTS (
  SELECT 1 FROM "CostTariff" tariff
  WHERE tariff."companyId" = company.id
    AND tariff.type = 'GAS'
    AND tariff.name = 'GLP P45 — R$ 400,00 por 45 kg'
    AND tariff."validFrom" = TIMESTAMP '2026-10-07 00:00:00'
);
