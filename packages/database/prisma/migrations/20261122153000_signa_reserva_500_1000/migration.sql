-- Add requested Reserva presentations only for the Signa distributor.
-- No inventory is created and no unrelated customer's price is changed.
WITH signa AS (
 SELECT DISTINCT partner."companyId", link."customerId"
 FROM "StorefrontPartner" partner
 JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=partner.id
 WHERE lower(partner.email)='comercial@nivov.com.br'
   AND partner.active=true AND partner."portalAccessLevel"='DISTRIBUTOR'
), target AS (
 SELECT product.id AS "productId",signa."companyId"
 FROM signa
 JOIN "ProductLine" line ON line."companyId"=signa."companyId" AND line.code='RAROS'
 JOIN "Product" product ON product."productLineId"=line.id AND product.code='WHITE_LABEL_RARO'
)
INSERT INTO "ProductVariant" (
 id,"productId",sku,"netWeightGrams","grossWeightGrams",
 "packageWidthCm","packageHeightCm","packageDepthCm",
 ncm,"originCode","productionType","fiscalValidated","salesUnit",active,"createdAt","updatedAt"
)
SELECT 'variant-signa-reserva-'||spec.grams,target."productId",
 'RAR-WLR-'||spec.grams,spec.grams,spec.grams,
 18,24,8,'09012100',0,'P',true,'UN',true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM target CROSS JOIN (VALUES (500),(1000)) spec(grams)
ON CONFLICT ("productId","netWeightGrams")
DO UPDATE SET active=true,"updatedAt"=CURRENT_TIMESTAMP;

WITH signa AS (
 SELECT DISTINCT partner."companyId",link."customerId"
 FROM "StorefrontPartner" partner
 JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=partner.id
 WHERE lower(partner.email)='comercial@nivov.com.br'
   AND partner.active=true AND partner."portalAccessLevel"='DISTRIBUTOR'
), specs(sku,price,sort_order) AS (
 VALUES ('RAR-WLR-500',76.80::numeric(14,2),42),
        ('RAR-WLR-1000',148.00::numeric(14,2),43)
), resolved AS (
 SELECT signa."companyId",signa."customerId",v.id AS "productVariantId",specs.price,specs.sort_order
 FROM signa CROSS JOIN specs
 JOIN "ProductVariant" v ON v.sku=specs.sku AND v.active=true
 JOIN "Product" p ON p.id=v."productId" AND p.active=true
 JOIN "ProductLine" line ON line.id=p."productLineId" AND line."companyId"=signa."companyId"
)
INSERT INTO "CustomerProductPrice" (
 id,"companyId","customerId","productVariantId",currency,price,active,
 "validFrom","validUntil",notes,"createdByName","createdAt","updatedAt"
)
SELECT 'cpp-signa-reserva-'||substr(md5(r."customerId"||':'||r."productVariantId"),1,20),
 r."companyId",r."customerId",r."productVariantId",'BRL',r.price,true,
 CURRENT_TIMESTAMP,NULL,'Reserva Signa 500 g / 1 kg','Migração BBOS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM resolved r
ON CONFLICT ("customerId","productVariantId",currency)
DO UPDATE SET price=EXCLUDED.price,active=true,"validUntil"=NULL,
 notes=EXCLUDED.notes,"updatedAt"=CURRENT_TIMESTAMP;

WITH signa AS (
 SELECT DISTINCT partner."companyId",link."customerId"
 FROM "StorefrontPartner" partner
 JOIN "StorefrontPartnerCustomer" link ON link."partnerId"=partner.id
 WHERE lower(partner.email)='comercial@nivov.com.br'
   AND partner.active=true AND partner."portalAccessLevel"='DISTRIBUTOR'
), specs(sku,sort_order) AS (
 VALUES ('RAR-WLR-500',42),('RAR-WLR-1000',43)
), resolved AS (
 SELECT signa."companyId",signa."customerId",v.id AS "productVariantId",specs.sort_order
 FROM signa CROSS JOIN specs
 JOIN "ProductVariant" v ON v.sku=specs.sku AND v.active=true
 JOIN "Product" p ON p.id=v."productId" AND p.active=true
 JOIN "ProductLine" line ON line.id=p."productLineId" AND line."companyId"=signa."companyId"
)
INSERT INTO "CustomerCatalogProduct" (
 id,"companyId","customerId","productVariantId","displayLineName",
 "displayProductName","sortOrder",active,"createdAt","updatedAt"
)
SELECT 'catalog-signa-reserva-'||substr(md5(r."customerId"||':'||r."productVariantId"),1,18),
 r."companyId",r."customerId",r."productVariantId",'Reserva','Reserva',r.sort_order,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
FROM resolved r
ON CONFLICT ("customerId","productVariantId")
DO UPDATE SET "displayLineName"='Reserva',"displayProductName"='Reserva',
 "sortOrder"=EXCLUDED."sortOrder",active=true,"updatedAt"=CURRENT_TIMESTAMP;

DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM "StorefrontPartner" WHERE lower(email)='comercial@nivov.com.br' AND active=true)
 AND EXISTS(SELECT 1 FROM "StorefrontPartnerCustomer" link JOIN "StorefrontPartner" partner ON partner.id=link."partnerId" WHERE lower(partner.email)='comercial@nivov.com.br')
 AND (SELECT count(DISTINCT v."netWeightGrams")
 FROM "CustomerCatalogProduct" cp
 JOIN "ProductVariant" v ON v.id=cp."productVariantId"
 JOIN "StorefrontPartnerCustomer" link ON link."customerId"=cp."customerId"
 JOIN "StorefrontPartner" partner ON partner.id=link."partnerId"
 WHERE lower(partner.email)='comercial@nivov.com.br'
 AND cp.active=true AND v.sku IN ('RAR-WLR-250','RAR-WLR-500','RAR-WLR-1000')) <> 3
 THEN RAISE EXCEPTION 'Reserva Signa: esperadas 3 apresentações ativas'; END IF;
END $$;
