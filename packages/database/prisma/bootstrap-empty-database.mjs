// Builds a brand-new, EMPTY PostgreSQL database for isolated environments
// (homologation, previews). It never runs against a database that already has
// tables, and only when BBOS_EMPTY_DATABASE_BOOTSTRAP=true is set explicitly.
//
// Why: the historical chain cannot be replayed with `prisma migrate deploy` on
// an empty database. `20260806000000_initial_baseline` already creates objects
// that later legacy migrations create again (e.g. the duplicate index in
// `20260807143000_product_catalog_persistence_v1`), and production reached its
// current state by marking those migrations as applied. Migration files and the
// production history are left untouched.
//
// How: legacy migrations (before LEGACY_CUTOFF) are replayed statement by
// statement inside ONE transaction (a savepoint per statement tolerates
// "already exists"-style failures), and recorded as applied exactly as
// `prisma migrate resolve --applied` would. Every later migration (all Signa migrations) is applied STRICTLY
// by `prisma migrate deploy`, the same command production uses.
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";

export const LEGACY_CUTOFF = "20261122010000";
const migrationsDir = join(process.cwd(), "prisma", "migrations");

/** Splits SQL into statements, respecting comments, quotes and dollar quotes. */
export function splitSqlStatements(sql) {
  const statements = [];
  let current = "";
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      const end = sql.indexOf("\n", i);
      i = end === -1 ? sql.length : end + 1;
      current += "\n";
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end === -1 ? sql.length : end + 2;
      current += " ";
      continue;
    }
    if (ch === "'") {
      const escaped = /[eE]$/.test(current) && !/[A-Za-z0-9_]/.test(current.at(-2) ?? "");
      let j = i + 1;
      while (j < sql.length) {
        if (escaped && sql[j] === "\\") { j += 2; continue; }
        if (sql[j] === "'") {
          if (sql[j + 1] === "'") { j += 2; continue; }
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === '"') {
      let j = i + 1;
      while (j < sql.length && !(sql[j] === '"' && sql[j + 1] !== '"')) j += sql[j] === '"' ? 2 : 1;
      current += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (ch === "$") {
      const tag = /^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/.exec(sql.slice(i));
      if (tag && !/[A-Za-z0-9_]/.test(current.at(-1) ?? "")) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        current += sql.slice(i, stop);
        i = stop;
        continue;
      }
    }
    if (ch === ";") {
      if (current.trim()) statements.push(current.trim());
      current = "";
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

function runPrisma(args) {
  const result = spawnSync("pnpm", ["exec", "prisma", ...args], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`prisma ${args.join(" ")} exited with ${result.status}`);
}

export async function databaseIsEmpty(prisma) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT count(*)::int AS n FROM pg_tables WHERE schemaname = 'public'`,
  );
  return Number(rows[0]?.n ?? -1) === 0;
}

/**
 * Isolated environments only: a bootstrap interrupted by an older,
 * non-transactional version can leave tables without the Signa migrations.
 * When BBOS_EMPTY_DATABASE_BOOTSTRAP=true, the database name is the one
 * explicitly declared in BBOS_RESETTABLE_DATABASE_NAME and NO migration from
 * LEGACY_CUTOFF onwards was ever applied, the public schema is recreated so
 * the bootstrap can start over. Production never matches these conditions.
 */
export async function resetIncompleteBootstrap(prisma) {
  const resettable = process.env.BBOS_RESETTABLE_DATABASE_NAME?.trim();
  if (process.env.BBOS_EMPTY_DATABASE_BOOTSTRAP !== "true" || !resettable) return false;
  const [identity] = await prisma.$queryRawUnsafe(`SELECT current_database() AS name`);
  if (identity?.name !== resettable) return false;
  if (await databaseIsEmpty(prisma)) return false;
  const [table] = await prisma.$queryRawUnsafe(`SELECT to_regclass('public."_prisma_migrations"') IS NOT NULL AS present`);
  if (table?.present) {
    const [recent] = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM "_prisma_migrations" WHERE migration_name >= $1 AND finished_at IS NOT NULL`,
      LEGACY_CUTOFF,
    );
    if (Number(recent?.n) > 0) return false;
  }
  console.log(`Bootstrap: inicialização anterior incompleta em ${resettable}; recriando o esquema public.`);
  await prisma.$executeRawUnsafe(`DROP SCHEMA public CASCADE`);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA public`);
  return true;
}

const PRISMA_MIGRATIONS_TABLE = `CREATE TABLE "_prisma_migrations" (
  "id" VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum" VARCHAR(64) NOT NULL,
  "finished_at" TIMESTAMPTZ,
  "migration_name" VARCHAR(255) NOT NULL,
  "logs" TEXT,
  "rolled_back_at" TIMESTAMPTZ,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
)`;

// Narrow, audited exceptions for the EMPTY replay only. The SQL below
// reads catalog metadata or checks absence of source rows; it never changes
// production records or modifies historical migration files.
const KNOWN_LEGACY_OMISSIONS = new Map([
  ["migration=20260807143000_product_catalog_persistence_v1 statement=5 sqlstate=42P07",
    `SELECT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      WHERE i.indrelid='public."ProductVariant"'::regclass
      AND c.relname='ProductVariant_productId_netWeightGrams_key'
      AND i.indisunique AND i.indisvalid AND i.indisready
      AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnatts=2 AND i.indnkeyatts=2
      AND pg_get_indexdef(i.indexrelid,1,true)='"productId"'
      AND pg_get_indexdef(i.indexrelid,2,true)='"netWeightGrams"') AS ok`],
  ["migration=20260807230000_cost_engine_v1_traceability statement=8 sqlstate=42701",
    `SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='CostEvent'
      AND column_name='productVariantId' AND data_type='text'
      AND is_nullable='YES' AND column_default IS NULL) AS ok`],
  ["migration=20260807230000_cost_engine_v1_traceability statement=12 sqlstate=42P07",
    `SELECT EXISTS (SELECT 1 FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      WHERE i.indrelid='public."CostEvent"'::regclass
      AND c.relname='CostEvent_productVariantId_occurredAt_idx'
      AND NOT i.indisunique AND i.indisvalid AND i.indisready
      AND i.indpred IS NULL AND i.indexprs IS NULL AND i.indnatts=2 AND i.indnkeyatts=2
      AND pg_get_indexdef(i.indexrelid,1,true)='"productVariantId"'
      AND pg_get_indexdef(i.indexrelid,2,true)='"occurredAt"') AS ok`],
  ["migration=20260807230000_cost_engine_v1_traceability statement=13 sqlstate=42710",
    `SELECT EXISTS (SELECT 1 FROM pg_constraint c
      JOIN pg_attribute src ON src.attrelid=c.conrelid AND src.attnum=c.conkey[1]
      JOIN pg_attribute dst ON dst.attrelid=c.confrelid AND dst.attnum=c.confkey[1]
      WHERE c.conrelid='public."CostEvent"'::regclass
      AND c.confrelid='public."ProductVariant"'::regclass
      AND c.conname='CostEvent_productVariantId_fkey' AND c.contype='f'
      AND cardinality(c.conkey)=1 AND cardinality(c.confkey)=1
      AND src.attname='productVariantId' AND dst.attname='id'
      AND c.confupdtype='c' AND c.confdeltype='r' AND c.confmatchtype='s'
      AND c.convalidated AND NOT c.condeferrable) AS ok`],
  ["migration=20261012173000_roaster_operational_load_17kg statement=3 sqlstate=55P04",
    `SELECT NOT EXISTS (SELECT 1 FROM public."ProductionOrder")
      AND NOT EXISTS (SELECT 1 FROM public."CostEvent") AS ok`],
]);

export async function bootstrapEmptyDatabase() {
  if (process.env.BBOS_EMPTY_DATABASE_BOOTSTRAP !== "true")
    throw new Error("Recusado: defina BBOS_EMPTY_DATABASE_BOOTSTRAP=true somente em bancos isolados.");
  const prisma = new PrismaClient();
  try {
    if (!(await databaseIsEmpty(prisma)))
      throw new Error("Recusado: o banco já possui tabelas; use o deploy normal de migrações.");
    const legacy = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name < LEGACY_CUTOFF)
      .map((entry) => entry.name)
      .filter((name) => existsSync(join(migrationsDir, name, "migration.sql")))
      .sort();
    // One transaction, one savepoint per statement: tolerated failures roll
    // back only that statement, and an interrupted bootstrap leaves the
    // database EMPTY, so the next start simply retries from scratch.
    const tolerated = await prisma.$transaction(async (tx) => {
      let ignored = 0;
      for (const name of legacy) {
        // The legacy recovery SQL and the runtime storefront payment controller
        // both reference this nullable text link, absent in a fresh historical
        // replay. Supply only the schema prerequisite in the empty bootstrap;
        // never repair or backfill a populated database from this path.
        if (name === "20261015124500_storefront_payment_fiscal_recovery") {
          const [source] = await tx.$queryRawUnsafe(
            `SELECT NOT EXISTS (SELECT 1 FROM "StorefrontOrder") AND NOT EXISTS (SELECT 1 FROM "StorefrontPaymentAttempt") AS empty`,
          );
          if (source?.empty !== true) {
            throw new Error("Bootstrap: storefront recovery requires empty source tables.");
          }
          await tx.$executeRawUnsafe(
            `ALTER TABLE "StorefrontOrder" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT`,
          );
          console.log("Bootstrap: ensured legacy storefront link in empty database only.");
        }
        const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
        const statements = splitSqlStatements(sql);
        for (const [statementIndex, statement] of statements.entries()) {
          // A few legacy files carry their own BEGIN/COMMIT; inside this
          // single transaction they would end it early, so skip them.
          if (/^(BEGIN|COMMIT|START\s+TRANSACTION|END)(\s+(WORK|TRANSACTION))?$/i.test(statement.trim())) continue;
          await tx.$executeRawUnsafe("SAVEPOINT bbos_bootstrap");
          try {
            await tx.$executeRawUnsafe(statement);
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT bbos_bootstrap");
          } catch (error) {
            await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT bbos_bootstrap");
            await tx.$executeRawUnsafe("RELEASE SAVEPOINT bbos_bootstrap");
            // Fail closed inside the transaction rather than recording a new
            // historical failure as applied and relying on CI to catch it later.
            // Never print SQL, parameters or raw error messages.
            const rawCode = error?.meta?.code;
            const sqlState = typeof rawCode === "string" && /^[0-9A-Z]{5}$/.test(rawCode)
              ? rawCode : "UNKNOWN";
            const diagnostic = `migration=${name} statement=${statementIndex + 1} sqlstate=${sqlState}`;
            const known = KNOWN_LEGACY_OMISSIONS.get(diagnostic);
            if (!known) {
              throw new Error(`Bootstrap: unexpected legacy statement failure: ${diagnostic}`);
            }
            // An existing object is not sufficient: prove the expected
            // column, index or foreign key is present and equivalent.
            // The enum error is tolerable ONLY when the historical cost
            // adjustment cannot produce rows in this isolated empty database.
            const [verification] = await tx.$queryRawUnsafe(known);
            if (verification?.ok !== true) {
              throw new Error(`Bootstrap: legacy omission prerequisite failed: ${diagnostic}`);
            }
            ignored += 1;
            console.warn(`Bootstrap: legacy statement skipped ${diagnostic}`);
          }
        }
      }
      // Same record `prisma migrate resolve --applied` writes (checksum is
      // the SHA-256 of migration.sql), so later deploys treat them as applied.
      await tx.$executeRawUnsafe(PRISMA_MIGRATIONS_TABLE);
      for (const name of legacy) {
        const checksum = createHash("sha256").update(readFileSync(join(migrationsDir, name, "migration.sql"))).digest("hex");
        await tx.$executeRawUnsafe(
          `INSERT INTO "_prisma_migrations"(id,checksum,finished_at,migration_name,logs,started_at,applied_steps_count) VALUES ($1,$2,now(),$3,'',now(),0)`,
          randomUUID(), checksum, name,
        );
      }
      return ignored;
    }, { timeout: 15 * 60 * 1000, maxWait: 60 * 1000 });
    console.log(`Bootstrap: ${legacy.length} migrações históricas reaplicadas e registradas (${tolerated} comandos com falha ignorados; revisar diagnósticos acima).`);
  } finally {
    await prisma.$disconnect();
  }
  console.log("Bootstrap: aplicando migrações recentes em modo estrito.");
  runPrisma(["migrate", "deploy", "--schema=prisma/schema.prisma"]);
}
