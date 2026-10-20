-- Retail customers must use the dedicated VAREJO table. The migration is
-- intentionally independent from marketplace and distributor price tables.

INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency,
  "createdAt", "updatedAt"
)
SELECT
  'retail-' || substr(md5(c.id), 1, 24),
  c.id,
  'VAREJO',
  'Varejo',
  'OUTRO'::"SalesChannelType",
  true,
  'Brasil',
  'BRL',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Company" c
ON CONFLICT ("companyId", code) DO UPDATE SET
  name = 'Varejo',
  active = true,
  country = 'Brasil',
  currency = 'BRL',
  "updatedAt" = CURRENT_TIMESTAMP;

WITH official_prices(sku, price) AS (
  VALUES
    ('GOU-ESS-500', 55.00::numeric(14,2)),
    ('GOU-INT-500', 55.00::numeric(14,2)),
    ('CLA-CAR-500', 68.00::numeric(14,2)),
    ('CLA-DOC-500', 68.00::numeric(14,2)),
    ('CLA-TAN-500', 68.00::numeric(14,2)),
    ('EPI-SIN-500', 84.00::numeric(14,2)),
    ('EPI-SUB-500', 84.00::numeric(14,2)),
    ('RAR-RAR-250', 54.00::numeric(14,2))
), retail_rows AS (
  SELECT pv.id AS "productVariantId", pl."companyId", sc.id AS "salesChannelId",
         prices.price
    FROM official_prices prices
    JOIN "ProductVariant" pv ON pv.sku = prices.sku AND pv.active = true
    JOIN "Product" p ON p.id = pv."productId" AND p.active = true
    JOIN "ProductLine" pl ON pl.id = p."productLineId" AND pl.active = true
    JOIN "SalesChannel" sc
      ON sc."companyId" = pl."companyId"
     AND sc.code = 'VAREJO'
     AND sc.active = true
)
UPDATE "ProductPrice" pp
   SET active = false,
       "validUntil" = COALESCE(pp."validUntil", CURRENT_TIMESTAMP),
       "updatedAt" = CURRENT_TIMESTAMP
  FROM retail_rows retail
 WHERE pp."productVariantId" = retail."productVariantId"
   AND pp."salesChannelId" = retail."salesChannelId"
   AND pp.currency = 'BRL'
   AND pp.active = true;

WITH official_prices(sku, price) AS (
  VALUES
    ('GOU-ESS-500', 55.00::numeric(14,2)),
    ('GOU-INT-500', 55.00::numeric(14,2)),
    ('CLA-CAR-500', 68.00::numeric(14,2)),
    ('CLA-DOC-500', 68.00::numeric(14,2)),
    ('CLA-TAN-500', 68.00::numeric(14,2)),
    ('EPI-SIN-500', 84.00::numeric(14,2)),
    ('EPI-SUB-500', 84.00::numeric(14,2)),
    ('RAR-RAR-250', 54.00::numeric(14,2))
), retail_rows AS (
  SELECT pv.id AS "productVariantId", pl."companyId", sc.id AS "salesChannelId",
         prices.price
    FROM official_prices prices
    JOIN "ProductVariant" pv ON pv.sku = prices.sku AND pv.active = true
    JOIN "Product" p ON p.id = pv."productId" AND p.active = true
    JOIN "ProductLine" pl ON pl.id = p."productLineId" AND pl.active = true
    JOIN "SalesChannel" sc
      ON sc."companyId" = pl."companyId"
     AND sc.code = 'VAREJO'
     AND sc.active = true
)
INSERT INTO "ProductPrice" (
  id, "companyId", "productVariantId", "salesChannelId", currency, price,
  active, "validFrom", "validUntil", "maxRequestDiscountPercent",
  "maxApprovalDiscountPercent", "minimumPrice", "minimumMarginPercent",
  "minimumRoiPercent", "createdAt", "updatedAt"
)
SELECT
  'pp-retail-' || substr(md5(retail."companyId" || ':' || retail."productVariantId"), 1, 21),
  retail."companyId",
  retail."productVariantId",
  retail."salesChannelId",
  'BRL',
  retail.price,
  true,
  CURRENT_TIMESTAMP,
  NULL,
  0,
  0,
  NULL,
  NULL,
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM retail_rows retail
ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price,
  active = true,
  "validFrom" = EXCLUDED."validFrom",
  "validUntil" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;
