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

export function notificationHref(type: string, purchaseId: string | null) {
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
