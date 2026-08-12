import { CommercialPromotionStatus, PrismaClient, PriceTableStatus, SalesChannelType, SalesPersonStatus, SalesPersonType, SalesTargetType, UserRole } from "@prisma/client";
const prisma = new PrismaClient();
const taxId = "12.345.678/0001-90";

export async function seedCommercial(client: PrismaClient) {
  const company = await client.company.findUniqueOrThrow({ where: { taxId } });
  const names = ["Marina Costa", "Rafael Lima", "Camila Souza", "Diego Martins", "Luciana Alves"];
  const people = [];
  for (const [index, name] of names.entries()) {
    const email = `comercial.demo.${index + 1}@bispocoffees.local`;
    const user = await client.user.upsert({ where: { email }, update: { companyId: company.id, name, active: true }, create: { companyId: company.id, name, email, passwordHash: "development-only", role: UserRole.SALES } });
    people.push(await client.salesPerson.upsert({ where: { userId: user.id }, update: { companyId: company.id, status: SalesPersonStatus.ACTIVE, territory: ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Exportação"][index], region: ["MG", "SP", "PR", "BA", "EU"][index] }, create: { companyId: company.id, userId: user.id, type: index === 0 ? SalesPersonType.SALES_MANAGER : SalesPersonType.SALES_REPRESENTATIVE, territory: ["Sul", "Sudeste", "Centro-Oeste", "Nordeste", "Exportação"][index], region: ["MG", "SP", "PR", "BA", "EU"][index], discountLimit: index === 0 ? 10 : 5 } }));
  }
  const customerNames = ["Café Aurora", "Casa do Grão", "Bistrô Central", "Mercado Verde", "Coffee House"].map((name) => `${name} Demo`);
  const customers = [];
  for (const [index, name] of customerNames.entries()) customers.push(await client.customer.upsert({ where: { id: `commercial-demo-customer-${index + 1}` }, update: { companyId: company.id, name }, create: { id: `commercial-demo-customer-${index + 1}`, companyId: company.id, name, segment: index % 2 ? "Cafeteria" : "B2B" } }));
  for (const [index, customer] of customers.entries()) await client.customerPortfolioAssignment.upsert({ where: { id: `commercial-demo-assignment-${index + 1}` }, update: { salesPersonId: people[index].id, validTo: null }, create: { id: `commercial-demo-assignment-${index + 1}`, companyId: company.id, customerId: customer.id, salesPersonId: people[index].id, territory: people[index].territory } });
  const period = new Date().toISOString().slice(0, 7);
  for (const person of people) await client.salesTarget.upsert({ where: { salesPersonId_period_targetType: { salesPersonId: person.id, period, targetType: SalesTargetType.REVENUE } }, update: { targetValue: 85000 }, create: { companyId: company.id, salesPersonId: person.id, period, targetType: SalesTargetType.REVENUE, targetValue: 85000 } });
  const ecommerce = await client.salesChannel.findFirst({ where: { companyId: company.id, type: SalesChannelType.ECOMMERCE, active: true } });
  const variants = await client.productVariant.findMany({ where: { active: true }, orderBy: { sku: "asc" }, take: 4 });
  const table = await client.priceTable.upsert({ where: { companyId_code: { companyId: company.id, code: "REP-SUL-DEMO" } }, update: { status: PriceTableStatus.ACTIVE, validFrom: new Date(), currency: "BRL", channel: SalesChannelType.B2B, salesChannelId: ecommerce?.id }, create: { id: "commercial-demo-price-table", companyId: company.id, name: "Representantes Sul · DEMO", code: "REP-SUL-DEMO", currency: "BRL", channel: SalesChannelType.B2B, salesChannelId: ecommerce?.id, region: "MG", territory: "Sul", validFrom: new Date(), status: PriceTableStatus.ACTIVE } });
  const demoPrices = [44.5, 82, 46.9, 89.9];
  for (const [index, variant] of variants.entries()) await client.priceTableItem.upsert({ where: { id: `commercial-demo-price-${variant.id}` }, update: { price: demoPrices[index] ?? 44.5, active: true, validTo: null }, create: { id: `commercial-demo-price-${variant.id}`, priceTableId: table.id, productVariantId: variant.id, price: demoPrices[index] ?? 44.5, minimumPrice: (demoPrices[index] ?? 44.5) * 0.95, validFrom: new Date(), active: true } });
  await client.salesPriceTableAssignment.upsert({ where: { id: "commercial-demo-price-assignment" }, update: { priceTableId: table.id, salesPersonId: people[1].id, customerId: customers[0].id, validTo: null }, create: { id: "commercial-demo-price-assignment", companyId: company.id, priceTableId: table.id, salesPersonId: people[1].id, customerId: customers[0].id, region: "MG", territory: "Sul", channel: SalesChannelType.B2B, validFrom: new Date() } });
  if (variants[0]) await client.commercialPromotion.upsert({ where: { id: "commercial-demo-promotion" }, update: { status: CommercialPromotionStatus.ACTIVE, validTo: new Date(Date.now() + 30 * 86400000), promotionalPrice: 39.9 }, create: { id: "commercial-demo-promotion", companyId: company.id, name: "Boas-vindas representante · DEMO", status: CommercialPromotionStatus.ACTIVE, validFrom: new Date(), validTo: new Date(Date.now() + 30 * 86400000), productVariantId: variants[0].id, priceTableId: table.id, promotionalPrice: 39.9, description: "Promoção demonstrativa." } });
  const plan = await client.commissionPlan.upsert({ where: { id: "commercial-demo-plan" }, update: { status: "ACTIVE" }, create: { id: "commercial-demo-plan", companyId: company.id, name: "Plano Comercial Demo", description: "Dados demonstrativos para validação do painel." } });
  for (const person of people) await client.commissionRule.create({ data: { commissionPlanId: plan.id, salesPersonId: person.id, percentage: 3, priority: 1 } }).catch(() => undefined);
  return { company, people, customers };
}
if (require.main === module) seedCommercial(prisma).then((result) => console.log(`Comercial demo persistido: ${result.people.length} representantes · ${result.customers.length} clientes`)).finally(() => prisma.$disconnect());
