// Synthetic Signa homologation data for an ISOLATED database.
// Mirrors the production structure of the Signa portal (one DISTRIBUTOR
// partner named "Signa Coffee", pricing customer with the same CNPJ, CPF
// fiscal recipient, 12-SKU exclusive catalog) with FICTITIOUS documents,
// e-mails and people. Prices other than the public Reserva table are
// illustrative. It refuses to run when:
//   - BBOS_HOMOLOG_SEED is not "true";
//   - the database contains any company other than the homologation one;
//   - BBOS_HOMOLOG_PASSWORD is missing or weak.
// Logins (one user per partner, enforced by the schema): signa@homolog.test
// (Signa), outro@homolog.test
// (another distributor, for isolation checks), admin@homolog.test (ADMIN).
import { randomBytes, pbkdf2Sync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const CO = "homolog-co";

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const iterations = 210000;
  return `pbkdf2$${iterations}$${salt}$${pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("hex")}`;
}

function checkDigits(base, weights) {
  const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * weights[i], 0);
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}
export function fictitiousCnpj(seed) {
  let base = String(seed).padStart(8, "0").slice(-8) + "0001";
  base += checkDigits(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  base += checkDigits(base, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return base;
}
export function fictitiousCpf(seed) {
  let base = String(seed).padStart(9, "0").slice(-9);
  for (const len of [9, 10]) {
    const sum = base.split("").reduce((acc, d, i) => acc + Number(d) * (len + 1 - i), 0);
    const rest = (sum * 10) % 11;
    base += rest === 10 ? 0 : rest;
  }
  return base;
}

const CATALOG = [
  { line: "GOURMET", lineName: "Gourmet", display: "Clássicos", code: "GOU", items: [[250, "GOU-WLE-250", 19.5], [500, "GOU-ESS-500", 37], [1000, "GOU-ESS-1000", 72]] },
  { line: "CLASSICOS", lineName: "Clássicos", display: "Caramelo", code: "CLA", items: [[250, "CLA-WLC-250", 22], [500, "CLA-CAR-500", 42], [1000, "CLA-CAR-1000", 82]] },
  { line: "EPICOS", lineName: "Épicos", display: "Frutado", code: "EPI", items: [[250, "EPI-WLF-250", 27.5], [500, "EPI-WLF-500", 53], [1000, "EPI-WLF-1000", 104]] },
  { line: "RAROS", lineName: "Raros", display: "Reserva", code: "RAR", items: [[250, "RAR-WLR-250", 38], [500, "RAR-WLR-500", 76.8], [1000, "RAR-WLR-1000", 148]] },
];

export async function seedSignaHomolog(prisma = new PrismaClient()) {
  if (process.env.BBOS_HOMOLOG_SEED !== "true") throw new Error("Recusado: defina BBOS_HOMOLOG_SEED=true somente no banco de homologação.");
  const password = process.env.BBOS_HOMOLOG_PASSWORD ?? "";
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
    throw new Error("Recusado: BBOS_HOMOLOG_PASSWORD precisa de 12+ caracteres com maiúsculas, minúsculas e números.");
  const foreign = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "Company" WHERE id <> $1`, CO);
  if (Number(foreign[0].n) > 0) throw new Error("Recusado: o banco contém empresas reais; a semente só roda em banco isolado.");

  const signaCnpj = fictitiousCnpj(90000001);
  const otherCnpj = fictitiousCnpj(90000002);
  await prisma.$transaction(async (tx) => {
    const exec = (sql, ...params) => tx.$executeRawUnsafe(sql, ...params);
    await exec(`INSERT INTO "Company"(id,name,"tradeName","taxId","updatedAt") VALUES ($1,'Bispo Coffees (Homologação)','Bispo Homologação',$2,NOW()) ON CONFLICT (id) DO NOTHING`, CO, fictitiousCnpj(90000000));
    await exec(`INSERT INTO "SalesChannel"(id,"companyId",code,name,type,active,"updatedAt") VALUES ('homolog-ch-dist',$1,'DISTRIBUIDOR','Distribuidores','DISTRIBUIDOR',true,NOW()) ON CONFLICT (id) DO NOTHING`, CO);
    let sort = 0;
    for (const group of CATALOG) {
      const lineId = `homolog-line-${group.code.toLowerCase()}`;
      const productId = `homolog-prod-${group.code.toLowerCase()}`;
      await exec(`INSERT INTO "ProductLine"(id,"companyId",code,name,slug,description,positioning,"sortOrder","updatedAt") VALUES ($1,$2,$3::"ProductLineCode",$4,$5,'Linha de homologação','Homologação',$6,NOW()) ON CONFLICT (id) DO NOTHING`, lineId, CO, group.line, group.lineName, `homolog-${group.code.toLowerCase()}`, sort);
      await exec(`INSERT INTO "Product"(id,"productLineId",code,name,slug,description,active,"updatedAt") VALUES ($1,$2,$3,$4,$5,'Produto de homologação',true,NOW()) ON CONFLICT (id) DO NOTHING`, productId, lineId, group.code, group.display, `homolog-${group.code.toLowerCase()}`);
      for (const [grams, sku, price] of group.items) {
        const variantId = `homolog-var-${sku.toLowerCase()}`;
        await exec(`INSERT INTO "ProductVariant"(id,"productId",sku,"netWeightGrams","grossWeightGrams","salesUnit",active,"updatedAt") VALUES ($1,$2,$3,$4,$4 + 30,'UN',true,NOW()) ON CONFLICT (id) DO NOTHING`, variantId, productId, sku, grams);
        await exec(`INSERT INTO "ProductPrice"(id,"companyId","productVariantId","salesChannelId",currency,price,active,"updatedAt") VALUES ($1,$2,$3,'homolog-ch-dist','BRL',$4,true,NOW()) ON CONFLICT (id) DO NOTHING`, `homolog-pp-${sku.toLowerCase()}`, CO, variantId, price);
        sort += 1;
      }
    }
    // Complete fictitious fiscal registry so quotes/orders reach the same
    // fiscal-readiness checks as production (no NF-e is ever issued here).
    await exec(`INSERT INTO "Customer"(id,"companyId",name,"legalName","taxId","postalCode",address,"addressNumber",district,city,state,"stateRegistrationType",active,"updatedAt") VALUES
      ('homolog-cust-signa',$1,'Signa Coffee','Signa Coffee Homologação Ltda',$2,'86010010','Rua Fictícia da Homologação','100','Centro','Londrina','PR','EXEMPT',true,NOW()),
      ('homolog-cust-cpf',$1,'Rodrigo Lampert Ribas',NULL,$3,'86010010','Rua Fictícia da Homologação','200','Centro','Londrina','PR','NOT_DECLARED',true,NOW()),
      ('homolog-cust-other',$1,'Distribuidor Teste','Distribuidor Teste Homologação Ltda',$4,'86010010','Rua Fictícia da Homologação','300','Centro','Londrina','PR','EXEMPT',true,NOW())
      ON CONFLICT (id) DO UPDATE SET "legalName"=EXCLUDED."legalName","postalCode"=EXCLUDED."postalCode",address=EXCLUDED.address,"addressNumber"=EXCLUDED."addressNumber",district=EXCLUDED.district,city=EXCLUDED.city,state=EXCLUDED.state,"stateRegistrationType"=EXCLUDED."stateRegistrationType"`, CO, signaCnpj, fictitiousCpf(900000001), otherCnpj);
    await exec(`INSERT INTO "StorefrontPartner"(id,"companyId",name,email,"taxId",active,"portalAccessLevel","updatedAt") VALUES ('homolog-partner-signa',$1,'Signa Coffee','comercial.signa@homolog.test',$2,true,'DISTRIBUTOR',NOW()),('homolog-partner-other',$1,'Distribuidor Teste','outro@homolog.test',$3,true,'DISTRIBUTOR',NOW()) ON CONFLICT (id) DO NOTHING`, CO, signaCnpj, otherCnpj);
    await exec(`INSERT INTO "StorefrontPartnerCustomer"("partnerId","customerId") VALUES ('homolog-partner-signa','homolog-cust-signa'),('homolog-partner-other','homolog-cust-other') ON CONFLICT DO NOTHING`);
    sort = 0;
    for (const group of CATALOG) for (const [, sku, price] of group.items) {
      const variantId = `homolog-var-${sku.toLowerCase()}`;
      await exec(`INSERT INTO "CustomerProductPrice"(id,"companyId","customerId","productVariantId",currency,price,active,"updatedAt") VALUES ($1,$2,'homolog-cust-signa',$3,'BRL',$4,true,NOW()) ON CONFLICT (id) DO NOTHING`, `homolog-cpp-${sku.toLowerCase()}`, CO, variantId, price);
      await exec(`INSERT INTO "CustomerCatalogProduct"(id,"companyId","customerId","productVariantId","displayLineName","displayProductName","sortOrder",active) VALUES ($1,$2,'homolog-cust-signa',$3,$4,$4,$5,true) ON CONFLICT DO NOTHING`, `homolog-ccp-${sku.toLowerCase()}`, CO, variantId, group.display, sort);
      sort += 1;
    }
    const users = [
      ["homolog-user-signa", "Signa Operador", "signa@homolog.test", "PARTNER", "homolog-partner-signa"],
      ["homolog-user-other", "Outro Distribuidor", "outro@homolog.test", "PARTNER", "homolog-partner-other"],
      ["homolog-user-admin", "Administrador Homologação", "admin@homolog.test", "ADMIN", null],
    ];
    for (const [id, name, email, role, partnerId] of users)
      await exec(`INSERT INTO "User"(id,"companyId",name,email,"passwordHash",role,active,"storefrontPartnerId","updatedAt") VALUES ($1,$2,$3,$4,$5,$6::"UserRole",true,$7,NOW()) ON CONFLICT (id) DO UPDATE SET "passwordHash"=EXCLUDED."passwordHash"`, id, CO, name, email, hashPassword(password), role, partnerId);
  });
  console.log("Semente Signa de homologação aplicada (dados fictícios).");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const prisma = new PrismaClient();
  seedSignaHomolog(prisma)
    .catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
