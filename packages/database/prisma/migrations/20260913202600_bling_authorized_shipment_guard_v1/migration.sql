CREATE OR REPLACE FUNCTION bbos_guard_bling_authorized_shipment() RETURNS trigger AS $$
DECLARE connected BOOLEAN; authorized BOOLEAN;
BEGIN
  IF NEW.type::text='SALE_OUT' AND NEW."salesOrderId" IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM "ExternalIntegration" WHERE "companyId"=NEW."companyId" AND provider='BLING' AND status='CONNECTED') INTO connected;
    IF connected THEN
      SELECT EXISTS(SELECT 1 FROM "FiscalDocument" WHERE "salesOrderId"=NEW."salesOrderId" AND direction='OUTBOUND' AND status='AUTHORIZED') INTO authorized;
      IF NOT authorized THEN
        RAISE EXCEPTION 'NF-e ainda não autorizada para expedição';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS "FinishedGoodsMovement_bling_authorized_guard_trg" ON "FinishedGoodsMovement";
CREATE TRIGGER "FinishedGoodsMovement_bling_authorized_guard_trg" BEFORE INSERT ON "FinishedGoodsMovement" FOR EACH ROW EXECUTE FUNCTION bbos_guard_bling_authorized_shipment();
