-- Shipment status integrity v1
-- A sales order can only become SHIPPED after the physical stock movement exists.
-- When Bling is connected, the outbound NF-e must already be authorized.

CREATE OR REPLACE FUNCTION bbos_guard_sales_order_shipped()
RETURNS trigger AS $$
DECLARE
  has_sale_out BOOLEAN;
  has_active_reservation BOOLEAN;
  bling_connected BOOLEAN;
  fiscal_authorized BOOLEAN;
BEGIN
  IF NEW.status::text = 'SHIPPED' AND OLD.status::text IS DISTINCT FROM 'SHIPPED' THEN
    IF OLD.status::text <> 'INVOICED' THEN
      RAISE EXCEPTION 'Pedido deve estar faturado antes de ser expedido';
    END IF;

    SELECT EXISTS(
      SELECT 1
        FROM "FinishedGoodsMovement"
       WHERE "salesOrderId" = NEW.id
         AND type::text = 'SALE_OUT'
    ) INTO has_sale_out;

    IF NOT has_sale_out THEN
      RAISE EXCEPTION 'Pedido não possui baixa física de estoque para expedição';
    END IF;

    SELECT EXISTS(
      SELECT 1
        FROM "InventoryReservation"
       WHERE "salesOrderId" = NEW.id
         AND status::text = 'ACTIVE'
    ) INTO has_active_reservation;

    IF has_active_reservation THEN
      RAISE EXCEPTION 'Pedido ainda possui reservas ativas não consumidas';
    END IF;

    SELECT EXISTS(
      SELECT 1
        FROM "ExternalIntegration"
       WHERE "companyId" = NEW."companyId"
         AND provider = 'BLING'
         AND status = 'CONNECTED'
    ) INTO bling_connected;

    IF bling_connected THEN
      SELECT EXISTS(
        SELECT 1
          FROM "FiscalDocument"
         WHERE "salesOrderId" = NEW.id
           AND direction = 'OUTBOUND'
           AND status = 'AUTHORIZED'
      ) INTO fiscal_authorized;

      IF NOT fiscal_authorized THEN
        RAISE EXCEPTION 'NF-e deve estar autorizada antes de concluir a expedição';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "SalesOrder_shipped_integrity_trg" ON "SalesOrder";
CREATE TRIGGER "SalesOrder_shipped_integrity_trg"
BEFORE UPDATE OF status ON "SalesOrder"
FOR EACH ROW
EXECUTE FUNCTION bbos_guard_sales_order_shipped();
