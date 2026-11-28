-- BBOS Campo: dia em campo do vendedor (GPS do tablet só entre "Iniciar dia"
-- e "Encerrar dia"), concordância versionada e localização da visita.
-- Tabelas novas e colunas opcionais; nada existente é alterado ou apagado.

CREATE TABLE IF NOT EXISTS "FieldConsent" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "version" INTEGER NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "FieldConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldConsent_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "FieldConsent_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FieldConsent_user_version_key" ON "FieldConsent"("companyId","userId","version");

CREATE TABLE IF NOT EXISTS "FieldDay" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "userName" TEXT,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "pausedMinutes" NUMERIC(8,1) NOT NULL DEFAULT 0,
  "km" NUMERIC(8,1),
  "consentVersion" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FieldDay_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldDay_company_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE,
  CONSTRAINT "FieldDay_user_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE,
  CONSTRAINT "FieldDay_status_check" CHECK ("status" IN ('ACTIVE','PAUSED','ENDED'))
);
CREATE INDEX IF NOT EXISTS "FieldDay_user_started_idx" ON "FieldDay"("companyId","userId","startedAt");
-- No máximo um dia aberto por pessoa.
CREATE UNIQUE INDEX IF NOT EXISTS "FieldDay_one_open_key" ON "FieldDay"("companyId","userId") WHERE "status" <> 'ENDED';

CREATE TABLE IF NOT EXISTS "FieldPoint" (
  "id" BIGSERIAL NOT NULL,
  "dayId" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL,
  "lat" DOUBLE PRECISION NOT NULL,
  "lng" DOUBLE PRECISION NOT NULL,
  "accuracy" REAL,
  "speed" REAL,
  CONSTRAINT "FieldPoint_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FieldPoint_day_fkey" FOREIGN KEY ("dayId") REFERENCES "FieldDay"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "FieldPoint_day_at_key" ON "FieldPoint"("dayId","at");

ALTER TABLE "CustomerVisit" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "CustomerVisit" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;
