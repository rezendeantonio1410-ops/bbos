DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "Supplier" supplier
     WHERE supplier.name = 'Produtor Teste BBOS'
       AND (
         EXISTS (SELECT 1 FROM "GreenCoffeePurchase" purchase WHERE purchase."supplierId" = supplier.id)
         OR EXISTS (SELECT 1 FROM "GreenCoffeeReceipt" receipt WHERE receipt."supplierId" = supplier.id)
         OR EXISTS (SELECT 1 FROM "CoffeeLot" lot WHERE lot."supplierId" = supplier.id)
       )
  ) THEN
    RAISE EXCEPTION 'Produtor Teste BBOS possui registros operacionais e não pode ser removido automaticamente';
  END IF;
END $$;

DELETE FROM "Supplier"
 WHERE name = 'Produtor Teste BBOS';
