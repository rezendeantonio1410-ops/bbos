-- O Melhor Envio possui estados intermediários e de exceção que também são
-- preservados na linha do tempo do pedido. A restrição original aceitava
-- apenas os estados principais e rejeitava, por exemplo, uma devolução.

ALTER TABLE "StorefrontOrderEvent"
  DROP CONSTRAINT IF EXISTS "StorefrontOrderEvent_type_check";

ALTER TABLE "StorefrontOrderEvent"
  ADD CONSTRAINT "StorefrontOrderEvent_type_check" CHECK ("eventType" IN (
    'ORDER_RECEIVED','PAYMENT_CONFIRMED','PREPARING','INVOICE_AUTHORIZED',
    'SHIPMENT_CREATED','SHIPPED','OUT_FOR_DELIVERY','DELIVERED','EXCEPTION','CANCELLED',
    'RECEIVED','LABEL_GENERATED','LABEL_RELEASED','LABEL_CREATED','LABEL_PENDING',
    'UNDELIVERED','RETURNED','PAUSED','SUSPENDED','SHIPMENT_CANCELLED'
  ));
