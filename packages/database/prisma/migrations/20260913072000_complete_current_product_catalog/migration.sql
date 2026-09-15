WITH defs(line_code,code,weight,sku) AS (
  VALUES
    ('GOURMET','ESSENCIAL',500,'GOU-ESS-500'),
    ('GOURMET','INTENSO',500,'GOU-INT-500'),
    ('CLASSICOS','CARAMELO',500,'CLA-CAR-500'),
    ('CLASSICOS','DOCE_LEITE',500,'CLA-DOC-500'),
    ('CLASSICOS','TANGERINA',500,'CLA-TAN-500'),
    ('EPICOS','SINGULAR',500,'EPI-SIN-500'),
    ('EPICOS','SUBLIME',500,'EPI-SUB-500')
)
INSERT INTO "ProductVariant" (
  id,"productId",sku,"netWeightGrams","salesUnit",active,
  "coffeeCost","industrialCost","packagingCost","labelCost","boxCost",
  "laborCost","energyCost","otherCost","totalCost","unitCost","marginPercent",
  "createdAt","updatedAt"
)
SELECT
  'variant-' || md5(p.id || ':' || d.weight::text),
  p.id,d.sku,d.weight,'UN',true,
  0,0,0,0,0,0,0,0,0,0,0,NOW(),NOW()
FROM defs d
JOIN "ProductLine" pl ON pl.code::text=d.line_code AND pl.active=true
JOIN "Product" p ON p."productLineId"=pl.id AND p.code=d.code AND p.active=true
ON CONFLICT ("productId","netWeightGrams")
DO UPDATE SET
  sku=EXCLUDED.sku,
  active=true,
  "salesUnit"='UN',
  "updatedAt"=NOW();

-- Raros is an official line, not a permanent generic product.
-- Individual rare microlots are created as their own products when they exist.
UPDATE "ProductVariant" pv
SET active=false, "updatedAt"=NOW()
FROM "Product" p
JOIN "ProductLine" pl ON pl.id=p."productLineId"
WHERE pv."productId"=p.id
  AND pl.code::text='RAROS'
  AND p.code='RAROS';

UPDATE "Product" p
SET active=false, "updatedAt"=NOW()
FROM "ProductLine" pl
WHERE p."productLineId"=pl.id
  AND pl.code::text='RAROS'
  AND p.code='RAROS';
