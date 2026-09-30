-- Remove the explicitly reviewed green-coffee supplier test records before
-- starting real purchasing. Real suppliers (including Bela Epoca Coffees and
-- Carlos Alexandre Siqueira) are intentionally preserved.

DO $$
DECLARE
  target_ids text[];
BEGIN
  SELECT COALESCE(array_agg(id), ARRAY[]::text[])
    INTO target_ids
    FROM "Supplier"
   WHERE name = 'Produtor Teste BBOS'
      OR regexp_replace(COALESCE("taxId", ''), '\D', '', 'g') = '78320397002725';

  IF EXISTS (
    SELECT 1 FROM "GreenCoffeePurchase" WHERE "supplierId" = ANY(target_ids)
  ) OR EXISTS (
    SELECT 1 FROM "GreenCoffeeReceipt" WHERE "supplierId" = ANY(target_ids)
  ) OR EXISTS (
    SELECT 1 FROM "CoffeeLot" WHERE "supplierId" = ANY(target_ids)
  ) THEN
    RAISE EXCEPTION 'Supplier cleanup refused: CAPAL or Produtor Teste has operational records';
  END IF;
END $$;

DELETE FROM "Supplier"
 WHERE name = 'Produtor Teste BBOS'
    OR regexp_replace(COALESCE("taxId", ''), '\D', '', 'g') = '78320397002725';
