CREATE OR REPLACE FUNCTION bbos_guard_sale_out_invoiced() RETURNS trigger AS $$
DECLARE order_status TEXT;
BEGIN
  IF NEW.type::text='SALE_OUT' AND NEW."salesOrderId" IS NOT NULL THEN
    SELECT status::text INTO order_status FROM "SalesOrder" WHERE id=NEW."salesOrderId";
    IF order_status<>'INVOICED' THEN
      RAISE EXCEPTION 'Pedido deve estar faturado antes da expedição';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "FinishedGoodsMovement_invoiced_guard_trg" ON "FinishedGoodsMovement";
CREATE TRIGGER "FinishedGoodsMovement_invoiced_guard_trg" BEFORE INSERT ON "FinishedGoodsMovement" FOR EACH ROW EXECUTE FUNCTION bbos_guard_sale_out_invoiced();
