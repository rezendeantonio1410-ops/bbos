-- Normalize the misspelled White Label product across master data and
-- operational snapshots that are still displayed by the BBOS.
UPDATE "Product"
   SET name = regexp_replace(name, '(whate|wathe)[[:space:]-]+label', 'White Label', 'gi'),
       description = regexp_replace(description, '(whate|wathe)[[:space:]-]+label', 'White Label', 'gi'),
       code = regexp_replace(code, '(WHATE|WATHE)_LABEL', 'WHITE_LABEL', 'gi'),
       slug = regexp_replace(slug, '(whate|wathe)-label', 'white-label', 'gi'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE lower(name) ~ '(whate|wathe)[[:space:]-]+label'
    OR lower(description) ~ '(whate|wathe)[[:space:]-]+label'
    OR lower(code) ~ '(whate|wathe)_label'
    OR lower(slug) ~ '(whate|wathe)-label';

UPDATE "FinishedProduct"
   SET name = regexp_replace(name, '(whate|wathe)[[:space:]-]+label', 'White Label', 'gi'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE lower(name) ~ '(whate|wathe)[[:space:]-]+label';

UPDATE "ProductionOrder"
   SET "productName" = regexp_replace("productName", '(whate|wathe)[[:space:]-]+label', 'White Label', 'gi'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE lower("productName") ~ '(whate|wathe)[[:space:]-]+label';

UPDATE "SalesOrderItem"
   SET "productName" = regexp_replace("productName", '(whate|wathe)[[:space:]-]+label', 'White Label', 'gi'),
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE lower("productName") ~ '(whate|wathe)[[:space:]-]+label';

-- The 1 kg presentation was grouped into the master product by an earlier
-- migration. Keep its inactive, empty legacy record readable and correctly
-- spelled without reactivating it or changing any SKU/history.
UPDATE "Product"
   SET name = 'Café Gourmet White Label · 1 kg',
       code = 'WHITE_LABEL_GOURMET_1_KG',
       slug = 'white-label-gourmet-1-kg',
       "updatedAt" = CURRENT_TIMESTAMP
 WHERE active = FALSE
   AND lower(name) = 'white label gpurmet 1 kg'
   AND NOT EXISTS (
     SELECT 1 FROM "ProductVariant" variant WHERE variant."productId" = "Product".id
   );

