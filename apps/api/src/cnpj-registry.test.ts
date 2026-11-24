import assert from "node:assert/strict";
import test from "node:test";
import { CnpjLookupError, CnpjRegistryClient, mapBrasilApiCnpj } from "./cnpj-registry";

const sample = {
  cnpj: "11222333000181",
  razao_social: "CAFETERIA EXEMPLO LTDA",
  nome_fantasia: "CAFE EXEMPLO",
  descricao_situacao_cadastral: "ATIVA",
  data_situacao_cadastral: "2015-03-10",
  cep: "86010010",
  descricao_tipo_de_logradouro: "RUA",
  logradouro: "SERGIPE",
  numero: "100",
  complemento: "SALA 2",
  bairro: "CENTRO",
  municipio: "LONDRINA",
  uf: "PR",
  ddd_telefone_1: "4333334444",
  email: "CONTATO@EXEMPLO.COM.BR",
};

test("mapeia a resposta da BrasilAPI para o cadastro BBOS (sem IE)", () => {
  const record = mapBrasilApiCnpj(sample);
  assert.equal(record.legalName, "CAFETERIA EXEMPLO LTDA");
  assert.equal(record.tradeName, "CAFE EXEMPLO");
  assert.equal(record.active, true);
  assert.equal(record.postalCode, "86010010");
  assert.equal(record.street, "RUA SERGIPE");
  assert.equal(record.city, "LONDRINA");
  assert.equal(record.state, "PR");
  assert.equal(record.email, "contato@exemplo.com.br");
  assert.equal("stateRegistration" in record, false);
});

test("situação diferente de ATIVA é sinalizada", () => {
  assert.equal(mapBrasilApiCnpj({ ...sample, descricao_situacao_cadastral: "BAIXADA" }).active, false);
});

const cnpjWs = {
  razao_social: "CAFETERIA EXEMPLO LTDA",
  estabelecimento: {
    cnpj: "11222333000181", nome_fantasia: "CAFE EXEMPLO", situacao_cadastral: "Ativa",
    tipo_logradouro: "RUA", logradouro: "SERGIPE", numero: "100", bairro: "CENTRO", cep: "86010010",
    cidade: { nome: "Londrina" }, estado: { sigla: "PR" }, ddd1: "43", telefone1: "33334444",
    inscricoes_estaduais: [
      { inscricao_estadual: "9012345678", ativo: true, estado: { sigla: "PR" } },
      { inscricao_estadual: "111222333", ativo: false, estado: { sigla: "SP" } },
    ],
  },
};
type Reply = { status: number; body?: unknown } | "throw";
function fakeFetch(primary: Reply, secondary: Reply) {
  const calls: string[] = [];
  const impl = async (url: string) => {
    calls.push(url.includes("cnpj.ws") ? "secondary" : "primary");
    const reply = url.includes("cnpj.ws") ? secondary : primary;
    if (reply === "throw") throw new Error("offline");
    return { status: reply.status, ok: reply.status < 300, json: async () => reply.body };
  };
  return { calls, impl };
}
const client = (f: ReturnType<typeof fakeFetch>, now = () => Date.now()) =>
  new CnpjRegistryClient(f.impl, 86_400_000, "https://brasilapi.test/cnpj", "https://publica.cnpj.ws/cnpj", 21_000, now);

test("CNPJ inválido não consulta a rede", async () => {
  const f = fakeFetch({ status: 200, body: sample }, { status: 200, body: cnpjWs });
  await assert.rejects(client(f).lookup("11.111.111/1111-11"), (e: unknown) => e instanceof CnpjLookupError && e.code === "INVALID");
  assert.equal(f.calls.length, 0);
});

test("BrasilAPI + IE ativa da UF sugerida pela segunda fonte; cache evita nova consulta", async () => {
  const f = fakeFetch({ status: 200, body: sample }, { status: 200, body: cnpjWs });
  const c = client(f);
  const record = await c.lookup("11.222.333/0001-81");
  assert.equal(record.source, "BRASILAPI_RECEITA_FEDERAL");
  assert.equal(record.suggestedStateRegistration, "9012345678");
  assert.equal(record.stateRegistrations.length, 2);
  await c.lookup("11222333000181");
  assert.deepEqual(f.calls, ["primary", "secondary"]);
});

