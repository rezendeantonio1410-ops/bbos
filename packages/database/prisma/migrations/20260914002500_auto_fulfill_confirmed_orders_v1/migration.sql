CREATE OR REPLACE FUNCTION bbos_auto_fulfill_confirmed_orders()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  available_units INTEGER;
  candidate RECORD;
  reservation_id TEXT;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."quantityOnHand" <= OLD."quantityOnHand" THEN
    RETURN NEW;
  END IF;

  IF NEW."productVariantId" IS NULL THEN
    RETURN NEW;
  END IF;

  available_units := NEW."quantityOnHand" - NEW."reservedQuantity";
  IF available_units <= 0 THEN
    RETURN NEW;
  END IF;

  FOR candidate IN
    SELECT
      soi.id AS item_id,
      soi."salesOrderId" AS order_id,
      soi.quantity,
      so."orderNumber",
      so."expectedDeliveryDate",
      so."orderDate",
      so."createdAt"
    FROM "SalesOrderItem" soi
    JOIN "SalesOrder" so ON so.id = soi."salesOrderId"
    WHERE soi."companyId" = NEW."companyId"
      AND soi."productVariantId" = NEW."productVariantId"
      AND so.status::text = 'CONFIRMED'
      AND NOT EXISTS (
        SELECT 1
        FROM "InventoryReservation" ir
        WHERE ir."salesOrderItemId" = soi.id
      )
    ORDER BY
      so."expectedDeliveryDate" ASC NULLS LAST,
      so."orderDate" ASC NULLS LAST,
      so."createdAt" ASC,
      soi."createdAt" ASC
    FOR UPDATE OF soi, so
  LOOP
    EXIT WHEN available_units <= 0;

    IF candidate.quantity <= available_units THEN
      reservation_id := 'autores-' || substr(md5(candidate.item_id || clock_timestamp()::text), 1, 24);

      INSERT INTO "InventoryReservation" (
        id,
        "companyId",
        "salesOrderId",
        "salesOrderItemId",
        "productVariantId",
        "finishedProductId",
        "warehouseId",
        quantity,
        status,
        "idempotencyKey",
        "createdAt",
        "updatedAt"
      ) VALUES (
        reservation_id,
        NEW."companyId",
        candidate.order_id,
        candidate.item_id,
        NEW."productVariantId",
        NEW.id,
        NEW."warehouseId",
        candidate.quantity,
        'ACTIVE'::"InventoryReservationStatus",
        'AUTO_FULFILL:' || candidate.item_id,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )
      ON CONFLICT ("salesOrderItemId") DO NOTHING;

      IF FOUND THEN
        UPDATE "FinishedProduct"
        SET "reservedQuantity" = "reservedQuantity" + candidate.quantity,
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE id = NEW.id;

        available_units := available_units - candidate.quantity;

        UPDATE "SalesOrder" so
        SET status = 'RESERVED'::"SalesOrderStatus",
            "updatedAt" = CURRENT_TIMESTAMP
        WHERE so.id = candidate.order_id
          AND so.status::text = 'CONFIRMED'
          AND NOT EXISTS (
            SELECT 1
            FROM "SalesOrderItem" pending_item
            WHERE pending_item."salesOrderId" = so.id
              AND NOT EXISTS (
                SELECT 1
                FROM "InventoryReservation" active_reservation
                WHERE active_reservation."salesOrderItemId" = pending_item.id
                  AND active_reservation.status::text = 'ACTIVE'
              )
          );
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "FinishedProduct_auto_fulfill_confirmed_orders" ON "FinishedProduct";
CREATE TRIGGER "FinishedProduct_auto_fulfill_confirmed_orders"
AFTER INSERT OR UPDATE OF "quantityOnHand" ON "FinishedProduct"
FOR EACH ROW
WHEN (NEW."quantityOnHand" > 0)
EXECUTE FUNCTION bbos_auto_fulfill_confirmed_orders();
