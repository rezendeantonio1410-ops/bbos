import assert from "node:assert/strict";
import test from "node:test";
import { ServiceUnavailableException } from "@nestjs/common";
import {
  normalizeCustomerEmail,
  StorefrontCustomerService,
} from "./storefront-customer.service";
import { CustomerNotificationService } from "./customer-notification.service";

const customerService = () =>
  new StorefrontCustomerService({
    sendCustomerAccessCode: async () => "",
  } as unknown as CustomerNotificationService);

test("normaliza o e-mail usado como identidade do cliente", () => {
  assert.equal(
    normalizeCustomerEmail("  Cliente.Exemplo@Bispo.com.BR "),
    "cliente.exemplo@bispo.com.br",
  );
});

test("lê somente o cookie da sessão da loja", () => {
  const service = customerService();
  assert.equal(
    service.readToken({
      headers: {
        cookie: "bbos_session=administrativo; bispo_customer_session=cliente-seguro; outro=1",
      },
    }),
    "cliente-seguro",
  );
  assert.equal(service.readToken({ headers: { cookie: "bbos_session=administrativo" } }), undefined);
});

test("não inicia autenticação em produção sem segredo configurado", () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousCustomerSecret = process.env.STOREFRONT_CUSTOMER_AUTH_SECRET;
  const previousTrackingSecret = process.env.ORDER_TRACKING_SECRET;
  process.env.NODE_ENV = "production";
  delete process.env.STOREFRONT_CUSTOMER_AUTH_SECRET;
  delete process.env.ORDER_TRACKING_SECRET;
  try {
    const service = customerService();
    assert.throws(
      () => (service as unknown as { authSecret(): string }).authSecret(),
      ServiceUnavailableException,
    );
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousCustomerSecret === undefined)
      delete process.env.STOREFRONT_CUSTOMER_AUTH_SECRET;
    else process.env.STOREFRONT_CUSTOMER_AUTH_SECRET = previousCustomerSecret;
    if (previousTrackingSecret === undefined) delete process.env.ORDER_TRACKING_SECRET;
    else process.env.ORDER_TRACKING_SECRET = previousTrackingSecret;
  }
});

test("a resposta pública não expõe campos internos da conta", () => {
  const service = customerService();
  const account = service.publicAccount({
    id: "customer-1",
    companyId: "company-1",
    email: "cliente@bispo.com.br",
    name: "Cliente Bispo",
    phone: null,
    taxId: "12345678900",
    preferences: { defaultRhythmDays: 30 },
    sensoryProfile: null,
    marketingConsent: true,
  });
  assert.deepEqual(Object.keys(account).sort(), [
    "email",
    "id",
    "marketingConsent",
    "name",
    "phone",
    "preferences",
    "sensoryProfile",
    "taxId",
  ]);
  assert.equal("companyId" in account, false);
});
