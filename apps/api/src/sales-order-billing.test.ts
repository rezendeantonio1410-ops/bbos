import assert from "node:assert/strict";
import { test } from "node:test";
import { pixCrc16, buildBillingPix } from "./billing-pix";
import { loadSalesOrderBillingData } from "./sales-order-billing-data";
import { buildSalesOrderBillingPdf } from "./sales-order-billing-pdf";
export const billingFixture = () => {
  const order: any = {
    id: "order1",
    companyId: "company1",
    customerId: "customer1",
    code: "B-2026-000123",
    paymentType: "TERM",
    orderType: "COMMERCIAL",
    status: "INVOICED",
    currency: "BRL",
    totalAmount: 208,
    paymentTermsSnapshot: "14 dias",
    customer: {
      name: "Cliente de demonstração",
      legalName: "Cliente de demonstração Ltda",
      taxId: "00.000.000/0001-00",
      address: "Rua de Demonstração",
      addressNumber: "100",
      city: "Londrina",
      state: "PR",
    },
    items: [
      {
        productName: "Essencial 500 g",
        quantity: 4,
        unitPrice: 52,
        totalAmount: 208,
      },
    ],
  };
  const receivable: any = {
    id: "title1",
    amount: 208,
    openAmount: 158,
    status: "PARTIALLY_PAID",
    dueDate: "2026-11-18T15:00:00Z",
  };
  const invoice: any = {
    id: "nf1",
    number: "123",
    series: "1",
    accessKey: "4".repeat(44),
    status: "AUTHORIZED",
  };
  let reads = 0;
  const database: any = {
    accountsReceivable: {
      findFirst: async (args: any) => {
        assert.deepEqual(args.where, {
          companyId: "company1",
          salesOrderId: "order1",
          customerId: "customer1",
        });
        reads++;
        return receivable;
      },
    },
    company: {
      findUnique: async () => ({
        name: "Bispo Coffees Ltda",
        taxId: "13.008.726/0001-12",
      }),
    },
    $queryRawUnsafe: async (query: string, ...args: any[]) => {
      assert.match(query, /"companyId"=\$1/);
      assert.deepEqual(args, ["company1", "order1"]);
      return [invoice];
    },
  };
  return { order, receivable, invoice, database, reads: () => reads };
};
test("CRC matches the BCB published BR Code example", () => {
  const sample =
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***6304";
  assert.equal(pixCrc16(sample), "1D3D");
});
test("Pix uses outstanding amount, CNPJ and stable reference", () => {
  const pix = buildBillingPix(15800, "title1");
  assert.match(pix, /011413008726000112/);
  assert.match(pix, /5406158.00/);
  assert.equal(pix.slice(-4), pixCrc16(pix.slice(0, -4)));
  assert.equal(pix, buildBillingPix(15800, "title1"));
  assert.notEqual(pix, buildBillingPix(15800, "title2"));
  for (const value of [0, -1, NaN, 1.5, 100000000000])
    assert.throws(() => buildBillingPix(value, "title1"));
});
test("partial balance and authorized fiscal data are loaded without writes", async () => {
  const f = billingFixture();
  const data = await loadSalesOrderBillingData(f.database, f.order, "company1");
  assert.equal(data.openCents, 15800);
  assert.equal(data.amountCents, 20800);
  assert.equal(f.receivable.status, "PARTIALLY_PAID");
  const pdf = buildSalesOrderBillingPdf(data).toString("latin1");
  assert.ok(pdf.startsWith("%PDF-1.4"));
  assert.match(pdf, /158,00/);
  assert.match(pdf, /123/);
  assert.match(pdf, /4{44}/);
  assert.match(pdf, /PIX COPIA E COLA/);
  assert.ok(pdf.includes(data.pix));
});
test("cross-company and cash orders are rejected before data reads", async () => {
  const f = billingFixture();
  await assert.rejects(loadSalesOrderBillingData(f.database, f.order, "other"));
  assert.equal(f.reads(), 0);
  f.order.paymentType = "CASH";
  await assert.rejects(
    loadSalesOrderBillingData(f.database, f.order, "company1"),
  );
  assert.equal(f.reads(), 0);
});
test("settled, cancelled, missing due date, foreign currency and invalid fiscal data cannot create a charge", async () => {
  for (const status of ["PAID", "CANCELLED"]) {
    const f = billingFixture();
    f.receivable.status = status;
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  for (const balance of [0, -1, 999]) {
    const f = billingFixture();
    f.receivable.openAmount = balance;
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  {
    const f = billingFixture();
    f.receivable.dueDate = null;
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  {
    const f = billingFixture();
    f.order.currency = "USD";
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  for (const status of ["CANCELLED", "ERROR", "PENDING"]) {
    const f = billingFixture();
    f.invoice.status = status;
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  {
    const f = billingFixture();
    f.invoice.accessKey = null;
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
  {
    const f = billingFixture();
    f.database.company.findUnique = async () => ({ taxId: "00000000000000" });
    await assert.rejects(
      loadSalesOrderBillingData(f.database, f.order, "company1"),
    );
  }
});
test("all purchased items are kept across continuation pages", async () => {
  const f = billingFixture();
  f.order.items = Array.from({ length: 35 }, (_, i) => ({
    ...f.order.items[0],
    productName: `Produto ${i + 1}`,
  }));
  const data = await loadSalesOrderBillingData(f.database, f.order, "company1");
  const pdf = buildSalesOrderBillingPdf(data).toString("latin1");
  assert.match(pdf, /\/Count 4/);
  assert.match(pdf, /Produto 35/);
});
