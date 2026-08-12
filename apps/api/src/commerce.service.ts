import { BadRequestException, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { CommercialNotificationType, CommercialPromotionStatus, PrismaClient, SalesChannelType, SalesOrderStatus, PriceTableStatus } from "@bbos/database";
import { CommercialPriceService } from "./commercial-price.service";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import { createHash } from "node:crypto";

@Injectable()
export class CommerceService implements OnModuleDestroy {
  readonly database = new PrismaClient();
  constructor(private readonly priceResolver: CommercialPriceService) {}
  onModuleDestroy() { return this.database.$disconnect(); }

  listChannels(companyId?: string) { return this.database.salesChannel.findMany({ where: { companyId, active: true }, orderBy: { name: "asc" } }); }

  async createChannel(input: { companyId: string; code: string; name: string; type: SalesChannelType; country?: string; currency?: string }) {
    return this.database.salesChannel.create({ data: { ...input, code: input.code.toUpperCase() } });
  }

  async listPrices(query: { companyId?: string; salesChannelId?: string; productVariantId?: string }) {
    return this.database.productPrice.findMany({ where: query, include: { salesChannel: true, productVariant: { include: { product: { include: { productLine: true } } } } }, orderBy: { createdAt: "desc" } });
  }

  async createPrice(input: { companyId: string; salesChannelId: string; productVariantId: string; currency: string; price: number; validFrom?: string; validUntil?: string }) {
    if (input.price < 0) throw new BadRequestException("O preço não pode ser negativo.");
    const [channel, variant] = await Promise.all([
      this.database.salesChannel.findFirst({ where: { id: input.salesChannelId, companyId: input.companyId, active: true } }),
      this.database.productVariant.findFirst({ where: { id: input.productVariantId, active: true }, include: { product: { include: { productLine: true } } } }),
    ]);
    if (!channel || !variant || variant.product.productLine.companyId !== input.companyId) throw new BadRequestException("Canal ou SKU inválido para a empresa.");
    const previous = await this.database.productPrice.findFirst({ where: { companyId: input.companyId, salesChannelId: input.salesChannelId, productVariantId: input.productVariantId, currency: input.currency.toUpperCase(), active: true, validUntil: null }, orderBy: { validFrom: "desc" } });
    const created = await this.database.productPrice.create({ data: { companyId: input.companyId, salesChannelId: input.salesChannelId, productVariantId: input.productVariantId, currency: input.currency.toUpperCase(), price: input.price, validFrom: input.validFrom ? new Date(input.validFrom) : new Date(), validUntil: input.validUntil ? new Date(input.validUntil) : null } });
    if (previous && Number(previous.price) !== input.price) await this.notifyPriceChange(input.companyId, variant, previous, created);
    return created;
  }

  async updatePrice(id: string, input: { price: number; validFrom?: string; validUntil?: string; active?: boolean }) {
    if (input.price < 0) throw new BadRequestException("O preço não pode ser negativo.");
    const current = await this.database.productPrice.findUnique({ where: { id }, include: { productVariant: { include: { product: { include: { productLine: true } } } } } });
    if (!current) throw new BadRequestException("Preço não encontrado.");
    const next = await this.database.$transaction(async (tx) => {
      await tx.productPrice.update({ where: { id }, data: { active: false, validUntil: input.validFrom ? new Date(input.validFrom) : new Date() } });
      return tx.productPrice.create({ data: { companyId: current.companyId, salesChannelId: current.salesChannelId, productVariantId: current.productVariantId, currency: current.currency, price: input.price, active: input.active ?? true, validFrom: input.validFrom ? new Date(input.validFrom) : new Date(), validUntil: input.validUntil ? new Date(input.validUntil) : null } });
    });
    await this.notifyPriceChange(current.companyId, current.productVariant, current, next);
    return next;
  }

  async listCatalog(query: { companyId?: string; salesChannelId?: string; currency?: string; salesPersonId?: string; customerId?: string }) {
    const channel = query.salesChannelId ? await this.database.salesChannel.findFirst({ where: { id: query.salesChannelId, active: true } }) : await this.database.salesChannel.findFirst({ where: { companyId: query.companyId, type: "ECOMMERCE", active: true } });
    const now = new Date();
    const variants = await this.database.productVariant.findMany({ where: { active: true, product: { active: true, productLine: { active: true, ...(query.companyId ? { companyId: query.companyId } : {}) } } }, include: { product: { include: { productLine: true } }, channelPrices: { where: { active: true, ...(channel ? { salesChannelId: channel.id } : {}), ...(query.currency ? { currency: query.currency.toUpperCase() } : {}), OR: [{ validFrom: null }, { validFrom: { lte: now } }], AND: [{ OR: [{ validUntil: null }, { validUntil: { gt: now } }] }] }, orderBy: { validFrom: "desc" } }, finishedProducts: { select: { quantityOnHand: true, reservedQuantity: true } } }, orderBy: [{ product: { name: "asc" } }, { netWeightGrams: "asc" }] });
    return Promise.all(variants.map(async (variant) => { const resolved = await this.priceResolver.resolve({ companyId: variant.product.productLine.companyId, productVariantId: variant.id, salesPersonId: query.salesPersonId, customerId: query.customerId, channel: channel?.type, currency: query.currency ?? channel?.currency ?? undefined }); const physical = variant.finishedProducts.reduce((sum, item) => sum + item.quantityOnHand, 0); const reserved = variant.finishedProducts.reduce((sum, item) => sum + item.reservedQuantity, 0); return { id: variant.id, productId: variant.productId, product: variant.product.name, line: variant.product.productLine.name, sku: variant.sku, presentationGrams: variant.netWeightGrams, presentation: variant.netWeightGrams >= 1000 ? `${variant.netWeightGrams / 1000} kg` : `${variant.netWeightGrams} g`, salesUnit: variant.salesUnit, price: resolved.price, previousPrice: null, currency: query.currency ?? channel?.currency ?? "BRL", validFrom: resolved.validFrom, validUntil: resolved.validTo, physical, reserved, available: physical - reserved, channel: channel?.name ?? null, promotion: resolved.promotion, priceTableId: resolved.priceTableId, priceSource: resolved.source, minimumPrice: resolved.minimumPrice }; }));
  }

  async getCatalogItem(id: string, query: { companyId?: string; salesChannelId?: string; currency?: string }) { const item = await this.listCatalog({ ...query }); const found = item.find((variant) => variant.id === id); if (!found) throw new BadRequestException("SKU não encontrado no catálogo autorizado."); return found; }

  private async catalogActor(userId: string) {
    if (!userId) throw new BadRequestException("Sessão autenticada obrigatória.");
    const user = await this.database.user.findUnique({ where: { id: userId }, include: { salesPerson: true } });
    if (!user?.salesPerson || user.salesPerson.status !== "ACTIVE") throw new BadRequestException("Representante autorizado não encontrado.");
    return user;
  }

  private async currentPriceTable(companyId: string, salesPersonId: string, channel?: SalesChannelType) {
    const now = new Date();
    const assignment = await this.database.salesPriceTableAssignment.findFirst({
      where: { companyId, salesPersonId, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }], priceTable: { status: PriceTableStatus.ACTIVE, ...(channel ? { channel } : {}) } },
      include: { priceTable: true }, orderBy: { validFrom: "desc" },
    });
    if (assignment?.priceTable) return assignment.priceTable;
    return this.database.priceTable.findFirst({ where: { companyId, status: PriceTableStatus.ACTIVE, validFrom: { lte: now }, OR: [{ validTo: null }, { validTo: { gt: now } }], ...(channel ? { channel } : {}) }, orderBy: { validFrom: "desc" } });
  }

  async listCatalogDocuments(userId: string) {
    const actor = await this.catalogActor(userId);
    return this.database.commercialCatalogDocument.findMany({ where: { companyId: actor.companyId, userId }, orderBy: { generatedAt: "desc" }, take: 30 });
  }

  async generateCatalogDocument(userId: string, options: { showPrices?: boolean; showAvailability?: boolean; showPresentations?: boolean; showSku?: boolean; includeUnavailable?: boolean }) {
    const actor = await this.catalogActor(userId);
    const table = await this.currentPriceTable(actor.companyId, actor.salesPerson!.id);
    if (!table) throw new BadRequestException("Nenhuma tabela comercial vigente está disponível.");
    const version = table.code || `V${table.updatedAt.toISOString().slice(0, 10).replace(/-/g, ".")}`;
    const catalog = await this.listCatalog({ companyId: actor.companyId, salesPersonId: actor.salesPerson!.id, currency: table.currency });
    const items = catalog.filter((item) => options.includeUnavailable || Number(item.available ?? 0) > 0);
    const baseUrl = process.env.PUBLIC_WEB_URL ?? "http://localhost:3002";
    await this.database.commercialCatalogDocument.updateMany({ where: { companyId: actor.companyId, userId, status: "VIGENTE", priceTableId: { not: table.id } }, data: { status: "DESATUALIZADO", supersededAt: new Date() } });
    const record = await this.database.commercialCatalogDocument.create({ data: { companyId: actor.companyId, userId, priceTableId: table.id, version, validFrom: table.validFrom, validUntil: table.validTo, options: { ...options, snapshot: items } as object, status: "VIGENTE", validationUrl: `${baseUrl}/catalogo/validar/PLACEHOLDER` } });
    const validationUrl = `${baseUrl}/catalogo/validar/${record.id}`;
    const updated = await this.database.commercialCatalogDocument.update({ where: { id: record.id }, data: { validationUrl } });
    return { document: updated, table, items };
  }

  async catalogDocumentPdf(userId: string, id: string) {
    const actor = await this.catalogActor(userId);
    const record = await this.database.commercialCatalogDocument.findFirst({ where: { id, companyId: actor.companyId, userId }, include: { priceTable: true } });
    if (!record) throw new BadRequestException("Catálogo não encontrado.");
    const now = new Date();
    const status = record.revokedAt ? "REVOGADO" : record.supersededAt ? "DESATUALIZADO" : record.validUntil && now > record.validUntil ? "VENCIDO" : "VIGENTE";
    if (status !== record.status) await this.database.commercialCatalogDocument.update({ where: { id }, data: { status } });
    const generated = await this.generateCatalogDocumentPayload(record, actor.companyId, actor.salesPerson!.id);
    const hash = createHash("sha256").update(generated).digest("hex");
    await this.database.commercialCatalogDocument.update({ where: { id }, data: { documentHash: hash } });
    return { buffer: generated, record: { ...record, status, documentHash: hash } };
  }

  async validateCatalogDocument(id: string) {
    const record = await this.database.commercialCatalogDocument.findUnique({ where: { id }, include: { priceTable: true, company: { select: { tradeName: true, name: true } } } });
    if (!record) throw new BadRequestException("Catálogo não encontrado.");
    const now = new Date();
    const status = record.revokedAt ? "REVOGADO" : record.supersededAt ? "DESATUALIZADO" : record.validUntil && now > record.validUntil ? "VENCIDO" : "VIGENTE";
    return { id: record.id, status, version: record.version, table: record.priceTable?.name ?? "Tabela comercial", generatedAt: record.generatedAt, validFrom: record.validFrom, validUntil: record.validUntil, company: record.company.tradeName || record.company.name, validationUrl: record.validationUrl };
  }

  private async generateCatalogDocumentPayload(record: any, companyId: string, salesPersonId: string): Promise<Buffer> {
    const opts = (record.options ?? {}) as { includeUnavailable?: boolean; showPrices?: boolean; showAvailability?: boolean; showPresentations?: boolean; showSku?: boolean; snapshot?: Array<Record<string, unknown>> };
    const catalog = Array.isArray(opts.snapshot) ? opts.snapshot : await this.listCatalog({ companyId, salesPersonId, currency: record.priceTable?.currency });
    const items = catalog.filter((item) => opts.includeUnavailable || Number(item.available ?? 0) > 0);
    const qr = await QRCode.toDataURL(record.validationUrl, { margin: 1, width: 120 });
    const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: "Catálogo Comercial Bispo Coffees", Subject: record.version } });
    const chunks: Buffer[] = []; doc.on("data", (c) => chunks.push(c));
    const done = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));
    doc.fillColor("#4A2A1A").fontSize(22).font("Helvetica-Bold").text("BISPO COFFEES");
    doc.fillColor("#222").fontSize(16).text("Catálogo Comercial");
    doc.fontSize(10).text(`${record.priceTable?.name ?? "Tabela comercial"} · Versão ${record.version}`);
    doc.text(`Gerado em ${record.generatedAt.toLocaleString("pt-BR")} · Válido de ${record.validFrom.toLocaleDateString("pt-BR")} a ${record.validUntil ? record.validUntil.toLocaleDateString("pt-BR") : "prazo não informado"}`);
    doc.image(Buffer.from(qr.split(",")[1] ?? "", "base64"), 430, 42, { width: 90 });
    doc.moveDown(2);
    for (const item of items) {
      if (doc.y > 720) doc.addPage();
      doc.roundedRect(42, doc.y, 510, 58, 6).strokeColor("#E5DDD7").stroke();
      doc.fillColor("#4A2A1A").fontSize(12).font("Helvetica-Bold").text(String(item.product ?? "Produto"), 54, doc.y + 10);
      doc.fillColor("#555").fontSize(9).font("Helvetica").text(`${item.line ?? ""}${opts.showPresentations !== false ? ` · ${item.presentation ?? ""}` : ""}${opts.showSku !== false ? ` · SKU ${item.sku ?? ""}` : ""}`, 54, doc.y + 28);
      if (opts.showPrices !== false) doc.fillColor("#222").fontSize(12).font("Helvetica-Bold").text(item.price != null ? Number(item.price).toLocaleString("pt-BR", { style: "currency", currency: String(item.currency ?? "BRL") }) : "Preço sob consulta", 390, doc.y + 10, { width: 145, align: "right" });
      if (opts.showAvailability !== false) doc.fillColor(Number(item.available ?? 0) > 0 ? "#26734D" : "#A33A32").fontSize(8).font("Helvetica").text(Number(item.available ?? 0) > 0 ? "Disponível" : "Indisponível", 390, doc.y + 30, { width: 145, align: "right" });
      doc.y += 72;
    }
    doc.fontSize(8).fillColor("#666").text(`Tabela Comercial: ${record.priceTable?.name ?? "-"} · Versão: ${record.version} · Gerado em: ${record.generatedAt.toLocaleString("pt-BR")} · Válido até: ${record.validUntil ? record.validUntil.toLocaleDateString("pt-BR") : "não informado"}`, 42, 790, { width: 510 });
    doc.text("Preços sujeitos às condições comerciais e à validade indicada neste documento.", 42, 804, { width: 510 });
    doc.end(); return done;
  }

  listNotifications(query: { companyId?: string; userId?: string; unreadOnly?: string }) { return this.database.commercialNotification.findMany({ where: { companyId: query.companyId, ...(query.userId ? { userId: query.userId } : {}), ...(query.unreadOnly === "true" ? { readAt: null } : {}) }, orderBy: { createdAt: "desc" }, take: 100 }); }
  markNotificationRead(id: string, userId: string) { return this.database.commercialNotification.updateMany({ where: { id, userId, readAt: null }, data: { readAt: new Date() } }); }

  listPriceTables(companyId?: string) { return this.database.priceTable.findMany({ where: { companyId, }, include: { items: { include: { productVariant: { include: { product: true } } } }, assignments: true }, orderBy: { updatedAt: "desc" } }); }
  createPriceTable(input: { companyId: string; name: string; code: string; currency: string; channel: SalesChannelType; salesChannelId?: string; region?: string; territory?: string; validFrom: string; validTo?: string; status?: PriceTableStatus }) { return this.database.priceTable.create({ data: { companyId: input.companyId, name: input.name, code: input.code.toUpperCase(), currency: input.currency.toUpperCase(), channel: input.channel, salesChannelId: input.salesChannelId, region: input.region, territory: input.territory, validFrom: new Date(input.validFrom), validTo: input.validTo ? new Date(input.validTo) : null, status: input.status ?? PriceTableStatus.DRAFT } }); }
  async createPriceTableItem(priceTableId: string, input: { productVariantId: string; price: number; minimumPrice?: number; promotionalPrice?: number; validFrom: string; validTo?: string; active?: boolean }) {
    if (input.price < 0 || (input.minimumPrice != null && input.minimumPrice < 0)) throw new BadRequestException("Preço inválido.");
    const table = await this.database.priceTable.findUnique({ where: { id: priceTableId } });
    if (!table) throw new BadRequestException("Tabela de preço não encontrada.");
    const variant = await this.database.productVariant.findFirst({ where: { id: input.productVariantId, active: true, product: { productLine: { companyId: table.companyId } } }, include: { product: true } });
    if (!variant) throw new BadRequestException("SKU não autorizado para esta tabela.");
    const previous = await this.database.priceTableItem.findFirst({ where: { priceTableId, productVariantId: input.productVariantId, active: true, validTo: null }, orderBy: { validFrom: "desc" } });
    if (previous) await this.database.priceTableItem.update({ where: { id: previous.id }, data: { active: false, validTo: new Date(input.validFrom) } });
    const item = await this.database.priceTableItem.create({ data: { priceTableId, productVariantId: input.productVariantId, price: input.price, minimumPrice: input.minimumPrice, promotionalPrice: input.promotionalPrice, validFrom: new Date(input.validFrom), validTo: input.validTo ? new Date(input.validTo) : null, active: input.active ?? true } });
    if (previous && Number(previous.price) !== input.price) await this.notifyPriceChange(table.companyId, { ...variant, sku: variant.sku, netWeightGrams: variant.netWeightGrams, product: variant.product }, previous, item);
    return item;
  }
  listPromotions(companyId?: string) { return this.database.commercialPromotion.findMany({ where: { companyId }, include: { productVariant: { include: { product: true } }, priceTable: true }, orderBy: { validFrom: "desc" } }); }
  createPromotion(input: { companyId: string; name: string; status?: CommercialPromotionStatus; validFrom: string; validTo: string; productVariantId?: string; priceTableId?: string; customerId?: string; salesPersonId?: string; region?: string; promotionalPrice?: number; discountPercent?: number; description?: string }) { return this.database.commercialPromotion.create({ data: { ...input, status: input.status ?? CommercialPromotionStatus.DRAFT, validFrom: new Date(input.validFrom), validTo: new Date(input.validTo) } }); }

  private async notifyPriceChange(companyId: string, variant: { id: string; sku: string; netWeightGrams: number; product: { name: string } }, previous: { price: any }, next: { price: any; validFrom: Date | null }) {
    const salesPeople = await this.database.salesPerson.findMany({ where: { companyId, status: "ACTIVE" }, select: { userId: true } });
    if (!salesPeople.length) return;
    const presentation = variant.netWeightGrams >= 1000 ? `${variant.netWeightGrams / 1000} kg` : `${variant.netWeightGrams} g`;
    await this.database.commercialNotification.createMany({ data: salesPeople.map(({ userId }) => ({ companyId, userId, type: CommercialNotificationType.PRICE_CHANGED, title: "Preço atualizado", message: `${variant.product.name} ${presentation}: de R$ ${Number(previous.price).toFixed(2)} para R$ ${Number(next.price).toFixed(2)}.`, entityType: "ProductVariant", entityId: variant.id, metadata: { previousPrice: Number(previous.price), newPrice: Number(next.price), validFrom: next.validFrom } })) });
  }

  async dashboard(companyId?: string) {
    const ecommerce = await this.database.salesChannel.findFirst({ where: { companyId, type: "ECOMMERCE", active: true } });
    const orders = await this.database.salesOrder.findMany({ where: { companyId, salesChannelId: ecommerce?.id }, include: { items: { include: { productVariant: { include: { product: true } } } } }, orderBy: { orderedAt: "desc" } });
    const confirmed = orders.filter((order) => order.status !== SalesOrderStatus.DRAFT && order.status !== SalesOrderStatus.CANCELLED);
    const onlineRevenue = confirmed.reduce((sum, order) => sum + Number(order.totalAmount), 0);
    const pendingStatuses: SalesOrderStatus[] = [SalesOrderStatus.CONFIRMED, SalesOrderStatus.RESERVED, SalesOrderStatus.PICKING, SalesOrderStatus.READY_TO_SHIP];
    const pending = orders.filter((order) => pendingStatuses.includes(order.status));
    const now = Date.now();
    const last30 = confirmed.filter((order) => now - order.orderedAt.getTime() <= 30 * 86400000);
    const previous30 = confirmed.filter((order) => { const age = now - order.orderedAt.getTime(); return age > 30 * 86400000 && age <= 60 * 86400000; });
    const products = Object.values(last30.flatMap((order) => order.items).reduce<Record<string, { id: string; product: string; presentation: string; units: number; revenue: number }>>((acc, item) => {
      const key = item.productVariantId;
      const entry = acc[key] ?? (acc[key] = { id: key, product: item.productVariant.product.name, presentation: `${item.productVariant.netWeightGrams >= 1000 ? `${item.productVariant.netWeightGrams / 1000} kg` : `${item.productVariant.netWeightGrams} g`}`, units: 0, revenue: 0 });
      entry.units += item.quantity;
      entry.revenue += Number(item.totalAmount);
      return acc;
    }, {})).sort((a, b) => b.revenue - a.revenue);
    const history = Array.from({ length: 6 }, (_, index) => { const end = now - index * 5 * 86400000; const start = end - 5 * 86400000; const slice = confirmed.filter((order) => order.orderedAt.getTime() >= start && order.orderedAt.getTime() < end); return { label: `${6 - index}`, value: slice.reduce((sum, order) => sum + Number(order.totalAmount), 0) }; }).reverse();
    const attention = [
      { key: "payment", label: "Aguardando pagamento", count: 0, href: "/pedidos" },
      { key: "picking", label: "Aguardando separação", count: orders.filter((order) => order.status === SalesOrderStatus.RESERVED).length, href: "/pedidos" },
      { key: "shipping", label: "Aguardando expedição", count: orders.filter((order) => order.status === SalesOrderStatus.READY_TO_SHIP).length, href: "/pedidos" },
      { key: "late", label: "Pedidos atrasados", count: 0, href: "/pedidos" },
    ];
    return { channel: ecommerce, vendasOnline: onlineRevenue, pedidosOnline: confirmed.length, ticketMedio: confirmed.length ? onlineRevenue / confirmed.length : 0, clientes: new Set(confirmed.map((order) => order.customerId)).size, pedidosPendentes: pending.length, vendasUltimos30Dias: last30.reduce((sum, order) => sum + Number(order.totalAmount), 0), vendasPeriodoAnterior: previous30.reduce((sum, order) => sum + Number(order.totalAmount), 0), pedidosUltimos30Dias: last30.length, ticketMedio30Dias: last30.length ? last30.reduce((sum, order) => sum + Number(order.totalAmount), 0) / last30.length : 0, historicoVendas: history, produtosMaisVendidos: products.slice(0, 5), atencao: attention.filter((item) => item.count > 0), conversao: null, carrinhosAbandonados: null, currency: ecommerce?.currency ?? "BRL", isDemo: !ecommerce };
  }
}
