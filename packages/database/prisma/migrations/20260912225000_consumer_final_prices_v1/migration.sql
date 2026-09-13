-- Ensure the Consumer final profile has its own channel and price table.
UPDATE "SalesChannel"
SET type = 'ECOMMERCE', "updatedAt" = NOW()
WHERE code = 'CONSUMIDOR_FINAL';

WITH target AS (
  SELECT pv.id AS "productVariantId", pl."companyId",
         CASE
           WHEN lower(p.name) IN ('essencial','intenso') AND pv."netWeightGrams" = 500 THEN 52.00
           WHEN lower(p.name) IN ('caramelo','doce de leite','tangerina') AND pv."netWeightGrams" = 500 THEN 68.00
           WHEN lower(p.name) IN ('singular','sublime') AND pv."netWeightGrams" = 500 THEN 84.00
           WHEN pl.code = 'RAROS' AND pv."netWeightGrams" = 250 THEN 54.00
           ELSE NULL
         END AS price
  FROM "ProductVariant" pv
  JOIN "Product" p ON p.id = pv."productId"
  JOIN "ProductLine" pl ON pl.id = p."productLineId"
  WHERE pv.active = true AND p.active = true AND pl.active = true
), channel AS (
  SELECT id, "companyId" FROM "SalesChannel" WHERE code = 'CONSUMIDOR_FINAL' AND active = true
)
INSERT INTO "ProductPrice"
(id,"companyId","productVariantId","salesChannelId",currency,price,active,"validFrom","validUntil","createdAt","updatedAt")
SELECT 'cf-' || md5(t."companyId" || ':' || t."productVariantId"),
       t."companyId", t."productVariantId", c.id, 'BRL', t.price, true,
       TIMESTAMP '2026-09-12 00:00:00', NULL, NOW(), NOW()
FROM target t
JOIN channel c ON c."companyId" = t."companyId"
WHERE t.price IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "ProductPrice" pp
    WHERE pp."productVariantId" = t."productVariantId"
      AND pp."salesChannelId" = c.id
      AND pp.currency = 'BRL'
      AND pp.active = true
      AND (pp."validUntil" IS NULL OR pp."validUntil" >= NOW())
  );