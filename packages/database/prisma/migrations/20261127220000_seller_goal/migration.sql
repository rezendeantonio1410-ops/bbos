-- Meta mensal do vendedor (R$ e kg), definida pela liderança. Tabela nova;
-- nada existente é alterado.
CREATE TABLE IF NOT EXISTS "SellerGoal" (
  "companyId" TEXT NOT NULL,
  "partnerId" TEXT NOT NULL,
  "month" TEXT NOT NULL,
  "salesTarget" NUMERIC(14,2),
  "kgTarget" NUMERIC(12,3),
  "updatedByName" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SellerGoal_pkey" PRIMARY KEY ("companyId","partnerId","month"),
  CONSTRAINT "SellerGoal_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "SellerGoal_partner_fkey" FOREIGN KEY ("partnerId") REFERENCES "StorefrontPartner"("id") ON DELETE CASCADE
);
