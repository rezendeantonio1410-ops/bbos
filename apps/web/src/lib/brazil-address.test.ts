import assert from "node:assert/strict";
import test from "node:test";
import {
  brazilianCepDigits,
  formatBrazilianCep,
  isCompleteBrazilianCep,
  lookupBrazilianCep,
} from "./brazil-address";

test("normaliza e limita o CEP brasileiro a oito números", () => {
  assert.equal(brazilianCepDigits("81.830-250 extra"), "81830250");
  assert.equal(brazilianCepDigits("123"), "123");
});

test("formata CEP completo e parcial durante a digitação", () => {
  assert.equal(formatBrazilianCep("81830250"), "81830-250");
  assert.equal(formatBrazilianCep("818302"), "81830-2");
});

test("só inicia a consulta automática com oito números", () => {
  assert.equal(isCompleteBrazilianCep("81830-250"), true);
  assert.equal(isCompleteBrazilianCep("81830-25"), false);
});

test("consulta o proxy interno e converte o endereço retornado", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    assert.equal(String(input), "/api/storefront/address/01001000");
    return new Response(
      JSON.stringify({
        postalCode: "01001000",
        street: "Praça da Sé",
        district: "Sé",
        city: "São Paulo",
        state: "SP",
        ibgeCityCode: "3550308",
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  };
  try {
    assert.deepEqual(await lookupBrazilianCep("01001-000"), {
      postalCode: "01001000",
      address: "Praça da Sé",
      district: "Sé",
      city: "São Paulo",
      state: "SP",
      ibgeCityCode: "3550308",
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
