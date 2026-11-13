-- A legacy/API validation gap allowed an analysis to be marked COMPLETED while
-- the receipt still had no final quality decision. Put only those inconsistent
-- samples back in the pending queue; approved/rejected analyses are untouched.
UPDATE "GreenCoffeeLabSample" AS sample
   SET status = 'PENDING',
       "updatedAt" = CURRENT_TIMESTAMP
  FROM "GreenCoffeeReceipt" AS receipt
 WHERE receipt.id = sample."receiptId"
   AND sample.status IN ('COMPLETED', 'REJECTED')
   AND receipt."qualityStatus" = 'AWAITING_ANALYSIS';
