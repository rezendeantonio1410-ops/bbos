-- Preserve legacy confirmed purchases as approved commitments without changing their commercial values.
INSERT INTO "AccountsPayable" (
  "id","companyId","supplierId","description","issueDate","dueDate","amount","openAmount","status","category","notes","createdAt","updatedAt"
)
SELECT
  'ap_' || md5(p."id" || ':1'), p."companyId", p."supplierId",
  p."purchaseNumber" || ' · parcela 1', p."purchasedAt", COALESCE(p."expectedAt", p."purchasedAt"),
  p."totalValue", p."totalValue", 'OPEN', 'COMPRA_CAFE_VERDE',
  'Compromisso migrado da compra já confirmada ' || p."purchaseNumber", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "GreenCoffeePurchase" p
WHERE p."approvalStatus" = 'APPROVED' AND p."totalValue" > 0
  AND NOT EXISTS (SELECT 1 FROM "GreenCoffeePurchaseInstallment" i WHERE i."purchaseId" = p."id")
ON CONFLICT ("id") DO NOTHING;

INSERT INTO "GreenCoffeePurchaseInstallment" (
  "id","purchaseId","installmentNumber","percentage","amount","dueDate","status","accountsPayableId","createdAt","updatedAt"
)
SELECT
  'pi_' || md5(p."id" || ':1'), p."id", 1, 100, p."totalValue", COALESCE(p."expectedAt", p."purchasedAt"),
  'COMMITTED', 'ap_' || md5(p."id" || ':1'), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "GreenCoffeePurchase" p
WHERE p."approvalStatus" = 'APPROVED' AND p."totalValue" > 0
  AND NOT EXISTS (SELECT 1 FROM "GreenCoffeePurchaseInstallment" i WHERE i."purchaseId" = p."id")
ON CONFLICT ("purchaseId","installmentNumber") DO NOTHING;
