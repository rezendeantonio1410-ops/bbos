-- Official Bispo distributor price table (Traditional line intentionally excluded).
-- New prices become effective now; previous active distributor prices for the same
-- product/presentation are closed to preserve price history.

WITH target AS (
  SELECT
    pv.id AS "productVariantId",
    pl."companyId",
    CASE
      WHEN lower(p.name) IN ('essencial', 'intenso') AND pv."netWeightGrams" = 500 THEN 44.00
      WHEN lower(p.name) IN ('caramelo', 'doce de leite', 'tangerina') AND pv."netWeightGrams" = 500 THEN 55.00
      WHEN lower(p.name) IN ('singular', 'sublime') AND pv."netWeightGrams" = 500 THEN 67.00
      WHEN pl.code = 'RAROS' AND pv."netWeightGrams" = 250 THEN 44.00
      ELSE NULL
    END::numeric(14,2) AS price
  FROM "ProductVariant" pv
  JOIN "Product" p ON p.id = pv."productId"
  JOIN "ProductLine" pl ON pl.id = p."productLineId"
  WHERE pv.active = true
    AND p.active = true
    AND pl.active = true
), relevant_companies AS (
  SELECT DISTINCT "companyId"
  FROM target
  WHERE price IS NOT NULL
)
INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency, "createdAt", "updatedAt"
)
SELECT
  'dist-' || substr(md5(rc."companyId"), 1, 24),
  rc."companyId",
  'DISTRIBUIDOR',
  'Distribuidor',
  'DISTRIBUIDOR'::"SalesChannelType",
  true,
  'Brasil',
  'BRL',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM relevant_companies rc
WHERE NOT EXISTS (
  SELECT 1
  FROM "SalesChannel" sc
  WHERE sc."companyId" = rc."companyId"
    AND sc.type = 'DISTRIBUIDOR'::"SalesChannelType"
    AND sc.active = true
);

WITH target AS (
  SELECT
    pv.id AS "productVariantId",
    pl."companyId",
    CASE
      WHEN lower(p.name) IN ('essencial', 'intenso') AND pv."netWeightGrams" = 500 THEN 44.00
      WHEN lower(p.name) IN ('caramelo', 'doce de leite', 'tangerina') AND pv."netWeightGrams" = 500 THEN 55.00
      WHEN lower(p.name) IN ('singular', 'sublime') AND pv."netWeightGrams" = 500 THEN 67.00
      WHEN pl.code = 'RAROS' AND pv."netWeightGrams" = 250 THEN 44.00
      ELSE NULL
    END::numeric(14,2) AS price
  FROM "ProductVariant" pv
  JOIN "Product" p ON p.id = pv."productId"
  JOIN "ProductLine" pl ON pl.id = p."productLineId"
  WHERE pv.active = true
    AND p.active = true
    AND pl.active = true
), distributor_rows AS (
  SELECT t.*, sc.id AS "salesChannelId"
  FROM target t
  JOIN "SalesChannel" sc
    ON sc."companyId" = t."companyId"
   AND sc.type = 'DISTRIBUIDOR'::"SalesChannelType"
   AND sc.active = true
  WHERE t.price IS NOT NULL
)
UPDATE "ProductPrice" pp
SET active = false,
    "validUntil" = COALESCE(pp."validUntil", CURRENT_TIMESTAMP),
    "updatedAt" = CURRENT_TIMESTAMP
FROM distributor_rows d
WHERE pp."productVariantId" = d."productVariantId"
  AND pp."salesChannelId" = d."salesChannelId"
  AND pp.currency = 'BRL'
  AND pp.active = true;

WITH target AS (
  SELECT
    pv.id AS "productVariantId",
    pl."companyId",
    CASE
      WHEN lower(p.name) IN ('essencial', 'intenso') AND pv."netWeightGrams" = 500 THEN 44.00
      WHEN lower(p.name) IN ('caramelo', 'doce de leite', 'tangerina') AND pv."netWeightGrams" = 500 THEN 55.00
      WHEN lower(p.name) IN ('singular', 'sublime') AND pv."netWeightGrams" = 500 THEN 67.00
      WHEN pl.code = 'RAROS' AND pv."netWeightGrams" = 250 THEN 44.00
      ELSE NULL
    END::numeric(14,2) AS price
  FROM "ProductVariant" pv
  JOIN "Product" p ON p.id = pv."productId"
  JOIN "ProductLine" pl ON pl.id = p."productLineId"
  WHERE pv.active = true
    AND p.active = true
    AND pl.active = true
), distributor_rows AS (
  SELECT t.*, sc.id AS "salesChannelId"
  FROM target t
  JOIN "SalesChannel" sc
    ON sc."companyId" = t."companyId"
   AND sc.type = 'DISTRIBUIDOR'::"SalesChannelType"
   AND sc.active = true
  WHERE t.price IS NOT NULL
)
INSERT INTO "ProductPrice" (
  id,
  "companyId",
  "productVariantId",
  "salesChannelId",
  currency,
  price,
  active,
  "validFrom",
  "validUntil",
  "maxRequestDiscountPercent",
  "maxApprovalDiscountPercent",
  "minimumPrice",
  "minimumMarginPercent",
  "minimumRoiPercent",
  "createdAt",
  "updatedAt"
)
SELECT
  'pp-dist-' || substr(md5(d."productVariantId" || ':' || d."salesChannelId" || ':20260912'), 1, 24),
  d."companyId",
  d."productVariantId",
  d."salesChannelId",
  'BRL',
  d.price,
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
FROM distributor_rows d;
