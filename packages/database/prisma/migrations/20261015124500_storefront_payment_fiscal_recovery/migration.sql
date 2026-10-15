-- Loja Bispo payments are collected online before the operational order is invoiced.
-- Keep the sales order, receivable and payment ledger aligned with that provider truth.

UPDATE "StorefrontOrder" storefront_order
   SET "salesOrderId" = sales_order.id,
       "updatedAt" = NOW()
  FROM "SalesOrder" sales_order
 WHERE storefront_order."companyId" = sales_order."companyId"
   AND (sales_order."externalOrderId" = storefront_order.id OR sales_order.code = storefront_order.code)
   AND storefront_order."salesOrderId" IS DISTINCT FROM sales_order.id;

UPDATE "SalesOrder" sales_order
   SET "paymentType" = 'CASH',
       "paymentTermsSnapshot" = COALESCE(
         sales_order."paymentTermsSnapshot",
         CASE WHEN storefront_order."requestedPaymentMethod" = 'CARD'
           THEN 'Cartão · Loja Bispo'
           ELSE 'Pix · Loja Bispo'
         END
       ),
       "updatedAt" = NOW()
  FROM "StorefrontOrder" storefront_order
 WHERE storefront_order."companyId" = sales_order."companyId"
   AND (storefront_order.id = sales_order."externalOrderId" OR storefront_order.code = sales_order.code)
   AND sales_order."paymentType" = 'LEGACY';

INSERT INTO "FinancialInstitution" (
  id,"companyId",name,code,country,active,"createdAt","updatedAt"
)
SELECT DISTINCT
  'payment-provider:mercado-pago:' || storefront_order."companyId",
  storefront_order."companyId",'Mercado Pago','MERCADO_PAGO','BR',true,NOW(),NOW()
  FROM "StorefrontOrder" storefront_order
  JOIN "StorefrontPaymentAttempt" attempt
    ON attempt."storefrontOrderId" = storefront_order.id
   AND attempt.provider = 'MERCADO_PAGO'
   AND attempt.status = 'PAID'
ON CONFLICT (id) DO UPDATE SET
  name='Mercado Pago',code='MERCADO_PAGO',active=true,"updatedAt"=NOW();

INSERT INTO "FinancialAccount" (
  id,"companyId","financialInstitutionId",name,type,currency,country,
  "openingBalance",active,"createdAt","updatedAt"
)
SELECT DISTINCT
  'payment-account:mercado-pago:' || storefront_order."companyId",
  storefront_order."companyId",
  'payment-provider:mercado-pago:' || storefront_order."companyId",
  'Recebimentos · Mercado Pago','DIGITAL_ACCOUNT','BRL','BR',0,true,NOW(),NOW()
  FROM "StorefrontOrder" storefront_order
  JOIN "StorefrontPaymentAttempt" attempt
    ON attempt."storefrontOrderId" = storefront_order.id
   AND attempt.provider = 'MERCADO_PAGO'
   AND attempt.status = 'PAID'
ON CONFLICT (id) DO UPDATE SET
  "financialInstitutionId"=EXCLUDED."financialInstitutionId",
  name='Recebimentos · Mercado Pago',active=true,"updatedAt"=NOW();

WITH latest_paid AS (
  SELECT DISTINCT ON (attempt."storefrontOrderId")
         attempt.*,storefront_order."salesOrderId",storefront_order.code,
         storefront_order."paidAt" AS "orderPaidAt"
    FROM "StorefrontPaymentAttempt" attempt
    JOIN "StorefrontOrder" storefront_order ON storefront_order.id=attempt."storefrontOrderId"
   WHERE attempt.provider='MERCADO_PAGO' AND attempt.status='PAID'
   ORDER BY attempt."storefrontOrderId",attempt."paidAt" DESC NULLS LAST,attempt."createdAt" DESC
)
INSERT INTO "AccountsReceivable" (
  id,"companyId","customerId","salesOrderId","issueDate","dueDate",
  amount,"openAmount",status,"paymentDate",notes,"createdAt","updatedAt"
)
SELECT 'ar-' || md5(sales_order.id),sales_order."companyId",sales_order."customerId",sales_order.id,
       COALESCE(latest_paid."paidAt",latest_paid."orderPaidAt",NOW()),
       COALESCE(latest_paid."paidAt",latest_paid."orderPaidAt",NOW()),
       sales_order."totalAmount",sales_order."totalAmount",'OPEN',NULL,
       'Pagamento online da Loja Bispo · pedido ' || sales_order.code || '.',NOW(),NOW()
  FROM latest_paid
  JOIN "SalesOrder" sales_order ON sales_order.id=latest_paid."salesOrderId"
