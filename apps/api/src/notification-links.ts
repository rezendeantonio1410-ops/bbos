export function keepCurrentCreditDecisions<T extends { type: string }>(
  notifications: T[],
) {
  const customerIds = new Set<string>();
  return notifications.filter((item) => {
    if (!item.type.startsWith("CREDIT_DECISION:")) return true;
    const customerId = item.type.split(":")[1];
    if (!customerId || customerIds.has(customerId)) return false;
    customerIds.add(customerId);
    return true;
  });
}

export function deliveryExceptionShipmentId(type: string) {
  if (!type.startsWith("ORDER_DELIVERY_EXCEPTION:")) return null;
  return type.split(":")[1] || null;
}

export function keepOpenDeliveryExceptions<T extends { type: string }>(
  notifications: T[],
  openShipmentIds: ReadonlySet<string>,
) {
  return notifications.filter((item) => {
    const shipmentId = deliveryExceptionShipmentId(item.type);
    return shipmentId === null || openShipmentIds.has(shipmentId);
  });
}

export function notificationHref(type: string, purchaseId: string | null) {
  // Avisos da carteira do vendedor abrem a tela "Minha carteira" (início).
  if (type.startsWith("SALES_PORTFOLIO_")) return "/home#carteira";
  if (type.startsWith("SALES_RECEIVABLE_OVERDUE")) {
    const customerId = type.split(":")[1];
    return customerId
      ? `/clientes?cliente=${encodeURIComponent(customerId)}`
      : "/clientes";
  }
  if (type.startsWith("CREDIT")) {
    const customerId = type.split(":")[1];
    const query = type.startsWith("CREDIT_REQUEST") ? "credito" : "cliente";
    return customerId
      ? `/clientes?${query}=${encodeURIComponent(customerId)}`
      : "/clientes";
  }
  if (type.startsWith("GREEN_COFFEE"))
    return purchaseId ? `/compras-cafe-verde/${purchaseId}` : "/recebimento";
  if (type.startsWith("FINANCE")) return "/financeiro";
  if (type.startsWith("FISCAL")) return "/notas-entrada";
  if (type.startsWith("SALES") || type.startsWith("ORDER")) return "/pedidos";
  if (type.startsWith("CUPPING") || type.startsWith("PROFESSIONAL_SAMPLE"))
    return "/laboratorio";
  return "/home";
}
