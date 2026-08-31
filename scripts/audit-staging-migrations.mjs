#!/usr/bin/env node
/* Staging-only recovery: reconcile migration history only after read-only checks. */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const requireFromDatabase = createRequire(join(process.cwd(), "packages/database/package.json"));
const { PrismaClient } = requireFromDatabase("@prisma/client");
const prisma = new PrismaClient();

function run(command, args) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  const r = spawnSync(command, args, { stdio: "inherit", env: process.env });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${command} exited with status ${r.status}`);
}
function resolveApplied(name) {
  run("pnpm", ["--filter", "@bbos/database", "exec", "prisma", "migrate", "resolve", "--applied", name, "--schema=prisma/schema.prisma"]);
}
async function scalar(sql, ...values) {
  const rows = await prisma.$queryRawUnsafe(sql, ...values);
  return rows[0]?.value ?? null;
}
async function exists(sql, ...values) { return Boolean(await scalar(sql, ...values)); }
const table = (n) => exists(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=$1) AS value`, n);
const col = (t, c) => exists(`SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 AND column_name=$2) AS value`, t, c);
const idx = (n) => exists(`SELECT EXISTS (SELECT 1 FROM pg_class WHERE relkind='i' AND relname=$1) AS value`, n);
const fk = (n) => exists(`SELECT EXISTS (SELECT 1 FROM pg_constraint WHERE conname=$1) AS value`, n);
const en = (n) => exists(`SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname=$1) AS value`, n);
const enumValue = (t, v) => exists(`SELECT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname=$1 AND e.enumlabel=$2) AS value`, t, v);

async function audit(name, checks) {
  console.log(`\nAUDIT ${name}`);
  let safe = true;
  for (const [label, promise] of checks) {
    const ok = await promise;
    console.log(`${label}: ${ok ? "PASS" : "FAIL"}`);
    safe &&= ok;
  }
  console.log(`SAFE ${name}: ${safe ? "YES" : "NO"}`);
  return safe;
}

