-- Recover the shipping selection from Loja Bispo in its operational order.
-- A single shipment can represent both sides of the same integrated sale.
ALTER TABLE "Shipment"
  DROP CONSTRAINT IF EXISTS "Shipment_order_scope_check";

ALTER TABLE "Shipment"
  ADD CONSTRAINT "Shipment_order_scope_check"
  CHECK (num_nonnulls("storefrontOrderId", "salesOrderId") >= 1);

UPDATE "SalesOrder" sales_order
   SET freight = storefront_order."shippingCents"::numeric / 100,
       "freightResponsibility" = CASE
         WHEN storefront_order."shippingQuoteId" IS NOT NULL THEN 'CUSTOMER'
         ELSE sales_order."freightResponsibility"
       END,
       "shippingQuoteId" = storefront_order."shippingQuoteId",
       "shippingProvider" = storefront_order."shippingProvider",
       "shippingServiceId" = storefront_order."shippingServiceId",
       "shippingServiceName" = storefront_order."shippingServiceName",
       "carrierName" = storefront_order."carrierName",
       "estimatedDeliveryDays" = storefront_order."estimatedDeliveryDays",
       "externalOrderId" = COALESCE(sales_order."externalOrderId", storefront_order.id),
       "updatedAt" = NOW()
  FROM "StorefrontOrder" storefront_order
 WHERE storefront_order."companyId" = sales_order."companyId"
   AND storefront_order.code = COALESCE(sales_order."orderNumber", sales_order.code)
   AND storefront_order."shippingQuoteId" IS NOT NULL;

UPDATE "Shipment" shipment
   SET "salesOrderId" = sales_order.id,
       "updatedAt" = NOW()
  FROM "StorefrontOrder" storefront_order
  JOIN "SalesOrder" sales_order
    ON sales_order."companyId" = storefront_order."companyId"
   AND COALESCE(sales_order."orderNumber", sales_order.code) = storefront_order.code
 WHERE shipment."storefrontOrderId" = storefront_order.id
   AND shipment."salesOrderId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "Shipment" other
      WHERE other."salesOrderId" = sales_order.id
        AND other.id <> shipment.id
   );

UPDATE "Shipment" shipment
   SET "storefrontOrderId" = storefront_order.id,
       "updatedAt" = NOW()
  FROM "SalesOrder" sales_order
  JOIN "StorefrontOrder" storefront_order
    ON storefront_order."companyId" = sales_order."companyId"
   AND storefront_order.code = COALESCE(sales_order."orderNumber", sales_order.code)
 WHERE shipment."salesOrderId" = sales_order.id
   AND shipment."storefrontOrderId" IS NULL
   AND NOT EXISTS (
     SELECT 1 FROM "Shipment" other
      WHERE other."storefrontOrderId" = storefront_order.id
        AND other.id <> shipment.id
   );
