WITH defs(line_code,code,name,slug,weight,sku) AS (
  VALUES
    ('GOURMET','ESSENCIAL','Essencial','essencial',500,'GOU-ESS-500'),
    ('GOURMET','INTENSO','Intenso','intenso',500,'GOU-INT-500'),
    ('CLASSICOS','CARAMELO','Caramelo','caramelo',500,'CLA-CAR-500'),
    ('CLASSICOS','DOCE_LEITE','Doce de Leite','doce-de-leite',500,'CLA-DOC-500'),
    ('CLASSICOS','TANGERINA','Tangerina','tangerina',500,'CLA-TAN-500'),
    ('EPICOS','SINGULAR','Singular','singular',500,'EPI-SIN-500'),
    ('EPICOS','SUBLIME','Sublime','sublime',500,'EPI-SUB-500'),
    ('RAROS','RAROS','Raros','raros',250,'RAR-RAR-250')
), inserted_products AS (
  INSERT INTO "Product" (id,"productLineId",code,name,slug,description,active,"createdAt","updatedAt")
  SELECT 'prod-' || md5(pl.id || ':' || d.code), pl.id, d.code, d.name, d.slug, '', true, NOW(), NOW()
  FROM defs d
  JOIN "ProductLine" pl ON pl.code::text = d.line_code
  ON CONFLICT ("productLineId",code)
  DO UPDATE SET name=EXCLUDED.name, slug=EXCLUDED.slug, active=true, "updatedAt"=NOW()
  RETURNING id, code
)
INSERT INTO "ProductVariant" (id,"productId",sku,"netWeightGrams","salesUnit",active,"coffeeCost","industrialCost","packagingCost","labelCost","boxCost","laborCost","energyCost","otherCost","totalCost","unitCost","marginPercent","createdAt","updatedAt")
SELECT 'variant-' || md5(p.id || ':' || d.weight::text), p.id, d.sku, d.weight, 'UN', true, 0,0,0,0,0,0,0,0,0,0,0,NOW(),NOW()
FROM defs d
JOIN "Product" p ON p.code=d.code
JOIN "ProductLine" pl ON pl.id=p."productLineId" AND pl.code::text=d.line_code
ON CONFLICT ("productId","netWeightGrams")
DO UPDATE SET active=true, "salesUnit"='UN', "updatedAt"=NOW();
