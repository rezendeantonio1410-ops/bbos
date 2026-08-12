CREATE TYPE "CreditRequestStatus" AS ENUM ('DRAFT','SUBMITTED','UNDER_REVIEW','PENDING_DOCUMENTS','APPROVED','PARTIALLY_APPROVED','REJECTED','CANCELLED');

CREATE TABLE "CustomerContact" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "name" TEXT NOT NULL, "role" TEXT NOT NULL, "phone" TEXT, "whatsapp" TEXT, "email" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CustomerContact_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerDocument" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "uploadedById" TEXT NOT NULL, "name" TEXT NOT NULL, "type" TEXT NOT NULL, "storageKey" TEXT NOT NULL, "mimeType" TEXT, "sizeBytes" INTEGER, "version" INTEGER NOT NULL DEFAULT 1, "status" TEXT NOT NULL DEFAULT 'RECEIVED', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerDocument_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CreditRequest" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "requestedById" TEXT NOT NULL, "reviewedById" TEXT, "status" "CreditRequestStatus" NOT NULL DEFAULT 'DRAFT', "requestedLimit" DECIMAL(14,2) NOT NULL, "approvedLimit" DECIMAL(14,2), "requestedTermDays" INTEGER NOT NULL, "approvedTermDays" INTEGER, "expectedMonthlyBuy" DECIMAL(14,2), "paymentMethod" TEXT, "commercialReferences" TEXT, "justification" TEXT, "reviewNote" TEXT, "submittedAt" TIMESTAMP(3), "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CreditRequest_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerActivity" (
  "id" TEXT NOT NULL, "companyId" TEXT NOT NULL, "customerId" TEXT NOT NULL, "actorId" TEXT, "type" TEXT NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "metadata" JSONB, "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerActivity_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CustomerContact_customerId_role_idx" ON "CustomerContact"("customerId","role");
CREATE INDEX "CustomerDocument_customerId_type_version_idx" ON "CustomerDocument"("customerId","type","version");
CREATE INDEX "CreditRequest_companyId_status_createdAt_idx" ON "CreditRequest"("companyId","status","createdAt");
CREATE INDEX "CreditRequest_customerId_status_idx" ON "CreditRequest"("customerId","status");
CREATE INDEX "CustomerActivity_customerId_occurredAt_idx" ON "CustomerActivity"("customerId","occurredAt");
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerContact" ADD CONSTRAINT "CustomerContact_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerDocument" ADD CONSTRAINT "CustomerDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "SalesPerson"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CreditRequest" ADD CONSTRAINT "CreditRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerActivity" ADD CONSTRAINT "CustomerActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
