-- Complete the official Bispo distributor table for products created after the
-- original distributor-price migration. Existing active prices are preserved.
WITH target AS (
  SELECT
    pv.id AS "productVariantId",
    pl."companyId",
    CASE
      WHEN lower(p.name) IN ('essencial', 'intenso') AND pv."netWeightGrams" = 500 THEN 47.00
      WHEN lower(p.name) IN ('caramelo', 'doce de leite', 'tangerina') AND pv."netWeightGrams" = 500 THEN 55.00
      WHEN lower(p.name) IN ('singular', 'sublime') AND pv."netWeightGrams" = 500 THEN 67.00
      WHEN pl.code = 'RAROS' AND pv."netWeightGrams" = 250 THEN 44.00
      ELSE NULL
    END::numeric(14,2) AS price
  FROM "ProductVariant" pv
  JOIN "Product" p ON p.id = pv."productId"
  JOIN "ProductLine" pl ON pl.id = p."productLineId"
  WHERE pv.active = true AND p.active = true AND pl.active = true
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
  id, "companyId", "productVariantId", "salesChannelId", currency, price,
  active, "validFrom", "validUntil", "maxRequestDiscountPercent",
  "maxApprovalDiscountPercent", "minimumPrice", "minimumMarginPercent",
  "minimumRoiPercent", "createdAt", "updatedAt"
)
SELECT
  'pp-dist2-' || substr(md5(d."productVariantId" || ':' || d."salesChannelId"), 1, 23),
  d."companyId", d."productVariantId", d."salesChannelId", 'BRL', d.price,
  true, CURRENT_TIMESTAMP, NULL, 0, 0, NULL, NULL, NULL,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM distributor_rows d
WHERE NOT EXISTS (
  SELECT 1 FROM "ProductPrice" pp
  WHERE pp."productVariantId" = d."productVariantId"
    AND pp."salesChannelId" = d."salesChannelId"
    AND pp.currency = 'BRL'
    AND pp.active = true
    AND (pp."validUntil" IS NULL OR pp."validUntil" >= CURRENT_TIMESTAMP)
);