try {
  const serviceName = process.env.RENDER_SERVICE_NAME ?? "";
  if (serviceName && serviceName !== "bbos-api-staging") throw new Error(`Refusing recovery on Render service: ${serviceName}`);

  const history = await prisma.$queryRawUnsafe(`SELECT migration_name, finished_at, rolled_back_at, logs FROM "_prisma_migrations" ORDER BY started_at, migration_name`);
  const byName = new Map(history.map((r) => [r.migration_name, r]));
  const status = (name) => {
    const r = byName.get(name);
    if (!r) return "NOT_REGISTERED";
    if (r.rolled_back_at) return "ROLLED_BACK";
    if (r.finished_at) return "APPLIED";
    if (r.logs) return "FAILED";
    return "PENDING";
  };
  const recoveries = [];
  const add = async (name, checks) => recoveries.push([name, await audit(name, checks)]);

  await add("20260814120000_green_coffee_purchase_v2", [
    ["enum approval", en("PurchaseApprovalStatus")], ["enum operational", en("PurchaseOperationalStatus")],
    ["enum payment terms", en("PurchasePaymentTermType")], ["enum installments", en("PurchaseInstallmentStatus")],
    ["installment table", table("GreenCoffeePurchaseInstallment")], ["bank table", table("SupplierBankAccount")],
    ["species table", table("CoffeeSpecies")], ["variety table", table("CoffeeVariety")],
    ["purchase approvalStatus", col("GreenCoffeePurchase", "approvalStatus")], ["purchase operationalStatus", col("GreenCoffeePurchase", "operationalStatus")],
    ["purchase createdByUserId", col("GreenCoffeePurchase", "createdByUserId")], ["purchase createdByName", col("GreenCoffeePurchase", "createdByName")],
    ["installment unique", idx("GreenCoffeePurchaseInstallment_purchaseId_installmentNumber_key")], ["installment FK", fk("GreenCoffeePurchaseInstallment_purchaseId_fkey")],
  ]);

  const mismatchCount = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "GreenCoffeePurchaseInstallment" i JOIN "AccountsPayable" a ON a.id=i."accountsPayableId" WHERE a."purchaseId" IS DISTINCT FROM i."purchaseId"`));
  await add("20260814130000_purchase_financial_purchase_link", [
    ["AccountsPayable.purchaseId", col("AccountsPayable", "purchaseId")], ["purchase/dueDate index", idx("AccountsPayable_purchaseId_dueDate_idx")],
    ["purchase FK", fk("AccountsPayable_purchaseId_fkey")], ["backfill consistency", Promise.resolve(mismatchCount === 0)],
  ]);

  await add("20260814150000_purchase_external_acceptance", [
    ["acceptance enum", en("PurchaseExternalAcceptanceStatus")], ["Supplier.contactRole", col("Supplier", "contactRole")],
    ["Supplier.whatsapp", col("Supplier", "whatsapp")], ["purchase acceptance status", col("GreenCoffeePurchase", "externalAcceptanceStatus")],
    ["acceptance table", table("GreenCoffeePurchaseAcceptance")], ["acceptance token index", idx("GreenCoffeePurchaseAcceptance_tokenHash_key")],
    ["acceptance purchase FK", fk("GreenCoffeePurchaseAcceptance_purchaseId_fkey")], ["acceptance supplier FK", fk("GreenCoffeePurchaseAcceptance_supplierId_fkey")],
  ]);

  await add("20260814180000_purchase_submission_lifecycle", [
    ["submittedAt", col("GreenCoffeePurchase", "submittedForApprovalAt")], ["submittedBy", col("GreenCoffeePurchase", "submittedForApprovalByUserId")],
  ]);
  await add("20260815090000_purchase_return_adjustment", [
    ["returnedBy", col("GreenCoffeePurchase", "returnedByUserId")], ["returnedAt", col("GreenCoffeePurchase", "returnedAt")],
    ["returnReason", col("GreenCoffeePurchase", "returnReason")], ["correctionRequest", col("GreenCoffeePurchase", "correctionRequest")],
  ]);
  await add("20260816120000_supplier_contacts", [
    ["SupplierContact table", table("SupplierContact")], ["acceptance supplierContactId", col("GreenCoffeePurchaseAcceptance", "supplierContactId")],
    ["phone snapshot", col("GreenCoffeePurchaseAcceptance", "contactPhoneSnapshot")], ["email snapshot", col("GreenCoffeePurchaseAcceptance", "contactEmailSnapshot")],
    ["SupplierContact active index", idx("SupplierContact_supplierId_active_canConfirmBusiness_idx")], ["SupplierContact supplier FK", fk("SupplierContact_supplierId_fkey")],
    ["acceptance supplierContact FK", fk("GreenCoffeePurchaseAcceptance_supplierContactId_fkey")],
  ]);
  await add("20260818100000_user_avatar", [["User.avatarUrl", col("User", "avatarUrl")]]);

  await add("20260819090000_green_coffee_reference_data_v1", [
    ["variety breeder", col("CoffeeVariety", "breeder")], ["variety sortOrder", col("CoffeeVariety", "sortOrder")],
    ["CoffeeRegion table", table("CoffeeRegion")], ["ScreenClassification table", table("ScreenClassification")],
    ["region unique", idx("CoffeeRegion_companyId_state_name_key")], ["screen unique", idx("ScreenClassification_companyId_code_key")],
    ["purchase speciesId", col("GreenCoffeePurchase", "speciesId")], ["purchase cultivarId", col("GreenCoffeePurchase", "cultivarId")],
    ["purchase regionId", col("GreenCoffeePurchase", "coffeeRegionId")], ["purchase screenId", col("GreenCoffeePurchase", "screenClassificationId")],
    ["species FK", fk("GreenCoffeePurchase_speciesId_fkey")], ["cultivar FK", fk("GreenCoffeePurchase_cultivarId_fkey")],
    ["region FK", fk("GreenCoffeePurchase_coffeeRegionId_fkey")], ["screen FK", fk("GreenCoffeePurchase_screenClassificationId_fkey")],
  ]);

  const activeShape = await prisma.$queryRawUnsafe(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Supplier' AND column_name='active'`);
  await add("20260819093000_supplier_active_reference_bootstrap", [
    ["Supplier.active", col("Supplier", "active")], ["active NOT NULL", Promise.resolve(activeShape[0]?.is_nullable === "NO")],
    ["active default true", Promise.resolve(String(activeShape[0]?.column_default).toLowerCase() === "true")],
  ]);
  await add("20260819110000_supplier_origin_units", [
    ["origin unit table", table("SupplierOriginUnit")], ["origin unique", idx("SupplierOriginUnit_supplierId_name_key")],
    ["origin state index", idx("SupplierOriginUnit_supplierId_state_active_idx")], ["origin region index", idx("SupplierOriginUnit_coffeeRegionId_idx")],
    ["origin supplier FK", fk("SupplierOriginUnit_supplierId_fkey")], ["origin region FK", fk("SupplierOriginUnit_coffeeRegionId_fkey")],
    ["purchase originUnitId", col("GreenCoffeePurchase", "originUnitId")], ["purchase origin FK", fk("GreenCoffeePurchase_originUnitId_fkey")],
  ]);
  await add("20260819130000_supplier_origin_details", [
    ["COOPERATIVE enum", enumValue("GreenCoffeeSupplierType", "COOPERATIVE")], ["ASSOCIATION enum", enumValue("GreenCoffeeSupplierType", "ASSOCIATION")],
    ["EXPORTER enum", enumValue("GreenCoffeeSupplierType", "EXPORTER")], ["OTHER enum", enumValue("GreenCoffeeSupplierType", "OTHER")],
    ["Supplier.tradeName", col("Supplier", "tradeName")], ["origin taxId", col("SupplierOriginUnit", "taxId")],
    ["origin stateRegistration", col("SupplierOriginUnit", "stateRegistration")], ["origin latitude", col("SupplierOriginUnit", "latitude")],
    ["origin longitude", col("SupplierOriginUnit", "longitude")], ["production table", table("SupplierOriginProduction")],
    ["production origin FK", fk("SupplierOriginProduction_originUnitId_fkey")], ["production species FK", fk("SupplierOriginProduction_speciesId_fkey")],
    ["production cultivar FK", fk("SupplierOriginProduction_cultivarId_fkey")],
  ]);
  await add("20260819150000_structured_supplier_addresses", [
    ["Supplier.postalCode", col("Supplier", "postalCode")], ["Supplier.district", col("Supplier", "district")],
    ["Supplier.addressComplement", col("Supplier", "addressComplement")], ["Supplier.ibgeCityCode", col("Supplier", "ibgeCityCode")],
    ["origin.postalCode", col("SupplierOriginUnit", "postalCode")], ["origin.district", col("SupplierOriginUnit", "district")],
    ["origin.addressComplement", col("SupplierOriginUnit", "addressComplement")], ["origin.ibgeCityCode", col("SupplierOriginUnit", "ibgeCityCode")],
  ]);
  await add("20260819160000_supplier_tax_verification", [
    ["tax enum", en("TaxVerificationStatus")], ["tax status", col("Supplier", "taxIdVerificationStatus")],
    ["tax verifiedAt", col("Supplier", "taxIdVerifiedAt")], ["tax source", col("Supplier", "taxIdVerificationSource")],
    ["state registration status", col("Supplier", "stateRegistrationVerificationStatus")], ["state registration verifiedAt", col("Supplier", "stateRegistrationVerifiedAt")],
    ["state registration source", col("Supplier", "stateRegistrationVerificationSource")],
  ]);
  const registrationShape = await prisma.$queryRawUnsafe(`SELECT is_nullable, column_default FROM information_schema.columns WHERE table_schema='public' AND table_name='Supplier' AND column_name='stateRegistrationType'`);
  await add("20260819170000_supplier_state_registration_type", [
    ["stateRegistrationType", col("Supplier", "stateRegistrationType")], ["registration NOT NULL", Promise.resolve(registrationShape[0]?.is_nullable === "NO")],
    ["registration default NUMBER", Promise.resolve(String(registrationShape[0]?.column_default).includes("NUMBER"))],
  ]);
  await add("20260820100000_purchase_broker_v2", [
    ["confirmation enum", en("PurchaseConfirmationDocumentStatus")], ["Broker table", table("Broker")], ["Broker company FK", fk("Broker_companyId_fkey")],
    ["Broker tax unique", idx("Broker_companyId_taxId_key")], ["purchase brokerId", col("GreenCoffeePurchase", "brokerId")],
    ["purchase commission percent", col("GreenCoffeePurchase", "brokerCommissionPercent")], ["purchase commission amount", col("GreenCoffeePurchase", "brokerCommissionAmount")],
    ["purchase broker FK", fk("GreenCoffeePurchase_brokerId_fkey")], ["confirmation table", table("PurchaseConfirmationDocumentVersion")],
    ["confirmation unique", idx("PurchaseConfirmationDocumentVersion_purchaseId_version_key")], ["confirmation FK", fk("PurchaseConfirmationDocumentVersion_purchaseId_fkey")],
    ["AP brokerId", col("AccountsPayable", "brokerId")], ["AP broker key", col("AccountsPayable", "brokerCommissionPayableKey")], ["AP broker FK", fk("AccountsPayable_brokerId_fkey")],
  ]);

  /* Cupping history. Historical indexes removed by later migrations are intentionally not required here. */
  await add("20260823190000_cupping_sessions_v1", [
    ["CuppingSessionStatus enum", en("CuppingSessionStatus")], ["CuppingDecision enum", en("CuppingDecision")],
    ["CuppingSession table", table("CuppingSession")], ["CuppingEvaluation table", table("CuppingEvaluation")],
    ["session company/code unique", idx("CuppingSession_companyId_code_key")], ["session status index", idx("CuppingSession_companyId_status_idx")],
    ["session sample index", idx("CuppingSession_sampleId_idx")], ["evaluation evaluator index", idx("CuppingEvaluation_evaluatorId_idx")],
    ["session company FK", fk("CuppingSession_companyId_fkey")], ["session sample FK", fk("CuppingSession_sampleId_fkey")],
    ["evaluation session FK", fk("CuppingEvaluation_sessionId_fkey")],
  ]);
  await add("20260823200000_cupping_training_v1", [
    ["training level enum", en("CuppingTrainingLevel")], ["training status enum", en("CuppingTrainingStatus")],
    ["training session table", table("CuppingTrainingSession")], ["training evaluation table", table("CuppingTrainingEvaluation")],
    ["training session unique", idx("CuppingTrainingSession_companyId_code_key")], ["training session status index", idx("CuppingTrainingSession_companyId_status_idx")],
    ["training evaluation unique", idx("CuppingTrainingEvaluation_sessionId_participantId_key")], ["training participant index", idx("CuppingTrainingEvaluation_participantId_idx")],
    ["training company FK", fk("CuppingTrainingSession_companyId_fkey")], ["training session FK", fk("CuppingTrainingEvaluation_sessionId_fkey")],
  ]);
  await add("20260823210000_professional_coffee_samples_v1", [
    ["sample source enum", en("ProfessionalSampleSource")], ["sample status enum", en("ProfessionalSampleStatus")],
    ["professional sample table", table("ProfessionalCoffeeSample")], ["professional evaluation table", table("ProfessionalSampleEvaluation")],
    ["sample code unique", idx("ProfessionalCoffeeSample_companyId_code_key")], ["sample purchase unique", idx("ProfessionalCoffeeSample_purchaseId_key")],
    ["sample receipt unique", idx("ProfessionalCoffeeSample_receiptId_key")], ["evaluation unique", idx("ProfessionalSampleEvaluation_sampleId_evaluatorId_key")],
    ["sample company FK", fk("ProfessionalCoffeeSample_companyId_fkey")], ["sample supplier FK", fk("ProfessionalCoffeeSample_supplierId_fkey")],
    ["sample origin FK", fk("ProfessionalCoffeeSample_originUnitId_fkey")], ["sample purchase FK", fk("ProfessionalCoffeeSample_purchaseId_fkey")],
    ["sample receipt FK", fk("ProfessionalCoffeeSample_receiptId_fkey")], ["sample source FK", fk("ProfessionalCoffeeSample_sourceSampleId_fkey")],
    ["evaluation sample FK", fk("ProfessionalSampleEvaluation_sampleId_fkey")],
  ]);
  await add("20260823220000_cupping_public_participation_v1", [
    ["public kind enum", en("CuppingPublicKind")], ["public status enum", en("CuppingPublicStatus")], ["participant status enum", en("CuppingParticipantStatus")],
    ["public session table", table("CuppingPublicSession")], ["participant table", table("CuppingParticipant")], ["participant evaluation table", table("CuppingParticipantEvaluation")],
    ["public code unique", idx("CuppingPublicSession_companyId_code_key")], ["public token unique", idx("CuppingPublicSession_tokenHash_key")],
    ["participant phone unique", idx("CuppingParticipant_sessionId_normalizedPhone_key")], ["participant evaluation unique", idx("CuppingParticipantEvaluation_participantId_key")],
    ["public company FK", fk("CuppingPublicSession_companyId_fkey")], ["public sample FK", fk("CuppingPublicSession_professionalSampleId_fkey")],
    ["participant session FK", fk("CuppingParticipant_sessionId_fkey")], ["participant evaluation FK", fk("CuppingParticipantEvaluation_participantId_fkey")],
  ]);

  const missingLegacyRows = Number(await scalar(`SELECT COUNT(*)::int AS value FROM "CuppingSession" s LEFT JOIN "CuppingSessionSample" ss ON ss."sessionId"=s.id AND ss."sourceType"='GREEN_COFFEE_LAB_SAMPLE' AND ss."sourceId"=s."sampleId" AND ss."sampleId"=s."sampleId" WHERE ss.id IS NULL`));
  await add("20260827000000_cupping_session_samples_v1", [
    ["session protocolVersion", col("CuppingSession", "protocolVersion")], ["session sample table", table("CuppingSessionSample")],
    ["session sample source unique", idx("CuppingSessionSample_sessionId_sourceType_sourceId_key")], ["session sample sample index", idx("CuppingSessionSample_sampleId_idx")],
    ["session sample professional index", idx("CuppingSessionSample_professionalSampleId_idx")], ["session sample position index", idx("CuppingSessionSample_sessionId_position_idx")],
    ["session sample session FK", fk("CuppingSessionSample_sessionId_fkey")], ["session sample sample FK", fk("CuppingSessionSample_sampleId_fkey")],
    ["session sample professional FK", fk("CuppingSessionSample_professionalSampleId_fkey")], ["legacy backfill complete", Promise.resolve(missingLegacyRows === 0)],
  ]);
  await add("20260827100000_cupping_evaluation_session_sample", [
    ["evaluation sessionSampleId", col("CuppingEvaluation", "sessionSampleId")], ["evaluation sessionSample FK", fk("CuppingEvaluation_sessionSampleId_fkey")],
    ["new evaluation unique", idx("CuppingEvaluation_sessionId_sessionSampleId_evaluatorId_key")],
    ["old evaluation unique removed", idx("CuppingEvaluation_sessionId_evaluatorId_key").then((v) => !v)],
  ]);
  await add("20260827200000_cupping_participant_invites_v1", [
    ["invite status enum", en("CuppingParticipantInviteStatus")], ["invite table", table("CuppingParticipantInvite")],
    ["invite token unique", idx("CuppingParticipantInvite_tokenHash_key")], ["invite session/participant unique", idx("CuppingParticipantInvite_sessionId_participantId_key")],
    ["invite company/status index", idx("CuppingParticipantInvite_companyId_status_idx")], ["invite session/status index", idx("CuppingParticipantInvite_sessionId_status_idx")],
    ["invite participant/status index", idx("CuppingParticipantInvite_participantId_status_idx")], ["invite company FK", fk("CuppingParticipantInvite_companyId_fkey")],
    ["invite session FK", fk("CuppingParticipantInvite_sessionId_fkey")],
  ]);

  if (recoveries.some(([, safe]) => !safe)) throw new Error("Recovery audit failed; migration history was not changed.");
  await prisma.$disconnect();

  for (const [name] of recoveries) {
    const s = status(name);
    console.log(`${name}: ${s}`);
    if (s === "FAILED" || s === "NOT_REGISTERED") resolveApplied(name);
    else if (s !== "APPLIED") throw new Error(`Unexpected ${name} status: ${s}`);
  }

  run("pnpm", ["db:generate"]);
  run("pnpm", ["db:migrate:deploy"]);
  run("pnpm", ["db:seed:coffee-references"]);
  run("pnpm", ["--filter", "@bbos/api", "build"]);
  console.log("\nSTAGING DATABASE RECOVERY: COMPLETE");
} finally {
  await prisma.$disconnect().catch(() => {});
}
