const text = (value: unknown) => String(value ?? "").trim();
const digits = (value: unknown) => text(value).replace(/\D/g, "");

export type MelhorEnvioRecipientInput = {
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  document?: unknown;
  address?: unknown;
  number?: unknown;
  complement?: unknown;
  district?: unknown;
  city?: unknown;
  state?: unknown;
  postalCode?: unknown;
  quotedPostalCode?: unknown;
};

export type MelhorEnvioRecipient = {
  name: string;
  phone: string;
  email: string;
  document: string;
  address: string;
  complement: string;
  number: string;
  district: string;
  city: string;
  state_abbr: string;
  country_id: "BR";
  postal_code: string;
};

const numberPlaceholder = /^(?:s\/?n|sem\s*n[uú]mero|0+)$/i;

export function assessMelhorEnvioRecipient(input: MelhorEnvioRecipientInput): {
  ready: boolean;
  issues: string[];
  recipient: MelhorEnvioRecipient;
} {
  const number = text(input.number);
  const rawAddress = text(input.address);
  const addressWithNumber = rawAddress.match(
    /^(.*?),\s*([0-9][A-Za-z0-9/-]*)$/,
  );
  const issues: string[] = [];

  let address = rawAddress;
  if (addressWithNumber && number) {
    const embeddedStreet = addressWithNumber[1] ?? "";
    const embeddedNumber = addressWithNumber[2] ?? "";
    if (embeddedNumber.toUpperCase() !== number.toUpperCase()) {
      issues.push("número divergente entre logradouro e campo Número");
    } else {
      address = embeddedStreet.trim();
    }
  }

  const recipient: MelhorEnvioRecipient = {
    name: text(input.name),
    phone: digits(input.phone),
    email: text(input.email).toLowerCase(),
    document: digits(input.document),
    address,
    complement: text(input.complement),
    number,
    district: text(input.district),
    city: text(input.city),
    state_abbr: text(input.state).toUpperCase(),
    country_id: "BR",
    postal_code: digits(input.postalCode),
  };

  if (!recipient.name) issues.push("nome do destinatário");
  if (![10, 11].includes(recipient.phone.length)) {
    issues.push("telefone do destinatário com DDD");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient.email)) {
    issues.push("e-mail válido do destinatário");
  }
  if (![11, 14].includes(recipient.document.length)) {
    issues.push("CPF/CNPJ do destinatário");
  }
  if (recipient.address.length < 3) issues.push("logradouro");
  if (!recipient.number || numberPlaceholder.test(recipient.number)) {
    issues.push("número real do endereço (não use S/N)");
  }
  if (!recipient.district) issues.push("bairro");
  if (!recipient.city) issues.push("cidade");
  if (!/^[A-Z]{2}$/.test(recipient.state_abbr)) issues.push("UF");
  if (recipient.postal_code.length !== 8) issues.push("CEP com 8 dígitos");

  const quotedPostalCode = digits(input.quotedPostalCode);
  if (quotedPostalCode && quotedPostalCode !== recipient.postal_code) {
    issues.push("CEP diferente daquele usado na cotação do frete");
  }

  return { ready: issues.length === 0, issues, recipient };
}

export function melhorEnvioRecipientError(issues: string[]) {
  return `Revise o endereço antes de gerar a etiqueta: ${issues.join(", ")}. Nenhuma informação foi enviada ao Melhor Envio.`;
}
