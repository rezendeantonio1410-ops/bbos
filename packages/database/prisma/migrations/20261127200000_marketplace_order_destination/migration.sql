-- Cidade e UF de entrega dos pedidos de marketplace, para o mapa de vendas.
-- Só cidade e UF (sem nome, rua ou CEP do comprador). Tabela nova; nada
-- existente é alterado.
CREATE TABLE IF NOT EXISTS "MarketplaceOrderDestination" (
  "inboxId" TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL,
  "city" TEXT,
  "state" TEXT,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketplaceOrderDestination_inbox_fkey" FOREIGN KEY ("inboxId") REFERENCES "MarketplaceOrderInbox"("id") ON DELETE CASCADE,
  CONSTRAINT "MarketplaceOrderDestination_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "MarketplaceOrderDestination_company_idx" ON "MarketplaceOrderDestination"("companyId","state");
