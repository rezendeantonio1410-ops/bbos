import assert from "node:assert/strict";
import test from "node:test";
import {
  releaseSalesStock,
  reserveSalesStock,
  salesInventoryBalance,
  shipSalesStock,
} from "../dist/sales-inventory-engine.js";

test("reserva reduz disponível sem alterar físico", () => {
  assert.deepEqual(reserveSalesStock(salesInventoryBalance(200, 0), 50), {
    physicalStock: 200,
    reservedStock: 50,
    availableStock: 150,
  });
});

test("cancelamento libera reserva sem alterar físico", () => {
  assert.deepEqual(releaseSalesStock(salesInventoryBalance(200, 50), 50), {
    physicalStock: 200,
    reservedStock: 0,
    availableStock: 200,
  });
});

test("expedição consome reserva e estoque físico", () => {
  assert.deepEqual(shipSalesStock(salesInventoryBalance(200, 50), 50), {
    physicalStock: 150,
    reservedStock: 0,
    availableStock: 150,
  });
});

test("estoque insuficiente e estoque negativo são rejeitados", () => {
  assert.throws(() => reserveSalesStock(salesInventoryBalance(20, 5), 16));
  assert.throws(() => salesInventoryBalance(10, 11));
});

test("SKUs mantêm saldos independentes", () => {
  const grams500 = reserveSalesStock(salesInventoryBalance(100, 0), 20);
  const oneKg = reserveSalesStock(salesInventoryBalance(40, 0), 5);
  assert.equal(grams500.availableStock, 80);
  assert.equal(oneKg.availableStock, 35);
});
