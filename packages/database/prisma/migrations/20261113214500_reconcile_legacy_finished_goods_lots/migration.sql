-- Alguns saldos antigos de produto acabado foram registrados antes da
-- rastreabilidade por lote. Antes de uma saída, transforma somente essa
-- diferença comprovada em lote LEGACY para manter a auditoria completa.
CREATE OR REPLACE FUNCTION bbos_reconcile_finished_goods_lot_coverage()
RETURNS trigger AS $$
DECLARE
  aggregate_units INTEGER;
  tracked_units INTEGER;
  legacy_units INTEGER;
  legacy_id TEXT;
  legacy_code TEXT;
  original_created_at TIMESTAMP(3);
BEGIN
  IF NEW.type::text <> 'SALE_OUT' THEN
    RETURN NEW;
  END IF;

  -- A aplicação já baixou o saldo agregado na mesma transação. A soma com a
  -- saída recupera o saldo imediatamente anterior à movimentação.
  SELECT
      finished_product."quantityOnHand" + NEW."packageQuantity",
      finished_product."createdAt"
    INTO aggregate_units, original_created_at
    FROM "FinishedProduct" finished_product
   WHERE finished_product.id = NEW."finishedProductId"
   FOR UPDATE;

  SELECT COALESCE(SUM(lot."quantityOnHand"), 0)::INTEGER
    INTO tracked_units
    FROM "FinishedGoodsLot" lot
   WHERE lot."finishedProductId" = NEW."finishedProductId";

  legacy_units := GREATEST(COALESCE(aggregate_units, 0) - tracked_units, 0);
  IF legacy_units <= 0 THEN
    RETURN NEW;
  END IF;

  legacy_id := 'fglot-reconciled-' || md5(NEW."finishedProductId");
  legacy_code := 'LEGACY-' || upper(substr(md5(
    NEW."companyId" || ':' || NEW."finishedProductId"
  ), 1, 12));

  INSERT INTO "FinishedGoodsLot" (
    id,
    "companyId",
    "finishedProductId",
    "productVariantId",
    "warehouseId",
    code,
    "manufacturedAt",
    "initialUnits",
    "quantityOnHand",
    status
  ) VALUES (
    legacy_id,
    NEW."companyId",
    NEW."finishedProductId",
    NEW."productVariantId",
    NEW."warehouseId",
    legacy_code,
    COALESCE(original_created_at, CURRENT_TIMESTAMP),
    legacy_units,
    legacy_units,
    'LEGACY'
  )
  ON CONFLICT (id) DO UPDATE SET
    "initialUnits" = "FinishedGoodsLot"."initialUnits" + EXCLUDED."initialUnits",
    "quantityOnHand" = "FinishedGoodsLot"."quantityOnHand" + EXCLUDED."quantityOnHand",
    status = 'LEGACY',
    "updatedAt" = CURRENT_TIMESTAMP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS "FinishedGoodsMovement_reconcile_legacy_lots_trg"
  ON "FinishedGoodsMovement";
CREATE TRIGGER "FinishedGoodsMovement_reconcile_legacy_lots_trg"
BEFORE INSERT ON "FinishedGoodsMovement"
FOR EACH ROW EXECUTE FUNCTION bbos_reconcile_finished_goods_lot_coverage();
