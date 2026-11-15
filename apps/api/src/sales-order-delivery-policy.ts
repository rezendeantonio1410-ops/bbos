export const salesOrderFreightResponsibilities = [
  "BISPO",
  "CUSTOMER",
  "CUSTOMER_CARRIER",
  "PICKUP",
] as const;

export type SalesOrderFreightResponsibility = typeof salesOrderFreightResponsibilities[number];

export function resolveSalesOrderDeliveryPolicy(input: {
  salesChannelType?: string;
  freightResponsibility: string;
  carrierName?: string;
}) {
  const responsibility = input.freightResponsibility as SalesOrderFreightResponsibility;
  const isDistributor = input.salesChannelType === "DISTRIBUIDOR";
  const carrierName = String(input.carrierName ?? "").trim();

  if (!salesOrderFreightResponsibilities.includes(responsibility)) {
    return { valid: false as const, message: "Responsabilidade do frete inválida." };
  }
  if (isDistributor && responsibility === "CUSTOMER_CARRIER" && !carrierName) {
    return { valid: false as const, message: "Informe a transportadora indicada pelo distribuidor." };
  }

  const usesPlatformShipping = isDistributor && responsibility === "CUSTOMER";
  const isCustomerCarrier = isDistributor && responsibility === "CUSTOMER_CARRIER";
  const isPickup = isDistributor && responsibility === "PICKUP";

  return {
    valid: true as const,
    responsibility,
    usesPlatformShipping,
    forceFreightZero: isCustomerCarrier || isPickup,
    carrierName: isPickup ? null : carrierName || null,
    shippingProvider: isCustomerCarrier ? "CUSTOMER_CARRIER" : isPickup ? "PICKUP" : null,
    shippingServiceName: isCustomerCarrier
      ? "Transportadora indicada pelo distribuidor"
      : isPickup
        ? "Retirada na Bispo Coffees"
        : null,
  };
}
