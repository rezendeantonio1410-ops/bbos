-- BBOS Product Catalog Master V2

UPDATE "Product" p
SET active = false, "updatedAt" = NOW()
WHERE p.name NOT IN ('Essencial','Intenso','Caramelo','Doce de Leite','Tangerina','Singular','Sublime','Raros');

UPDATE "ProductVariant" pv
SET active = false, "updatedAt" = NOW()
FROM "Product" p
WHERE pv."productId" = p.id AND p.active = false;

INSERT INTO "Product" (id,"productLineId",code,name,slug,description,active,"createdAt","updatedAt")
SELECT 'prod-' || md5(pl.id || ':' || x.code), pl.id, x.code, x.name, x.slug, '', true, NOW(), NOW()
FROM "ProductLine" pl
JOIN (VALUES
  ('GOURMET','ESSENCIAL','Essencial','essencial'),
  ('GOURMET','INTENSO','Intenso','intenso'),
  ('CLASSICOS','CARAMELO','Caramelo','caramelo'),
  ('CLASSICOS','DOCE_LEITE','Doce de Leite','doce-de-leite'),
  ('CLASSICOS','TANGERINA','Tangerina','tangerina'),
  ('EPICOS','SINGULAR','Singular','singular'),
  ('EPICOS','SUBLIME','Sublime','sublime'),
  ('RAROS','RAROS','Raros','raros')
) AS x(line_code,code,name,slug) ON pl.code::text = x.line_code
WHERE NOT EXISTS (
  SELECT 1 FROM "Product" p
  WHERE p."productLineId" = pl.id AND lower(p.name) = lower(x.name)
);

UPDATE "Product" p
SET active = true, code = x.code, slug = x.slug, "updatedAt" = NOW()
FROM "ProductLine" pl,
(VALUES
  ('GOURMET','ESSENCIAL','Essencial','essencial'),
  ('GOURMET','INTENSO','Intenso','intenso'),
  ('CLASSICOS','CARAMELO','Caramelo','caramelo'),
  ('CLASSICOS','DOCE_LEITE','Doce de Leite','doce-de-leite'),
  ('CLASSICOS','TANGERINA','Tangerina','tangerina'),
  ('EPICOS','SINGULAR','Singular','singular'),
  ('EPICOS','SUBLIME','Sublime','sublime'),
  ('RAROS','RAROS','Raros','raros')
) AS x(line_code,code,name,slug)
WHERE p."productLineId" = pl.id
  AND pl.code::text = x.line_code
  AND lower(p.name) = lower(x.name);

UPDATE "ProductVariant" pv
SET active = false, "updatedAt" = NOW()
FROM "Product" p
WHERE pv."productId" = p.id AND p.active = true
  AND ((p.name = 'Raros' AND pv."netWeightGrams" <> 250)
    OR (p.name <> 'Raros' AND pv."netWeightGrams" <> 500));

INSERT INTO "ProductVariant" (id,"productId",sku,"netWeightGrams","salesUnit",active,"coffeeCost","industrialCost","packagingCost","labelCost","boxCost","laborCost","energyCost","otherCost","totalCost","unitCost","marginPercent","createdAt","updatedAt")
SELECT 'variant-' || md5(p.id || ':' || x.weight::text), p.id, x.sku, x.weight, 'UN', true, 0,0,0,0,0,0,0,0,0,0,0,NOW(),NOW()
FROM "Product" p
JOIN (VALUES
  ('Essencial','GOU-ESS-500',500),
  ('Intenso','GOU-INT-500',500),
  ('Caramelo','CLA-CAR-500',500),
  ('Doce de Leite','CLA-DOC-500',500),
  ('Tangerina','CLA-TAN-500',500),
  ('Singular','EPI-SIN-500',500),
  ('Sublime','EPI-SUB-500',500),
  ('Raros','RAR-RAR-250',250)
) AS x(name,sku,weight) ON p.name = x.name
WHERE p.active = true
  AND NOT EXISTS (
    SELECT 1 FROM "ProductVariant" pv
    WHERE pv."productId" = p.id AND pv."netWeightGrams" = x.weight
  );

UPDATE "ProductVariant" pv
SET active = true, "salesUnit" = 'UN', "updatedAt" = NOW()
FROM "Product" p
WHERE pv."productId" = p.id AND p.active = true
  AND ((p.name = 'Raros' AND pv."netWeightGrams" = 250)
    OR (p.name <> 'Raros' AND pv."netWeightGrams" = 500));