ON CONFLICT ("salesOrderId") DO NOTHING;

WITH latest_paid AS (
  SELECT DISTINCT ON (attempt."storefrontOrderId")
         attempt.*,storefront_order."salesOrderId",storefront_order.code,
         storefront_order."paidAt" AS "orderPaidAt"
    FROM "StorefrontPaymentAttempt" attempt
    JOIN "StorefrontOrder" storefront_order ON storefront_order.id=attempt."storefrontOrderId"
   WHERE attempt.provider='MERCADO_PAGO' AND attempt.status='PAID'
   ORDER BY attempt."storefrontOrderId",attempt."paidAt" DESC NULLS LAST,attempt."createdAt" DESC
)
INSERT INTO "Payment" (
  id,"companyId","accountsReceivableId","financialAccountId",amount,"paidAt",method,
  notes,source,reference,"idempotencyKey","createdAt"
)
SELECT 'storefront-payment-' || md5(latest_paid.id),sales_order."companyId",receivable.id,
       'payment-account:mercado-pago:' || sales_order."companyId",
       latest_paid."amountCents"::numeric / 100,
       COALESCE(latest_paid."paidAt",latest_paid."orderPaidAt",NOW()),latest_paid.method,
       'Pagamento confirmado pelo Mercado Pago para o pedido ' || sales_order.code || '.',
       'STOREFRONT_MERCADO_PAGO',latest_paid."externalId",
       'storefront-payment:' || latest_paid.id,NOW()
  FROM latest_paid
  JOIN "SalesOrder" sales_order ON sales_order.id=latest_paid."salesOrderId"
  JOIN "AccountsReceivable" receivable ON receivable."salesOrderId"=sales_order.id
 WHERE latest_paid."amountCents"::numeric / 100 = sales_order."totalAmount"
   AND NOT EXISTS (SELECT 1 FROM "Payment" existing WHERE existing."accountsReceivableId"=receivable.id)
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "FinancialTransaction" (
  id,"companyId","financialAccountId","paymentId",type,amount,category,description,
  "occurredAt","createdAt"
)
SELECT 'storefront-receipt-' || md5(payment.id),payment."companyId",payment."financialAccountId",
       payment.id,'RECEIPT',payment.amount,'Venda online · Loja Bispo',
       'Recebimento da Loja Bispo via Mercado Pago',payment."paidAt",NOW()
  FROM "Payment" payment
 WHERE payment.source='STOREFRONT_MERCADO_PAGO'
   AND NOT EXISTS (SELECT 1 FROM "FinancialTransaction" movement WHERE movement."paymentId"=payment.id)
ON CONFLICT ("paymentId") DO NOTHING;

UPDATE "AccountsReceivable" receivable
   SET "openAmount"=0,status='PAID',"paymentDate"=payment."paidAt","updatedAt"=NOW()
  FROM "Payment" payment
 WHERE payment."accountsReceivableId"=receivable.id
   AND payment.source='STOREFRONT_MERCADO_PAGO'
   AND (receivable.status<>'PAID' OR receivable."openAmount"<>0);

-- An authorized NF-e is the source of truth. Recover the operational state so
-- the existing shipment guards can safely perform the stock exit afterwards.
UPDATE "SalesOrder" sales_order
   SET status='INVOICED',
       "invoicedAt"=COALESCE(
         sales_order."invoicedAt",
         (SELECT fiscal."updatedAt" FROM "FiscalDocument" fiscal
           WHERE fiscal."salesOrderId"=sales_order.id
             AND fiscal.direction='OUTBOUND' AND fiscal.status='AUTHORIZED'
           ORDER BY fiscal."createdAt" DESC LIMIT 1),
         NOW()
       ),
       "updatedAt"=NOW()
 WHERE sales_order.status='READY_TO_SHIP'
   AND EXISTS (
     SELECT 1 FROM "FiscalDocument" fiscal
      WHERE fiscal."salesOrderId"=sales_order.id
        AND fiscal.direction='OUTBOUND' AND fiscal.status='AUTHORIZED'
   );