test("BrasilAPI indisponível ou 404 → usa a segunda fonte; ambas falham → UNAVAILABLE / NOT_FOUND", async () => {
  const fallback = await client(fakeFetch("throw", { status: 200, body: cnpjWs })).lookup("11222333000181");
  assert.equal(fallback.source, "CNPJ_WS_RECEITA_FEDERAL");
  assert.equal(fallback.legalName, "CAFETERIA EXEMPLO LTDA");
  assert.equal(fallback.city, "Londrina");
  assert.equal(fallback.phone, "4333334444");
  await assert.rejects(client(fakeFetch({ status: 404 }, { status: 404 })).lookup("11222333000181"), (e: unknown) => e instanceof CnpjLookupError && e.code === "NOT_FOUND");
  await assert.rejects(client(fakeFetch("throw", "throw")).lookup("11222333000181"), (e: unknown) => e instanceof CnpjLookupError && e.code === "UNAVAILABLE");
});

test("segunda fonte respeita o intervalo mínimo; sem ela, IE fica manual", async () => {
  let clock = 1_000_000;
  const f = fakeFetch({ status: 200, body: sample }, { status: 200, body: cnpjWs });
  const c = client(f, () => clock);
  await c.lookup("11222333000181");
  const second = await c.lookup("11444777000161");
  assert.equal(second.suggestedStateRegistration, null);
  assert.deepEqual(f.calls, ["primary", "secondary", "primary"]);
  clock += 22_000;
  await c.lookup("19131243000197");
  assert.equal(f.calls.at(-1), "secondary");
});

test("traz todos os dados públicos gratuitos: abertura, CNAE, porte, Simples/MEI, capital e sócios", () => {
  const record = mapBrasilApiCnpj({
    ...sample,
    data_inicio_atividade: "2010-05-20",
    natureza_juridica: "Sociedade Empresária Limitada",
    porte: "MICRO EMPRESA",
    capital_social: 50000,
    cnae_fiscal: 5611201,
    cnae_fiscal_descricao: "Restaurantes e similares",
    cnaes_secundarios: [{ codigo: 4721102, descricao: "Padaria e confeitaria" }, { codigo: 0, descricao: "" }],
    opcao_pelo_simples: true,
    data_opcao_pelo_simples: "2010-06-01",
    opcao_pelo_mei: false,
    ddd_telefone_2: "4399998888",
    qsa: [{ nome_socio: "MARIA EXEMPLO", qualificacao_socio: "Sócio-Administrador", data_entrada_sociedade: "2010-05-20" }],
  });
  assert.equal(record.details.openingDate, "2010-05-20");
  assert.equal(record.details.legalNature, "Sociedade Empresária Limitada");
  assert.equal(record.details.companySize, "MICRO EMPRESA");
  assert.equal(record.details.shareCapital, 50000);
  assert.deepEqual(record.details.mainActivity, { code: "5611201", description: "Restaurantes e similares" });
  assert.deepEqual(record.details.secondaryActivities, [{ code: "4721102", description: "Padaria e confeitaria" }]);
  assert.equal(record.details.simplesOptant, true);
  assert.equal(record.details.meiOptant, false);
  assert.equal(record.details.secondaryPhone, "4399998888");
  assert.deepEqual(record.details.partners, [{ name: "MARIA EXEMPLO", role: "Sócio-Administrador", since: "2010-05-20" }]);
});

test("dados ausentes na primeira fonte são completados pela segunda", async () => {
  const ws = {
    ...cnpjWs,
    porte: { descricao: "Micro Empresa" },
    natureza_juridica: { descricao: "Sociedade Empresária Limitada" },
    simples: { simples: "Sim", data_opcao_simples: "2010-06-01", mei: "Não" },
    socios: [{ nome: "MARIA EXEMPLO", qualificacao_socio: { descricao: "Sócio-Administrador" }, data_entrada: "2010-05-20" }],
    estabelecimento: { ...cnpjWs.estabelecimento, atividade_principal: { id: "5611201", descricao: "Restaurantes e similares" } },
  };
  const { impl } = fakeFetch({ status: 200, body: sample }, { status: 200, body: ws });
  const record = await new CnpjRegistryClient(impl as any).lookup("11222333000181");
  assert.equal(record.details.companySize, "Micro Empresa");
  assert.equal(record.details.simplesOptant, true);
  assert.equal(record.details.meiOptant, false);
  assert.equal(record.details.partners[0]?.name, "MARIA EXEMPLO");
  assert.equal(record.details.mainActivity?.code, "5611201");
  assert.equal(record.suggestedStateRegistration, "9012345678");
});
