-- Business approval: the active Gourmet White Label presentation consumes
-- the roasted bulk stock of Gourmet / Essencial. The company and line joins
-- keep the mapping tenant-safe and leave Bling SKUs unchanged.
UPDATE "Product" AS white_label
SET
  "baseCoffeeProductId" = base_coffee.id,
  "updatedAt" = CURRENT_TIMESTAMP
FROM "ProductLine" AS white_label_line,
     "Product" AS base_coffee,
     "ProductLine" AS base_line
WHERE white_label."productLineId" = white_label_line.id
  AND white_label."commercialKind" = 'WHITE_LABEL'
  AND white_label.code = 'CAFE_GOURMET_WHITE_LABEL'
  AND white_label_line.code = 'GOURMET'
  AND base_coffee."productLineId" = base_line.id
  AND base_coffee."commercialKind" = 'STANDARD'
  AND base_coffee.code = 'ESSENCIAL'
  AND base_line.code = 'GOURMET'
  AND base_line."companyId" = white_label_line."companyId"
  AND white_label."baseCoffeeProductId" IS NULL;
