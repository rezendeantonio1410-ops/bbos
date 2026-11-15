export type RankableShippingOption = {
  serviceId: string;
  providerPriceCents: number;
  deliveryDays: number;
};

export type CustomerShippingLabel =
  | "Mais econômico"
  | "Mais rápido"
  | "Mais econômico e rápido";

export function selectCustomerShippingOptions<T extends RankableShippingOption>(
  options: T[],
  freeShipping = false,
): Array<T & { customerLabel: CustomerShippingLabel }> {
  if (!options.length) return [];

  const indexed = options.map((option, index) => ({ option, index }));
  const cheapest = [...indexed].sort(
    (a, b) =>
      a.option.providerPriceCents - b.option.providerPriceCents ||
      a.option.deliveryDays - b.option.deliveryDays ||
      a.index - b.index,
  )[0]!.option;
  const fastest = [...indexed].sort(
    (a, b) =>
      a.option.deliveryDays - b.option.deliveryDays ||
      a.option.providerPriceCents - b.option.providerPriceCents ||
      a.index - b.index,
  )[0]!.option;

  if (freeShipping) {
    return [{ ...cheapest, customerLabel: "Mais econômico" }];
  }

  if (cheapest.serviceId === fastest.serviceId) {
    return [{ ...cheapest, customerLabel: "Mais econômico e rápido" }];
  }

  return [
    { ...cheapest, customerLabel: "Mais econômico" },
    { ...fastest, customerLabel: "Mais rápido" },
  ];
}
