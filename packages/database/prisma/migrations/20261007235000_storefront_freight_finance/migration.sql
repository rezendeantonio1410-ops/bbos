-- Separa o frete recebido na loja própria da receita de produtos.
-- O valor fica reservado na carteira do Melhor Envio e gera uma obrigação
-- individual por pedido, baixada quando a etiqueta é efetivamente comprada.

INSERT INTO "FinancialInstitution"
  (id,"companyId",name,code,country,active,"createdAt","updatedAt")
SELECT
  'shipping-provider:melhor-envio:' || so."companyId",
  so."companyId",
  'Melhor Envio',
  'MELHOR_ENVIO',
  'BR',
  TRUE,
  NOW(),
  NOW()
FROM "StorefrontOrder" so
WHERE so."shippingProvider"='MELHOR_ENVIO'
GROUP BY so."companyId"
ON CONFLICT ("companyId",code) DO UPDATE
  SET name='Melhor Envio',active=TRUE,"updatedAt"=NOW();

INSERT INTO "FinancialAccount"
  (id,"companyId","financialInstitutionId",name,type,currency,country,"openingBalance",active,"createdAt","updatedAt")
SELECT
  'shipping-account:melhor-envio:' || so."companyId",
  so."companyId",
  fi.id,
  'Fretes recebidos · Melhor Envio',
  'DIGITAL_ACCOUNT',
  'BRL',
  'BR',
  0,
  TRUE,
  NOW(),
  NOW()
FROM "StorefrontOrder" so
JOIN "FinancialInstitution" fi
  ON fi."companyId"=so."companyId" AND fi.code='MELHOR_ENVIO'
WHERE so."shippingProvider"='MELHOR_ENVIO'
GROUP BY so."companyId",fi.id
ON CONFLICT (id) DO UPDATE
  SET "financialInstitutionId"=EXCLUDED."financialInstitutionId",
      name=EXCLUDED.name,active=TRUE,"updatedAt"=NOW();

INSERT INTO "Supplier"
  (id,"companyId",name,"tradeName",country,active,"createdAt","updatedAt")
SELECT
  'shipping-provider:melhor-envio:' || so."companyId",
  so."companyId",
  'Melhor Envio',
  'Melhor Envio',
  'Brasil',
  TRUE,
  NOW(),
  NOW()
FROM "StorefrontOrder" so
WHERE so."shippingProvider"='MELHOR_ENVIO'
GROUP BY so."companyId"
ON CONFLICT (id) DO UPDATE
  SET name='Melhor Envio',"tradeName"='Melhor Envio',active=TRUE,"updatedAt"=NOW();

INSERT INTO "AccountsPayable"
  (id,"companyId","supplierId",description,"issueDate","dueDate",amount,"openAmount",status,category,notes,"createdAt","updatedAt")
SELECT
  'shipping-payable:storefront:' || so.id,
  so."companyId",
  'shipping-provider:melhor-envio:' || so."companyId",
  'Frete Melhor Envio · pedido ' || so.code,
  COALESCE(so."paidAt",so."createdAt"),
  COALESCE(so."paidAt",so."createdAt"),
  COALESCE(q."providerPriceCents",so."shippingCents")::numeric / 100,
  COALESCE(q."providerPriceCents",so."shippingCents")::numeric / 100,
  'OPEN',
  'Frete / logística · Melhor Envio',
  'Reserva automática do frete. Recebido do cliente: R$ ' ||
    to_char(so."shippingCents"::numeric / 100,'FM999999990.00') ||
    '. Custo do provedor: R$ ' ||
    to_char(COALESCE(q."providerPriceCents",so."shippingCents")::numeric / 100,'FM999999990.00') ||
    '. Resultado logístico: R$ ' ||
    to_char((so."shippingCents"-COALESCE(q."providerPriceCents",so."shippingCents"))::numeric / 100,'FM999999990.00') || '.',
  NOW(),
  NOW()
FROM "StorefrontOrder" so
LEFT JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
WHERE so."shippingProvider"='MELHOR_ENVIO'
  AND so.status IN ('PAID','PREPARING','INVOICED','SHIPPED','DELIVERED')
  AND COALESCE(q."providerPriceCents",so."shippingCents") > 0
ON CONFLICT (id) DO NOTHING;

INSERT INTO "FinancialTransaction"
  (id,"companyId","financialAccountId",type,amount,category,description,"occurredAt","createdAt")
SELECT
  'shipping-allocation:storefront:' || so.id,
  so."companyId",
  'shipping-account:melhor-envio:' || so."companyId",
  'TRANSFER_IN',
  so."shippingCents"::numeric / 100,
  'Frete recebido · Melhor Envio',
  'Valor de frete reservado · pedido ' || so.code,
  COALESCE(so."paidAt",so."createdAt"),
  NOW()
FROM "StorefrontOrder" so
WHERE so."shippingProvider"='MELHOR_ENVIO'
  AND so.status IN ('PAID','PREPARING','INVOICED','SHIPPED','DELIVERED')
  AND so."shippingCents" > 0
ON CONFLICT (id) DO NOTHING;

INSERT INTO "Payment"
  (id,"companyId","accountsPayableId","financialAccountId",amount,"paidAt",method,notes,"idempotencyKey","createdAt")
SELECT
  'shipping-payment:melhor-envio:' || sh.id,
  sh."companyId",
  'shipping-payable:storefront:' || sh."storefrontOrderId",
  'shipping-account:melhor-envio:' || sh."companyId",
  sh."providerPriceCents"::numeric / 100,
  sh."updatedAt",
  'MELHOR_ENVIO_WALLET',
  'Etiqueta comprada no Melhor Envio · remessa ' || COALESCE(sh."externalId",sh.id) || '.',
  'shipping-payment:melhor-envio:' || sh.id,
  NOW()
FROM "Shipment" sh
WHERE sh.provider='MELHOR_ENVIO'
  AND sh."storefrontOrderId" IS NOT NULL
  AND sh.status IN ('PURCHASED','LABEL_READY','POSTED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED')
  AND EXISTS (
    SELECT 1 FROM "AccountsPayable" ap
    WHERE ap.id='shipping-payable:storefront:' || sh."storefrontOrderId"
  )
ON CONFLICT ("idempotencyKey") DO NOTHING;

INSERT INTO "FinancialTransaction"
  (id,"companyId","financialAccountId","paymentId",type,amount,category,description,"occurredAt","createdAt")
SELECT
  'shipping-settlement:melhor-envio:' || sh.id,
  sh."companyId",
  'shipping-account:melhor-envio:' || sh."companyId",
  p.id,
  'PAYMENT',
  sh."providerPriceCents"::numeric / 100,
  'Frete / logística · Melhor Envio',
  'Pagamento do frete · pedido ' || so.code,
  p."paidAt",
  NOW()
FROM "Shipment" sh
JOIN "StorefrontOrder" so ON so.id=sh."storefrontOrderId"
JOIN "Payment" p ON p."idempotencyKey"='shipping-payment:melhor-envio:' || sh.id
WHERE sh.provider='MELHOR_ENVIO'
  AND sh.status IN ('PURCHASED','LABEL_READY','POSTED','IN_TRANSIT','OUT_FOR_DELIVERY','DELIVERED')
ON CONFLICT (id) DO NOTHING;

UPDATE "AccountsPayable" ap
   SET status='PAID',"openAmount"=0,"paymentDate"=p."paidAt","updatedAt"=NOW()
  FROM "Payment" p
 WHERE p."accountsPayableId"=ap.id
   AND p."idempotencyKey" LIKE 'shipping-payment:melhor-envio:%';
