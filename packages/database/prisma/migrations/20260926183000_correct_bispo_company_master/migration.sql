-- Correct the production company master data used by fiscal inbound validation.
UPDATE "Company"
SET
  name = 'Bispo Coffees Ltda',
  "taxId" = '13.008.726/0001-12',
  "updatedAt" = NOW()
WHERE "taxId" = '12.345.678/0001-90'
   OR id = 'cmszzhc0z0000fu31ovnwja4m';
