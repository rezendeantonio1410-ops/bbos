-- Optional, manually informed state registration (IE) for Signa commercial
-- end customers. Additive and nullable: no existing row is changed.
-- Not used for NF-e (fiscal recipients stay Signa/Rodrigo).
ALTER TABLE "PartnerEndCustomer" ADD COLUMN "stateRegistration" TEXT;
