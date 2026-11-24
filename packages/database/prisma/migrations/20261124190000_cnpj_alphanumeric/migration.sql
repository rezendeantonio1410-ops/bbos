-- Alphanumeric CNPJ (Receita Federal, from July 2026): 12 characters 0-9/A-Z
-- plus 2 numeric check digits. Widens two format checks that accepted only
-- digits. Every value already stored (14 digits) still matches; no row changes.

ALTER TABLE "CustomerTaxIdSuggestion" DROP CONSTRAINT IF EXISTS "CustomerTaxIdSuggestion_taxId_format_check";
ALTER TABLE "CustomerTaxIdSuggestion"
  ADD CONSTRAINT "CustomerTaxIdSuggestion_taxId_format_check" CHECK ("taxId" ~ '^[0-9A-Z]{12}[0-9]{2}$');

ALTER TABLE "Prospect" DROP CONSTRAINT IF EXISTS "Prospect_suggested_tax_id_check";
ALTER TABLE "Prospect"
  ADD CONSTRAINT "Prospect_suggested_tax_id_check" CHECK ("suggestedTaxId" IS NULL OR "suggestedTaxId" ~ '^[0-9A-Z]{12}[0-9]{2}$');
