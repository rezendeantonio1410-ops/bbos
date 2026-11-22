-- Reserva is the Signa-facing display label of the existing White Label Raro product.
-- Keep the canonical BBOS variant, SKU and 1000 g net weight for Bling; do not
-- alias a 1 kg fiscal item to the 250 g Raros or White Label Raro mapping.
-- Enqueue only the two existing fiscal-validated variants. The normal Bling
-- outbox worker performs the upsert and records the external product mapping.
WITH eligible AS (
  SELECT v.id AS "variantId", pl."companyId"
    FROM "ProductVariant" v
    JOIN "Product" p ON p.id=v."productId"
    JOIN "ProductLine" pl ON pl.id=p."productLineId"
   WHERE p.code='WHITE_LABEL_RARO'
     AND v.sku IN ('RAR-WLR-500','RAR-WLR-1000')
     AND v."netWeightGrams" IN (500,1000)
     AND v.active=true AND v."fiscalValidated"=true
     AND p.active=true
)
INSERT INTO "IntegrationOutbox"
 (id,"companyId",provider,"eventType","aggregateType","aggregateId",
  payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
SELECT 'bling-outbox-signa-reserva-'||e."variantId",
       e."companyId",'BLING','PRODUCT_UPSERT_REQUESTED','PRODUCT_VARIANT',
       e."variantId",jsonb_build_object('productVariantId',e."variantId"),
       'PENDING',0,'bling:product-upsert:'||e."variantId",NOW(),NOW()
FROM eligible e
ON CONFLICT ("idempotencyKey") DO UPDATE SET
 status=CASE WHEN "IntegrationOutbox".status='SENT' THEN 'SENT' ELSE 'PENDING' END,
 "nextAttemptAt"=NULL,
 "updatedAt"=NOW();
