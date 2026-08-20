CREATE TYPE "TaxVerificationStatus" AS ENUM ('VERIFIED_ACTIVE', 'VERIFIED_INACTIVE', 'INVALID', 'NOT_VERIFIED', 'SERVICE_UNAVAILABLE');
ALTER TABLE "Supplier" ADD COLUMN "taxIdVerificationStatus" "TaxVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED';
ALTER TABLE "Supplier" ADD COLUMN "taxIdVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Supplier" ADD COLUMN "taxIdVerificationSource" TEXT;
ALTER TABLE "Supplier" ADD COLUMN "stateRegistrationVerificationStatus" "TaxVerificationStatus" NOT NULL DEFAULT 'NOT_VERIFIED';
ALTER TABLE "Supplier" ADD COLUMN "stateRegistrationVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Supplier" ADD COLUMN "stateRegistrationVerificationSource" TEXT;
