CREATE TABLE IF NOT EXISTS "SalesOrderPaymentSchedule" (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES "Company"(id) ON DELETE CASCADE,
  "salesOrderId" TEXT NOT NULL REFERENCES "SalesOrder"(id) ON DELETE CASCADE,
  installment INTEGER NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  amount DECIMAL(14,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("salesOrderId",installment),
  CHECK (status IN ('OPEN','PAID','CANCELLED'))
);
CREATE INDEX IF NOT EXISTS "SalesOrderPaymentSchedule_due_idx" ON "SalesOrderPaymentSchedule"("companyId",status,"dueDate");
