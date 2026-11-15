-- Essencial and Intenso retail prices were confirmed at R$ 52.00.
-- Keep every other price table and product untouched.

UPDATE "ProductPrice" pp
   SET price = 52.00,
       "updatedAt" = CURRENT_TIMESTAMP
  FROM "ProductVariant" pv,
       "SalesChannel" sc
 WHERE pp."productVariantId" = pv.id
   AND pp."salesChannelId" = sc.id
   AND pp."companyId" = sc."companyId"
   AND pp.active = true
   AND pp.currency = 'BRL'
   AND sc.active = true
   AND sc.code = 'VAREJO'
   AND pv.active = true
   AND pv.sku IN ('GOU-ESS-500', 'GOU-INT-500');
