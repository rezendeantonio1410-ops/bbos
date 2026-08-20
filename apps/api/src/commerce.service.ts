import { BadRequestException, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaClient, SalesChannelType, SalesOrderStatus } from "@bbos/database";

@Injectable()
export class CommerceService implements OnModuleDestroy {
  readonly database = new PrismaClient();
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
    return this.database.productPrice.create({ data: { companyId: input.companyId, salesChannelId: input.salesChannelId, productVariantId: input.productVariantId, currency: input.currency.toUpperCase(), price: input.price, validFrom: input.validFrom ? new Date(input.validFrom) : null, validUntil: input.validUntil ? new Date(input.validUntil) : null } });
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
