DO $$
DECLARE
  target_product_id TEXT;
  source_product_id TEXT;
  one_kg_variant_id TEXT;
BEGIN
  SELECT p.id
    INTO target_product_id
  FROM "Product" p
  JOIN "ProductVariant" v ON v."productId" = p.id
  WHERE v.sku = 'GOU ESS 500'
    AND v."netWeightGrams" = 500
  LIMIT 1;

  SELECT v.id, v."productId"
    INTO one_kg_variant_id, source_product_id
  FROM "ProductVariant" v
  WHERE v.sku = 'GOU ESS 1 KG'
    AND v."netWeightGrams" = 1000
  LIMIT 1;

  IF target_product_id IS NOT NULL
     AND one_kg_variant_id IS NOT NULL
     AND source_product_id IS DISTINCT FROM target_product_id THEN
    UPDATE "ProductVariant"
    SET "productId" = target_product_id,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = one_kg_variant_id;

    UPDATE "Product"
    SET active = FALSE,
        "updatedAt" = CURRENT_TIMESTAMP
    WHERE id = source_product_id
      AND NOT EXISTS (
        SELECT 1
        FROM "ProductVariant" remaining
        WHERE remaining."productId" = source_product_id
      );
  END IF;
END $$;
