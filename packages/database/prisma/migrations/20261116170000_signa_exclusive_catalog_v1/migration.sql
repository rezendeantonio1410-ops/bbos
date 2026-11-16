-- Exclusive distributor catalog for Signa.
-- Customer-facing names stay isolated from Bispo's master products and SKUs.
-- Only rows in this table can be ordered by a distributor when a catalog exists.

CREATE TABLE "CustomerCatalogProduct" (
  id TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productVariantId" TEXT NOT NULL,
  "displayLineName" TEXT NOT NULL,
  "displayProductName" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CustomerCatalogProduct_pkey" PRIMARY KEY (id),
  CONSTRAINT "CustomerCatalogProduct_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerCatalogProduct_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerCatalogProduct_productVariantId_fkey"
    FOREIGN KEY ("productVariantId") REFERENCES "ProductVariant"(id) ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "CustomerCatalogProduct_customer_variant_key"
  ON "CustomerCatalogProduct"("customerId", "productVariantId");
CREATE INDEX "CustomerCatalogProduct_company_customer_active_idx"
  ON "CustomerCatalogProduct"("companyId", "customerId", active, "sortOrder");

-- Frutado is the Bispo coffee-base behind the Signa-facing Frutado line.
WITH signa_company AS (
  SELECT DISTINCT partner."companyId"
    FROM "StorefrontPartner" partner
   WHERE lower(partner.email) = 'comercial@nivov.com.br'
     AND partner.active = TRUE
), epic_line AS (
  SELECT line.id AS "productLineId"
    FROM "ProductLine" line
    JOIN signa_company company ON company."companyId" = line."companyId"
   WHERE line.code = 'EPICOS'
)
INSERT INTO "Product" (
  id,"productLineId",code,name,slug,description,active,"commercialKind","createdAt","updatedAt"
)
SELECT
  'prod-signa-frutado-' || substr(md5(line."productLineId"),1,12),
  line."productLineId",
  'FRUTADO',
  'Frutado',
  'frutado',
  'Café-base Frutado da Bispo Coffees.',
  TRUE,
  'STANDARD',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM epic_line line
ON CONFLICT ("productLineId",code)
DO UPDATE SET active=TRUE,"updatedAt"=CURRENT_TIMESTAMP;

-- Add only the presentations that the approved Signa table makes available.
WITH variant_specs("lineCode","productCode",sku,grams) AS (
  VALUES
    ('CLASSICOS'::"ProductLineCode",'CARAMELO','CLA-CAR-1000',1000),
    ('EPICOS'::"ProductLineCode",'WHITE_LABEL_FRUTADO','EPI-WLF-500',500),
    ('EPICOS'::"ProductLineCode",'WHITE_LABEL_FRUTADO','EPI-WLF-1000',1000)
), target_products AS (
  SELECT product.id AS "productId",specs.sku,specs.grams
    FROM variant_specs specs
    JOIN "ProductLine" line ON line.code=specs."lineCode"
    JOIN "StorefrontPartner" partner
      ON partner."companyId"=line."companyId"
     AND lower(partner.email)='comercial@nivov.com.br'
     AND partner.active=TRUE
    JOIN "Product" product
      ON product."productLineId"=line.id
     AND product.code=specs."productCode"
)
INSERT INTO "ProductVariant" (
  id,"productId",sku,"netWeightGrams","grossWeightGrams",
  "packageWidthCm","packageHeightCm","packageDepthCm",
  ncm,"originCode","productionType","fiscalValidated","salesUnit",active,
  "createdAt","updatedAt"
)
SELECT
  'variant-signa-' || substr(md5(target."productId" || ':' || target.sku),1,18),
  target."productId",
  target.sku,
  target.grams,
  target.grams,
  18,24,8,
  '09012100',0,'P',TRUE,'UN',TRUE,
  CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM target_products target
ON CONFLICT ("productId","netWeightGrams")
DO UPDATE SET active=TRUE,"updatedAt"=CURRENT_TIMESTAMP;

-- Preserve Bispo's production identity for every customer-facing Signa name.
WITH mappings("whiteLabelLine","whiteLabelCode","baseLine","baseCode") AS (
  VALUES
    ('GOURMET'::"ProductLineCode",'WHITE_LABEL_ESSENCIAL','GOURMET'::"ProductLineCode",'ESSENCIAL'),
    ('GOURMET'::"ProductLineCode",'CAFE_GOURMET_WHITE_LABEL','GOURMET'::"ProductLineCode",'ESSENCIAL'),
    ('CLASSICOS'::"ProductLineCode",'WHITE_LABEL_CLASSICO','CLASSICOS'::"ProductLineCode",'CARAMELO'),
    ('EPICOS'::"ProductLineCode",'WHITE_LABEL_FRUTADO','EPICOS'::"ProductLineCode",'FRUTADO'),
    ('RAROS'::"ProductLineCode",'WHITE_LABEL_RARO','RAROS'::"ProductLineCode",'RAROS')
)
UPDATE "Product" white_label
   SET "commercialKind"='WHITE_LABEL',
       "baseCoffeeProductId"=base.id,
       "updatedAt"=CURRENT_TIMESTAMP
  FROM mappings mapping,
       "ProductLine" white_line,
       "Product" base,
       "ProductLine" base_line,
       "StorefrontPartner" partner
 WHERE white_label."productLineId"=white_line.id
   AND white_line.code=mapping."whiteLabelLine"
   AND white_label.code=mapping."whiteLabelCode"
   AND base."productLineId"=base_line.id
   AND base_line.code=mapping."baseLine"
   AND base.code=mapping."baseCode"
   AND base_line."companyId"=white_line."companyId"
   AND partner."companyId"=white_line."companyId"
   AND lower(partner.email)='comercial@nivov.com.br'
   AND partner.active=TRUE;

-- "x" combinations are intentionally absent. Reserva is the Signa name for
-- Bispo Raro and is available only in 250 g.
WITH catalog_specs("displayLineName","displayProductName",sku,price,"sortOrder") AS (
  VALUES
    ('Clássicos','Clássicos','GOU-WLE-250',19.50::numeric(14,2),11),
    ('Clássicos','Clássicos','GOU ESS 500',37.00::numeric(14,2),12),
    ('Clássicos','Clássicos','GOU ESS 1 KG',72.00::numeric(14,2),13),
    ('Caramelo','Caramelo','CLA-WLC-250',22.00::numeric(14,2),21),
    ('Caramelo','Caramelo','CLA-CAR-500',42.00::numeric(14,2),22),
    ('Caramelo','Caramelo','CLA-CAR-1000',82.00::numeric(14,2),23),
    ('Frutado','Frutado','EPI-WLF-250',27.50::numeric(14,2),31),
    ('Frutado','Frutado','EPI-WLF-500',53.00::numeric(14,2),32),
    ('Frutado','Frutado','EPI-WLF-1000',104.00::numeric(14,2),33),
    ('Reserva','Reserva','RAR-WLR-250',38.00::numeric(14,2),41)
), signa_customer AS (
  SELECT partner."companyId",link."customerId"
    FROM "StorefrontPartner" partner
    JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=partner.id
   WHERE lower(partner.email)='comercial@nivov.com.br'
     AND partner.active=TRUE
     AND partner."portalAccessLevel"='DISTRIBUTOR'
), resolved AS (
  SELECT customer."companyId",customer."customerId",variant.id AS "productVariantId",
         specs."displayLineName",specs."displayProductName",specs.price,specs."sortOrder"
    FROM catalog_specs specs
    JOIN "ProductVariant" variant ON variant.sku=specs.sku AND variant.active=TRUE
    JOIN "Product" product ON product.id=variant."productId" AND product.active=TRUE
    JOIN "ProductLine" line ON line.id=product."productLineId" AND line.active=TRUE
    JOIN signa_customer customer ON customer."companyId"=line."companyId"
)
INSERT INTO "CustomerProductPrice" (
  id,"companyId","customerId","productVariantId",currency,price,active,
  "validFrom","validUntil",notes,"createdByName","createdAt","updatedAt"
)
SELECT
  'cpp-signa-' || substr(md5(rows."customerId" || ':' || rows."productVariantId"),1,22),
  rows."companyId",rows."customerId",rows."productVariantId",'BRL',rows.price,TRUE,
  CURRENT_TIMESTAMP,NULL,'Lista exclusiva Signa · preços de 10/09/2026',
  'Migração BBOS · catálogo Signa',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM resolved rows
ON CONFLICT ("customerId","productVariantId",currency)
DO UPDATE SET price=EXCLUDED.price,active=TRUE,"validUntil"=NULL,
              notes=EXCLUDED.notes,"createdByName"=EXCLUDED."createdByName",
              "updatedAt"=CURRENT_TIMESTAMP;

WITH catalog_specs("displayLineName","displayProductName",sku,"sortOrder") AS (
  VALUES
    ('Clássicos','Clássicos','GOU-WLE-250',11),
    ('Clássicos','Clássicos','GOU ESS 500',12),
    ('Clássicos','Clássicos','GOU ESS 1 KG',13),
    ('Caramelo','Caramelo','CLA-WLC-250',21),
    ('Caramelo','Caramelo','CLA-CAR-500',22),
    ('Caramelo','Caramelo','CLA-CAR-1000',23),
    ('Frutado','Frutado','EPI-WLF-250',31),
    ('Frutado','Frutado','EPI-WLF-500',32),
    ('Frutado','Frutado','EPI-WLF-1000',33),
    ('Reserva','Reserva','RAR-WLR-250',41)
), signa_customer AS (
  SELECT partner."companyId",link."customerId"
    FROM "StorefrontPartner" partner
    JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=partner.id
   WHERE lower(partner.email)='comercial@nivov.com.br'
     AND partner.active=TRUE
     AND partner."portalAccessLevel"='DISTRIBUTOR'
), resolved AS (
  SELECT customer."companyId",customer."customerId",variant.id AS "productVariantId",
         specs."displayLineName",specs."displayProductName",specs."sortOrder"
    FROM catalog_specs specs
    JOIN "ProductVariant" variant ON variant.sku=specs.sku AND variant.active=TRUE
    JOIN "Product" product ON product.id=variant."productId" AND product.active=TRUE
    JOIN "ProductLine" line ON line.id=product."productLineId" AND line.active=TRUE
    JOIN signa_customer customer ON customer."companyId"=line."companyId"
)
INSERT INTO "CustomerCatalogProduct" (
  id,"companyId","customerId","productVariantId","displayLineName",
  "displayProductName","sortOrder",active,"createdAt","updatedAt"
)
SELECT
  'catalog-signa-' || substr(md5(rows."customerId" || ':' || rows."productVariantId"),1,18),
  rows."companyId",rows."customerId",rows."productVariantId",
  rows."displayLineName",rows."displayProductName",rows."sortOrder",TRUE,
  CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM resolved rows
ON CONFLICT ("customerId","productVariantId")
DO UPDATE SET "displayLineName"=EXCLUDED."displayLineName",
              "displayProductName"=EXCLUDED."displayProductName",
              "sortOrder"=EXCLUDED."sortOrder",active=TRUE,
              "updatedAt"=CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "StorefrontPartner"
     WHERE lower(email)='comercial@nivov.com.br' AND active=TRUE
  ) AND (
    SELECT count(*)
      FROM "CustomerCatalogProduct" catalog
      JOIN "StorefrontPartnerCustomer" link ON link."customerId"=catalog."customerId"
      JOIN "StorefrontPartner" partner ON partner.id=link."partnerId"
     WHERE lower(partner.email)='comercial@nivov.com.br'
       AND catalog.active=TRUE
  ) <> 10 THEN
    RAISE EXCEPTION 'Catálogo Signa incompleto: eram esperadas 10 apresentações ativas.';
  END IF;
END $$;
