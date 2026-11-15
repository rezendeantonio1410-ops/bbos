import { buildCustomerOrderPdf } from "./customer-order-pdf";

const filePart = (value: unknown, fallback: string) =>
  String(value ?? "")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80) || fallback;

export const pdfContentDisposition = (fileName: string) => {
  const ascii = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/["\\]/g, "-");
  const encoded = encodeURIComponent(fileName).replace(
    /['()]/g,
    (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
};

export function buildSalesOrderPdfDownload(order: any, approval?: any) {
  const customer = order.customer ?? {};
  const orderCode = String(order.orderNumber ?? order.code ?? order.id);
  const subtotal = Number(
    order.subtotal ??
      order.items.reduce(
        (sum: number, item: any) => sum + Number(item.totalAmount ?? 0),
        0,
      ),
  );
  const body = buildCustomerOrderPdf({
    orderCode,
    orderStatus: order.status,
    orderType: order.orderType,
    orderDate: order.orderedAt ?? order.orderDate,
    expectedDeliveryDate: order.expectedDeliveryDate,
    customerName: customer.name,
    customerLegalName: customer.legalName,
    customerTradeName: customer.tradeName,
    customerSegment: customer.segment,
    customerTaxId: customer.taxId,
    customerEmail: customer.email,
    customerPhone: customer.phone,
    customerAddress: [
      customer.address,
      customer.addressNumber,
      customer.addressComplement,
      customer.district,
      customer.city && customer.state
        ? `${customer.city}/${customer.state}`
        : customer.city || customer.state,
      customer.postalCode ? `CEP ${customer.postalCode}` : null,
    ]
      .filter(Boolean)
      .join(" - "),
    subtotalCents: Math.round(subtotal * 100),
    discountCents: Math.round(Number(order.discount ?? 0) * 100),
    freightCents: Math.round(Number(order.freight ?? 0) * 100),
    totalCents: Math.round(Number(order.totalAmount ?? subtotal) * 100),
    paymentType: order.paymentType,
    paymentTerms: order.paymentTermsSnapshot,
    freightResponsibility: order.freightResponsibility,
    shippingServiceName: order.shippingServiceName,
    carrierName: order.carrierName,
    customerReference: order.customerReference,
    notes: order.notes,
    acceptedByName: approval?.acceptedByName,
    acceptedAt: approval?.acceptedAt,
    items: order.items.map((item: any) => ({
      name: item.productName,
      sku: item.sku,
      quantity: Number(item.quantity ?? 0),
      unitPriceCents: Math.round(Number(item.unitPrice ?? 0) * 100),
      totalCents: Math.round(Number(item.totalAmount ?? 0) * 100),
    })),
  });
  return {
    body,
    fileName: `Pedido - ${filePart(customer.name, "Cliente")} - ${filePart(orderCode, "Pedido")}.pdf`,
  };
}
