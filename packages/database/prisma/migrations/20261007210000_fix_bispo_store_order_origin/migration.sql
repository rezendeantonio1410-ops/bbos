-- Storefront checkouts belong to Loja Bispo, never to the first generic
-- ECOMMERCE channel (which can be Mercado Livre, Shopee or Amazon).
UPDATE "SalesChannel"
   SET name = 'Loja Bispo',
       "platformCode" = 'BISPO_STORE',
       "connectionStatus" = 'CONNECTED',
       "fulfillmentMode" = COALESCE("fulfillmentMode", 'SELLER'),
       active = true,
       "updatedAt" = NOW()
 WHERE code = 'ECOMMERCE';

INSERT INTO "SalesChannel" (
  id, "companyId", code, name, type, active, country, currency,
  "platformCode", "connectionStatus", "fulfillmentMode", "createdAt", "updatedAt"
)
SELECT md5(c.id || ':bispo-store'), c.id, 'ECOMMERCE', 'Loja Bispo',
       'ECOMMERCE'::"SalesChannelType", true, 'BR', 'BRL',
       'BISPO_STORE', 'CONNECTED', 'SELLER', NOW(), NOW()
  FROM "Company" c
 WHERE NOT EXISTS (
   SELECT 1
     FROM "SalesChannel" sc
    WHERE sc."companyId" = c.id
      AND sc."platformCode" = 'BISPO_STORE'
 )
ON CONFLICT ("companyId", code) DO UPDATE SET
  name = 'Loja Bispo',
  "platformCode" = 'BISPO_STORE',
  "connectionStatus" = 'CONNECTED',
  "fulfillmentMode" = COALESCE("SalesChannel"."fulfillmentMode", 'SELLER'),
  active = true,
  "updatedAt" = NOW();

WITH bispo_channel AS (
  SELECT DISTINCT ON ("companyId") "companyId", id
    FROM "SalesChannel"
   WHERE "platformCode" = 'BISPO_STORE' AND active = true
   ORDER BY "companyId", (code = 'ECOMMERCE') DESC, "createdAt" ASC
)
UPDATE "SalesOrder" sales_order
   SET "salesChannelId" = bispo_channel.id,
       "updatedAt" = NOW()
  FROM "StorefrontOrder" storefront_order,
       bispo_channel
 WHERE storefront_order."companyId" = sales_order."companyId"
   AND storefront_order.code = sales_order.code
   AND bispo_channel."companyId" = sales_order."companyId"
   AND sales_order."salesChannelId" IS DISTINCT FROM bispo_channel.id;

-- The checkout already collected these fields. Backfill only empty customer
-- fields so the existing WEB orders can be invoiced without retyping data.
WITH latest_storefront_customer AS (
  SELECT DISTINCT ON (sales_order."customerId")
         sales_order."customerId",
         storefront_order.customer,
         storefront_order.delivery
    FROM "SalesOrder" sales_order
    JOIN "StorefrontOrder" storefront_order
      ON storefront_order."companyId" = sales_order."companyId"
     AND storefront_order.code = sales_order.code
   ORDER BY sales_order."customerId", storefront_order."createdAt" DESC
)
UPDATE "Customer" customer
   SET email = COALESCE(NULLIF(customer.email, ''), NULLIF(latest.customer->>'email', '')),
       phone = COALESCE(NULLIF(customer.phone, ''), NULLIF(regexp_replace(latest.customer->>'phone', '\D', '', 'g'), '')),
       "postalCode" = COALESCE(NULLIF(customer."postalCode", ''), NULLIF(regexp_replace(latest.delivery->>'postalCode', '\D', '', 'g'), '')),
       address = COALESCE(NULLIF(customer.address, ''), NULLIF(latest.delivery->>'street', '')),
       "addressNumber" = COALESCE(NULLIF(customer."addressNumber", ''), NULLIF(latest.delivery->>'number', '')),
       "addressComplement" = COALESCE(NULLIF(customer."addressComplement", ''), NULLIF(latest.delivery->>'complement', '')),
       district = COALESCE(NULLIF(customer.district, ''), NULLIF(latest.delivery->>'district', '')),
       city = COALESCE(NULLIF(customer.city, ''), NULLIF(latest.delivery->>'city', '')),
       state = COALESCE(NULLIF(customer.state, ''), NULLIF(upper(latest.delivery->>'state'), '')),
       "stateRegistrationType" = CASE
         WHEN length(regexp_replace(COALESCE(customer."taxId", ''), '\D', '', 'g')) = 11
           THEN 'NON_TAXPAYER'
         ELSE customer."stateRegistrationType"
       END,
       "updatedAt" = NOW()
  FROM latest_storefront_customer latest
 WHERE customer.id = latest."customerId";
