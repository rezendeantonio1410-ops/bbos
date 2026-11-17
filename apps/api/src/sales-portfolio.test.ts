import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { UserRole } from "@bbos/database";
import {
  assertCustomerInSalesPortfolio,
  customerPortfolioWhere,
  salesOrderPortfolioWhere,
  salesPortfolioPartnerId,
} from "./sales-portfolio";

test("representative without linked portfolio fails closed", () => {
  assert.throws(
    () =>
      salesPortfolioPartnerId({
        companyId: "company-1",
        role: UserRole.SALES,
        storefrontPartnerId: null,
      }),
    ForbiddenException,
  );
});

test("portfolio filters isolate customers and orders by representative", () => {
  assert.deepEqual(customerPortfolioWhere("partner-1"), {
    storefrontPartners: { some: { partnerId: "partner-1" } },
  });
  assert.deepEqual(salesOrderPortfolioWhere("partner-1"), {
    OR: [
      { createdByStorefrontPartnerId: "partner-1" },
      {
        customer: {
          is: {
            storefrontPartners: { some: { partnerId: "partner-1" } },
          },
        },
      },
    ],
  });
});

test("representative cannot open a customer outside their portfolio", async () => {
  const database = {
    customer: { findFirst: async () => null },
  } as any;
  await assert.rejects(
    () =>
      assertCustomerInSalesPortfolio(
        database,
        {
          companyId: "company-1",
          role: UserRole.SALES,
          storefrontPartnerId: "partner-1",
        },
        "customer-from-another-representative",
      ),
    ForbiddenException,
  );
});

test("dashboard and push notifications apply portfolio scope", () => {
  const dashboard = readFileSync(
    join(__dirname, "dashboard.service.ts"),
    "utf8",
  );
  const notifications = readFileSync(
    join(__dirname, "mobile-notification.service.ts"),
    "utf8",
  );
  assert.match(dashboard, /salesOrderPortfolioWhere\(portfolioPartnerId\)/);
  assert.match(dashboard, /customerPortfolioWhere\(portfolioPartnerId\)/);
  assert.match(dashboard, /"createdByStorefrontPartnerId"=\$3/);
  assert.match(notifications, /salesNotificationUserIds/);
  assert.match(notifications, /"StorefrontPartnerCustomer" portfolio/);
});
