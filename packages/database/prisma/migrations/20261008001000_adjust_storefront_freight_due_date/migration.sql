-- Obrigações criadas no dia do pagamento vencem no dia seguinte, evitando
-- classificá-las como atrasadas antes do fim da janela operacional de expedição.

UPDATE "AccountsPayable" ap
   SET "dueDate"=ap."issueDate" + INTERVAL '1 day',
       notes='Reserva automática do frete. Recebido do cliente: R$ ' ||
         replace(to_char(so."shippingCents"::numeric / 100,'FM999999990.00'),'.',',') ||
         '. Custo do provedor: R$ ' ||
         replace(to_char(COALESCE(q."providerPriceCents",so."shippingCents")::numeric / 100,'FM999999990.00'),'.',',') ||
         '. Resultado logístico: R$ ' ||
         replace(to_char((so."shippingCents"-COALESCE(q."providerPriceCents",so."shippingCents"))::numeric / 100,'FM999999990.00'),'.',',') || '.',
       "updatedAt"=NOW()
  FROM "StorefrontOrder" so
  LEFT JOIN "ShippingQuote" q ON q.id=so."shippingQuoteId"
 WHERE ap.id='shipping-payable:storefront:' || so.id
   AND ap.status IN ('OPEN','PARTIALLY_PAID');
