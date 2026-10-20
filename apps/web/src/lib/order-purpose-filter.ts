export type SegmentedCustomer = {
  segment?: string | null;
  active?: boolean;
};

const preferredPurposeOrder = [
  "varejo",
  "distribuidor",
  "e-commerce",
  "white label",
];

export function orderPurposeKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

export function listOrderPurposes<T extends SegmentedCustomer>(customers: T[]) {
  const purposes = new Map<string, string>();

  for (const customer of customers) {
    if (customer.active === false) continue;
    const label = String(customer.segment ?? "").trim();
    const key = orderPurposeKey(label);
    if (key && !purposes.has(key)) purposes.set(key, label);
  }

  return [...purposes.entries()]
    .sort(([left], [right]) => {
      const leftIndex = preferredPurposeOrder.indexOf(left);
      const rightIndex = preferredPurposeOrder.indexOf(right);
      if (leftIndex !== -1 || rightIndex !== -1) {
        if (leftIndex === -1) return 1;
        if (rightIndex === -1) return -1;
        return leftIndex - rightIndex;
      }
      return left.localeCompare(right, "pt-BR");
    })
    .map(([, label]) => label);
}

export function filterCustomersByOrderPurpose<T extends SegmentedCustomer>(
  customers: T[],
  purpose: string,
) {
  const selectedPurpose = orderPurposeKey(purpose);
  if (!selectedPurpose) return [];

  return customers.filter(
    (customer) =>
      customer.active !== false &&
      orderPurposeKey(customer.segment) === selectedPurpose,
  );
}
