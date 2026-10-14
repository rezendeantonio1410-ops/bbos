import assert from "node:assert/strict";
import test from "node:test";
import {
  isMercadoLivreAuthorizationFailure,
  MercadoLivreService,
} from "./integrations/mercado-livre/mercado-livre.service";

test("recognizes a Mercado Livre functional-permission rejection", () => {
  assert.equal(
    isMercadoLivreAuthorizationFailure(
      'Mercado Livre API 403: {"code":"PA_UNAUTHORIZED_RESULT_FROM_POLICIES"}',
    ),
    true,
  );
  assert.equal(
    isMercadoLivreAuthorizationFailure("Mercado Livre API 429: quota exceeded"),
    false,
  );
});

test("scheduled synchronization backs off after a failed attempt", async () => {
  const queries: string[] = [];
  const service = new MercadoLivreService();
  Object.defineProperty(service, "database", {
    value: {
      $queryRawUnsafe: async (sql: string) => {
        queries.push(sql);
        return [];
      },
    },
  });

  await service.syncConnectedCompanies();

  assert.equal(
    queries.some((sql) =>
      sql.includes('"updatedAt" < NOW() - INTERVAL \'5 minutes\''),
    ),
    true,
  );
});

test("authorization failure moves the integration to an actionable error", async () => {
  const executions: Array<{ sql: string; params: unknown[] }> = [];
  const service = new MercadoLivreService();
  Object.defineProperty(service, "database", {
    value: {
      $queryRawUnsafe: async (sql: string) =>
        sql.includes('SELECT "providerAccountId"')
          ? [{ providerAccountId: "seller-1" }]
          : [],
      $executeRawUnsafe: async (sql: string, ...params: unknown[]) => {
        executions.push({ sql, params });
        return 1;
      },
      salesChannel: {
        update: async () => null,
      },
    },
  });
  Object.defineProperty(service, "ensureChannel", {
    value: async () => ({ id: "channel-1" }),
  });
  Object.defineProperty(service, "request", {
    value: async () => {
      throw new Error(
        'Mercado Livre API 403: {"code":"PA_UNAUTHORIZED_RESULT_FROM_POLICIES"}',
      );
    },
  });

  await assert.rejects(() => service.syncOrders("company-1"));

  const integrationUpdate = executions.find(({ sql }) =>
    sql.includes("SET status=CASE WHEN $3 THEN 'ERROR'"),
  );
  assert.ok(integrationUpdate);
  assert.equal(integrationUpdate.params[2], true);
});
