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
// statement, tolerating "already exists"-style failures exactly like `psql`
// without ON_ERROR_STOP, and are then recorded with `prisma migrate resolve
// --applied`. Every later migration (all Signa migrations) is applied STRICTLY
// by `prisma migrate deploy`, the same command production uses.
import { spawnSync } from "node:child_process";
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
    let tolerated = 0;
    for (const name of legacy) {
      const sql = readFileSync(join(migrationsDir, name, "migration.sql"), "utf8");
      for (const statement of splitSqlStatements(sql)) {
        try {
          await prisma.$executeRawUnsafe(statement);
        } catch {
          tolerated += 1;
        }
      }
    }
    console.log(`Bootstrap: ${legacy.length} migrações históricas reaplicadas (${tolerated} comandos já existentes ignorados).`);
    await prisma.$disconnect();
    for (const name of legacy) runPrisma(["migrate", "resolve", "--applied", name, "--schema=prisma/schema.prisma"]);
    console.log("Bootstrap: histórico registrado; aplicando migrações recentes em modo estrito.");
  } finally {
    await prisma.$disconnect();
  }
  runPrisma(["migrate", "deploy", "--schema=prisma/schema.prisma"]);
}
