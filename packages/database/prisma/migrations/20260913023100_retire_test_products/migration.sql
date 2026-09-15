UPDATE "Product"
SET active = false, "updatedAt" = NOW()
WHERE lower(name) IN ('áureo','aureo','melpo');

UPDATE "ProductVariant" pv
SET active = false, "updatedAt" = NOW()
FROM "Product" p
WHERE pv."productId" = p.id AND p.active = false;
