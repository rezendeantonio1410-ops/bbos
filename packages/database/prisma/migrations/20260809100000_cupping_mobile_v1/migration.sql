-- Cupping Mobile V1: private completion state, five-cup audit and extensible descriptor catalog
CREATE TYPE "CuppingEvaluationStatus" AS ENUM ('DRAFT', 'COMPLETED');

ALTER TABLE "CuppingEvaluation" ADD COLUMN "status" "CuppingEvaluationStatus" NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "CuppingEvaluation" ADD COLUMN "cupStates" JSONB;
ALTER TABLE "CuppingEvaluation" ADD COLUMN "balance" DECIMAL(5,2);

ALTER TABLE "CuppingDescriptor" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FLAVOR';
ALTER TABLE "CuppingDescriptor" ADD COLUMN "group" TEXT;
ALTER TABLE "CuppingDescriptor" ADD COLUMN "subgroup" TEXT;
ALTER TABLE "CuppingDescriptor" ADD COLUMN "parentId" TEXT;
ALTER TABLE "CuppingDescriptor" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'SCA_REFERENCE';
ALTER TABLE "CuppingDescriptor" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "CuppingDescriptor_companyId_type_active_idx" ON "CuppingDescriptor"("companyId", "type", "active");
