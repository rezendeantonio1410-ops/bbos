-- Final one-time cleanup before real green-coffee purchasing and production.
-- Every target is an explicitly reviewed test record. Master data, the invoiced
-- sales order B-2026-000001 and its fiscal history are intentionally preserved.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "GreenCoffeeReceipt"
     WHERE "purchaseId" IN (
       'cmt4yt6wp0001be2ikdau0i92',
       'cmt4ytaac0008be2ipu1i5vxy',
       'cmt4ytcaw000fbe2iegadpy1b',
       'cmt54cdcf0001cd31z8jm8yhc'
     )
  ) THEN
    RAISE EXCEPTION 'Cleanup refused: a targeted test purchase now has a receipt';
  END IF;

  IF EXISTS (
    SELECT 1
      FROM "FinishedProduct"
     WHERE id = '18edd8b8-506c-4166-84fc-a503aaf1c5cc'
       AND (
         sku <> 'GOU-ESS-500'
         OR "quantityOnHand" <> 1
         OR "reservedQuantity" <> 1
       )
  ) THEN
    RAISE EXCEPTION 'Cleanup refused: the reviewed test stock balance has changed';
  END IF;
END $$;

DELETE FROM "GreenCoffeeAuditEvent"
 WHERE "purchaseId" IN (
   'cmt4yt6wp0001be2ikdau0i92',
   'cmt4ytaac0008be2ipu1i5vxy',
   'cmt4ytcaw000fbe2iegadpy1b',
   'cmt54cdcf0001cd31z8jm8yhc'
 );

DELETE FROM "GreenCoffeeApprovalRequest"
 WHERE "purchaseId" IN (
   'cmt4yt6wp0001be2ikdau0i92',
   'cmt4ytaac0008be2ipu1i5vxy',
   'cmt4ytcaw000fbe2iegadpy1b',
   'cmt54cdcf0001cd31z8jm8yhc'
 );

UPDATE "AccountsPayable"
   SET "purchaseId" = NULL
 WHERE "purchaseId" IN (
   'cmt4yt6wp0001be2ikdau0i92',
   'cmt4ytaac0008be2ipu1i5vxy',
   'cmt4ytcaw000fbe2iegadpy1b',
   'cmt54cdcf0001cd31z8jm8yhc'
 );

UPDATE "ProfessionalCoffeeSample"
   SET "purchaseId" = NULL
 WHERE "purchaseId" IN (
   'cmt4yt6wp0001be2ikdau0i92',
   'cmt4ytaac0008be2ipu1i5vxy',
   'cmt4ytcaw000fbe2iegadpy1b',
   'cmt54cdcf0001cd31z8jm8yhc'
 );

DELETE FROM "GreenCoffeePurchase"
 WHERE id IN (
   'cmt4yt6wp0001be2ikdau0i92',
   'cmt4ytaac0008be2ipu1i5vxy',
   'cmt4ytcaw000fbe2iegadpy1b',
   'cmt54cdcf0001cd31z8jm8yhc'
 );

DELETE FROM "InventoryReservation"
 WHERE id = 'cmud00wui0001t54k8nkd0hdw'
   AND "salesOrderId" = 'cmuctuuoa0001mt4kx6mzfw6d';

DELETE FROM "FinishedGoodsMovement"
 WHERE id = 'ef34fefc-1368-48f5-ae51-d05eb48bf0a1'
   AND "finishedProductId" = '18edd8b8-506c-4166-84fc-a503aaf1c5cc';

UPDATE "FinishedProduct"
   SET "quantityOnHand" = 0,
       "reservedQuantity" = 0,
       "updatedAt" = NOW()
 WHERE id = '18edd8b8-506c-4166-84fc-a503aaf1c5cc'
   AND sku = 'GOU-ESS-500'
   AND "quantityOnHand" = 1
   AND "reservedQuantity" = 1;
