import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { scheduledJobsDisabled } from "./scheduled-jobs";

test("rotinas automáticas continuam ligadas por padrão e só desligam com true explícito", () => {
  assert.equal(scheduledJobsDisabled({}), false);
  assert.equal(scheduledJobsDisabled({ BBOS_SCHEDULED_JOBS_DISABLED: "false" }), false);
  assert.equal(scheduledJobsDisabled({ BBOS_SCHEDULED_JOBS_DISABLED: "1" }), false);
  assert.equal(scheduledJobsDisabled({ BBOS_SCHEDULED_JOBS_DISABLED: " TRUE " }), true);
});

test("conciliação de pagamentos, rastreio de envios e embalagem automática respeitam a chave", () => {
  for (const file of ["storefront-orders.controller.ts", "melhor-envio-shipment.service.ts", "sales-orders.service.ts"]) {
    const source = readFileSync(join(__dirname, file), "utf8");
    const init = source.slice(source.indexOf("onModuleInit()") >= 0 ? source.indexOf("onModuleInit()") : source.indexOf("async onModuleInit()"));
    const guard = init.indexOf("if (scheduledJobsDisabled()) return;");
    const timer = init.indexOf("setInterval(");
    assert.ok(guard >= 0 && guard < timer, file);
  }
});
