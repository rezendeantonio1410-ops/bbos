import assert from "node:assert/strict";
import test from "node:test";
import {
  filterCustomersByOrderPurpose,
  listOrderPurposes,
} from "./order-purpose-filter";

const customers = [
  { id: "retail-1", segment: "Varejo", active: true },
  { id: "retail-2", segment: " varejo ", active: true },
  { id: "distributor-1", segment: "Distribuidor", active: true },
  { id: "ecommerce-1", segment: "E-commerce", active: true },
  { id: "white-label-1", segment: "White Label", active: true },
  { id: "inactive-retail", segment: "Varejo", active: false },
  { id: "without-purpose", segment: null, active: true },
];

test("lista as finalidades reais sem duplicar variações de caixa ou espaço", () => {
  assert.deepEqual(listOrderPurposes(customers), [
    "Varejo",
    "Distribuidor",
    "E-commerce",
    "White Label",
  ]);
});

test("mostra somente clientes ativos da finalidade selecionada", () => {
  assert.deepEqual(
    filterCustomersByOrderPurpose(customers, "VAREJO").map(
      (customer) => customer.id,
    ),
    ["retail-1", "retail-2"],
  );
  assert.deepEqual(filterCustomersByOrderPurpose(customers, ""), []);
});
