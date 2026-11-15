-- White Label 250 g catalog requested for Bispo Coffees.
-- The data migration is deliberately scoped to the production company and
-- does not create FinishedProduct rows or any artificial inventory balance.

WITH specs("lineCode", "productCode", name, slug, sku, price) AS (
  VALUES
    ('GOURMET'::"ProductLineCode", 'WHITE_LABEL_ESSENCIAL', 'White Label Essencial', 'white-label-essencial', 'GOU-WLE-250', 19.50::numeric(14,2)),
    ('CLASSICOS'::"ProductLineCode", 'WHITE_LABEL_CLASSICO', 'White Label Clássico', 'white-label-classico', 'CLA-WLC-250', 22.00::numeric(14,2)),
    ('EPICOS'::"ProductLineCode", 'WHITE_LABEL_FRUTADO', 'White Label Frutado', 'white-label-frutado', 'EPI-WLF-250', 27.50::numeric(14,2)),
    ('RAROS'::"ProductLineCode", 'WHITE_LABEL_RARO', 'White Label Raro', 'white-label-raro', 'RAR-WLR-250', 38.00::numeric(14,2))
), target_company AS (
  SELECT id
    FROM "Company"
   WHERE id = 'cmszzhc0z0000fu31ovnwja4m'
)
INSERT INTO "Product" (
  id, "productLineId", code, name, slug, description, active, "createdAt", "updatedAt"
)
SELECT
  'prod-wl-' || substr(md5(company.id || ':' || specs.slug), 1, 23),
  line.id,
  specs."productCode",
  specs.name,
  specs.slug,
  'Café White Label em pacote de 250 g.',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM specs
JOIN target_company company ON true
JOIN "ProductLine" line
  ON line."companyId" = company.id
 AND line.code = specs."lineCode"
ON CONFLICT DO NOTHING;

WITH specs("lineCode", "productCode", sku) AS (
  VALUES
    ('GOURMET'::"ProductLineCode", 'WHITE_LABEL_ESSENCIAL', 'GOU-WLE-250'),
    ('CLASSICOS'::"ProductLineCode", 'WHITE_LABEL_CLASSICO', 'CLA-WLC-250'),
    ('EPICOS'::"ProductLineCode", 'WHITE_LABEL_FRUTADO', 'EPI-WLF-250'),
    ('RAROS'::"ProductLineCode", 'WHITE_LABEL_RARO', 'RAR-WLR-250')
), target_products AS (
  SELECT product.id AS "productId", specs.sku
    FROM specs
    JOIN "ProductLine" line
      ON line."companyId" = 'cmszzhc0z0000fu31ovnwja4m'
     AND line.code = specs."lineCode"
    JOIN "Product" product
      ON product."productLineId" = line.id
     AND product.code = specs."productCode"
)
INSERT INTO "ProductVariant" (
  id, "productId", sku, "netWeightGrams", "salesUnit", active, "createdAt", "updatedAt"
)
SELECT
  'variant-' || substr(md5(target."productId" || ':' || target.sku), 1, 23),
  target."productId",
  target.sku,
  250,
  'UN',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM target_products target
ON CONFLICT DO NOTHING;

-- These SKUs belong exclusively to the White Label commercial table.
UPDATE "ProductPrice" price
   SET active = false,
       "validUntil" = COALESCE(price."validUntil", CURRENT_TIMESTAMP),
       "updatedAt" = CURRENT_TIMESTAMP
  FROM "ProductVariant" variant,
       "Product" product,
       "ProductLine" line,
       "SalesChannel" channel
 WHERE price."productVariantId" = variant.id
   AND product.id = variant."productId"
   AND line.id = product."productLineId"
   AND channel.id = price."salesChannelId"
   AND line."companyId" = 'cmszzhc0z0000fu31ovnwja4m'
   AND variant.sku IN ('GOU-WLE-250', 'CLA-WLC-250', 'EPI-WLF-250', 'RAR-WLR-250')
   AND price.active = true;

WITH prices(sku, price) AS (
  VALUES
    ('GOU-WLE-250', 19.50::numeric(14,2)),
    ('CLA-WLC-250', 22.00::numeric(14,2)),
    ('EPI-WLF-250', 27.50::numeric(14,2)),
    ('RAR-WLR-250', 38.00::numeric(14,2))
), white_label_rows AS (
  SELECT
    variant.id AS "productVariantId",
    line."companyId",
    channel.id AS "salesChannelId",
    prices.price
  FROM prices
  JOIN "ProductVariant" variant
    ON variant.sku = prices.sku
   AND variant.active = true
  JOIN "Product" product
    ON product.id = variant."productId"
   AND product.active = true
  JOIN "ProductLine" line
    ON line.id = product."productLineId"
   AND line."companyId" = 'cmszzhc0z0000fu31ovnwja4m'
   AND line.active = true
  JOIN "SalesChannel" channel
    ON channel."companyId" = line."companyId"
   AND channel.code = 'WHITE_LABEL'
   AND channel.active = true
)
INSERT INTO "ProductPrice" (
  id, "companyId", "productVariantId", "salesChannelId", currency, price,
  active, "validFrom", "validUntil", "maxRequestDiscountPercent",
  "maxApprovalDiscountPercent", "minimumPrice", "minimumMarginPercent",
  "minimumRoiPercent", "createdAt", "updatedAt"
)
SELECT
  'pp-wl-' || substr(md5(rows."companyId" || ':' || rows."productVariantId"), 1, 26),
  rows."companyId",
  rows."productVariantId",
  rows."salesChannelId",
  'BRL',
  rows.price,
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
FROM white_label_rows rows
ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price,
  active = true,
  "validFrom" = EXCLUDED."validFrom",
  "validUntil" = NULL,
  "updatedAt" = CURRENT_TIMESTAMP;
