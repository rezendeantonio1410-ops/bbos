-- Prevent concurrent Signa commercial registrations from persisting duplicate
-- active CNPJs in the same company/partner portfolio. Historical CNPJs may
-- have punctuation; normalize them in the index so both forms collide.
-- Fails safely (without modifying rows) if existing active duplicates exist.
-- Deliberately does not change the fiscal Customer table.
CREATE UNIQUE INDEX "PartnerEndCustomer_active_scoped_cnpj_unique"
  ON "PartnerEndCustomer"
    ("companyId", "partnerId", (regexp_replace("taxId", '[^0-9]', '', 'g')))
  WHERE active = true AND "taxId" IS NOT NULL
    AND length(regexp_replace("taxId", '[^0-9]', '', 'g')) = 14;
