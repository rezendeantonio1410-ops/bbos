UPDATE "GreenCoffeeReceipt" r
SET "qualityStatus"='APPROVED',"updatedAt"=NOW()
FROM "GreenCoffeeLabSample" s
WHERE s."receiptId"=r.id AND s."sampleNumber"='LAB-2026-000001' AND s.status='COMPLETED' AND r."qualityStatus"='AWAITING_ANALYSIS';
UPDATE "CoffeeLot" l
SET status='APPROVED',"updatedAt"=NOW()
FROM "GreenCoffeeReceipt" r JOIN "GreenCoffeeLabSample" s ON s."receiptId"=r.id
WHERE l.id=r."coffeeLotId" AND s."sampleNumber"='LAB-2026-000001' AND s.status='COMPLETED';
