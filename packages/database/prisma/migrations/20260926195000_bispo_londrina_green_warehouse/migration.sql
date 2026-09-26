-- Create the physical green-coffee warehouse for Bispo Coffees Londrina.
INSERT INTO "Warehouse" (id,"companyId",name,code,type,"createdAt","updatedAt")
SELECT 'wh-bispo-londrina-green', id, 'Bispo Coffees Londrina', 'BCL-CV', 'GREEN_COFFEE', NOW(), NOW()
FROM "Company"
WHERE "taxId" = '13.008.726/0001-12'
ON CONFLICT ("companyId",code) DO UPDATE SET
  name='Bispo Coffees Londrina',
  type='GREEN_COFFEE',
  "updatedAt"=NOW();
