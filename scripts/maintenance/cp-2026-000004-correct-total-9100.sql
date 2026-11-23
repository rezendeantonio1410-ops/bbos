-- Manual, one-time accounting correction requested by the BBOS administrator.
-- NOT a Prisma migration; NEVER run as part of a deploy.
-- Requires a verified backup and a production database administrator.
-- Correction: purchase CP-2026-000004, 360 kg, total BRL 9,000 -> 9,100.
-- The unit price is derived to 4 decimals (9,100 / 360 kg = 25.2778).
-- Do not run after NF/XML imports, receipts, payables or external acceptance.
-- Execute with psql -v ON_ERROR_STOP=1 -1 -f <this file>.
BEGIN;
DO $correction$
DECLARE
  p "GreenCoffeePurchase"%ROWTYPE;
  installment_count integer;
  installment_id text;
  receipt_count integer;
  payable_count integer;
  confirmation_count integer;
BEGIN
  SELECT * INTO p
  FROM "GreenCoffeePurchase"
  WHERE "purchaseNumber"='CP-2026-000004'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase CP-2026-000004 not found';
  END IF;
  IF p."approvalStatus"::text <> 'APPROVED'
    OR p."status"::text <> 'CONFIRMED'
    OR p."externalAcceptanceStatus"::text <> 'NOT_SENT'
    OR p."operationalStatus"::text <> 'AWAITING_DELIVERY'
    OR p."contractedWeightKg" <> 360
    OR p."totalValue" <> 9000.00
    OR p."pricePerKg" <> 25.0000
    OR p."brokerCommissionAmount" IS NOT NULL
  THEN
    RAISE EXCEPTION 'Purchase changed or unexpected: refusing correction';
  END IF;

  SELECT COUNT(*), MIN(i.id)
    INTO installment_count, installment_id
    FROM "GreenCoffeePurchaseInstallment" i
    WHERE i."purchaseId"=p.id
      AND i."amount"=9000.00
      AND i."percentage"=100
      AND i."status"::text='COMMITTED'
      AND i."accountsPayableId" IS NULL
      AND i."paidAt" IS NULL;

  SELECT COUNT(*) INTO receipt_count FROM "GreenCoffeeReceipt" WHERE "purchaseId"=p.id;
  SELECT COUNT(*) INTO payable_count FROM "AccountsPayable" WHERE "purchaseId"=p.id;
  SELECT COUNT(*) INTO confirmation_count FROM "PurchaseConfirmationDocumentVersion" WHERE "purchaseId"=p.id;

  IF installment_count <> 1
    OR (SELECT COUNT(*) FROM "GreenCoffeePurchaseInstallment" WHERE "purchaseId"=p.id) <> 1
    OR receipt_count <> 0 OR payable_count <> 0 OR confirmation_count <> 0
  THEN
    RAISE EXCEPTION 'Linked financial/receipt/document records changed: refusing correction';
  END IF;

  UPDATE "GreenCoffeePurchase"
  SET "totalValue"=9100.00,
      "pricePerKg"=ROUND(9100.00::numeric / 360, 4),
      "updatedAt"=NOW()
  WHERE id=p.id;

  UPDATE "GreenCoffeePurchaseInstallment"
  SET amount=9100.00, "updatedAt"=NOW()
  WHERE id=installment_id;

  INSERT INTO "GreenCoffeeAuditEvent"
    (id,"companyId","purchaseId",action,"actorId","actorName",metadata,"occurredAt")
  VALUES
    (gen_random_uuid()::text,p."companyId",p.id,
     'PURCHASE_APPROVED_VALUE_CORRECTED',
     'administrative-manual-correction',
     'Correção administrativa solicitada',
     jsonb_build_object(
       'purchaseNumber',p."purchaseNumber",
       'previousTotal',9000.00,
       'correctedTotal',9100.00,
       'previousPricePerKg',25.0000,
       'correctedPricePerKg',ROUND(9100.00::numeric/360,4),
       'contractedWeightKg',360,
       'reason','Correção de valor lançado antes da entrada do XML',
       'source','Solicitação expressa do administrador BBOS'
     ),
     NOW());
END
$correction$;
COMMIT;
