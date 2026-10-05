-- Sales order samples v1
-- Sample orders follow stock, fiscal and shipping operations, but are kept
-- separate from commercial revenue, receivables and broker commissions.

ALTER TABLE "SalesOrder"
  ADD COLUMN "orderType" VARCHAR(20) NOT NULL DEFAULT 'COMMERCIAL';

ALTER TABLE "SalesOrder"
  ADD CONSTRAINT "SalesOrder_orderType_check"
  CHECK ("orderType" IN ('COMMERCIAL', 'SAMPLE'));

CREATE INDEX "SalesOrder_companyId_orderType_status_idx"
  ON "SalesOrder"("companyId", "orderType", status);
