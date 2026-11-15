-- Reconcile the cached reserved quantity with the active reservation ledger.
-- A prior cleanup removed test reservations directly and left this aggregate stale.

WITH active_reservations AS (
  SELECT
    fp.id AS "finishedProductId",
    COALESCE(SUM(ir.quantity) FILTER (WHERE ir.status::text = 'ACTIVE'), 0)::INTEGER AS "activeQuantity"
  FROM "FinishedProduct" fp
  LEFT JOIN "InventoryReservation" ir
    ON ir."finishedProductId" = fp.id
  GROUP BY fp.id
)
UPDATE "FinishedProduct" fp
SET
  "reservedQuantity" = active_reservations."activeQuantity",
  "updatedAt" = CURRENT_TIMESTAMP
FROM active_reservations
WHERE fp.id = active_reservations."finishedProductId"
  AND fp."reservedQuantity" IS DISTINCT FROM active_reservations."activeQuantity";
