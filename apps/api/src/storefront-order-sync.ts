import type { Prisma } from "@bbos/database";

export const BISPO_STORE_PLATFORM_CODE = "BISPO_STORE";

type StorefrontCustomerInput = {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
};

type StorefrontDeliveryInput = {
  postalCode?: string;
  street?: string;
  number?: string;
  complement?: string;
  district?: string;
  city?: string;
  state?: string;
};

type StorefrontShippingInput = {
  shippingCents?: number | null;
  shippingQuoteId?: string | null;
  shippingProvider?: string | null;
  shippingServiceId?: string | null;
  shippingServiceName?: string | null;
  carrierName?: string | null;
  estimatedDeliveryDays?: number | null;
};

const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");

export function storefrontCustomerProfile(
  customer: StorefrontCustomerInput,
  delivery: StorefrontDeliveryInput,
) {
  const taxId = digits(customer.cpf);
  return {
    name: text(customer.name) || "Cliente da loja",
    taxId: taxId || undefined,
    segment: "E-commerce",
    email: text(customer.email) || undefined,
    phone: digits(customer.phone) || undefined,
    postalCode: digits(delivery.postalCode) || undefined,
    address: text(delivery.street) || undefined,
    addressNumber: text(delivery.number) || undefined,
    addressComplement: text(delivery.complement) || undefined,
    district: text(delivery.district) || undefined,
    city: text(delivery.city) || undefined,
    state: text(delivery.state).toUpperCase() || undefined,
    ...(taxId.length === 11 ? { stateRegistrationType: "NON_TAXPAYER" } : {}),
  };
}

export function storefrontShippingSalesOrderData(
  shipping: StorefrontShippingInput,
) {
  const shippingQuoteId = text(shipping.shippingQuoteId) || null;
  return {
    freight: Number(shipping.shippingCents ?? 0) / 100,
    freightResponsibility: shippingQuoteId ? "CUSTOMER" : null,
    shippingQuoteId,
    shippingProvider: text(shipping.shippingProvider) || null,
    shippingServiceId: text(shipping.shippingServiceId) || null,
    shippingServiceName: text(shipping.shippingServiceName) || null,
    carrierName: text(shipping.carrierName) || null,
    estimatedDeliveryDays: Number(shipping.estimatedDeliveryDays ?? 0) || null,
  };
}

export async function ensureBispoStoreSalesChannel(
  transaction: Pick<Prisma.TransactionClient, "salesChannel">,
  companyId: string,
) {
  const connected = await transaction.salesChannel.findFirst({
    where: {
      companyId,
      platformCode: BISPO_STORE_PLATFORM_CODE,
      active: true,
    },
    orderBy: { createdAt: "asc" },
  });
  if (connected) return connected;

  const legacy = await transaction.salesChannel.findUnique({
    where: {
      companyId_code: {
        companyId,
        code: "ECOMMERCE",
      },
    },
  });
  if (legacy) {
    return transaction.salesChannel.update({
      where: { id: legacy.id },
      data: {
        active: true,
        name: "Loja Bispo",
        platformCode: BISPO_STORE_PLATFORM_CODE,
        connectionStatus: "CONNECTED",
        fulfillmentMode: "SELLER",
      },
    });
  }

  return transaction.salesChannel.upsert({
    where: {
      companyId_code: {
        companyId,
        code: "ECOMMERCE",
      },
    },
    update: {
      active: true,
      name: "Loja Bispo",
      platformCode: BISPO_STORE_PLATFORM_CODE,
      connectionStatus: "CONNECTED",
      fulfillmentMode: "SELLER",
    },
    create: {
      companyId,
      code: "ECOMMERCE",
      name: "Loja Bispo",
      type: "ECOMMERCE",
      active: true,
      country: "BR",
      currency: "BRL",
      platformCode: BISPO_STORE_PLATFORM_CODE,
      connectionStatus: "CONNECTED",
      fulfillmentMode: "SELLER",
    },
  });
}
