-- BBOS Campo: registro de mensagens de WhatsApp abertas pelo vendedor para o
-- cliente (lembrete de vencimento, pedido a caminho, reposição...).
-- Tabela nova; nada existente é alterado ou apagado.

CREATE TABLE IF NOT EXISTS "CustomerMessageLog" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
  "kind" TEXT NOT NULL,
  "orderNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerMessageLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerMessageLog_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerMessageLog_customer_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE,
  CONSTRAINT "CustomerMessageLog_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CustomerMessageLog_customer_idx" ON "CustomerMessageLog"("companyId","customerId","createdAt");
CREATE INDEX IF NOT EXISTS "CustomerMessageLog_user_idx" ON "CustomerMessageLog"("companyId","userId","createdAt");
