export type InboundNfeItem = {
  itemNumber: number;
  supplierProductCode: string | null;
  description: string;
  ncm: string | null;
  cest: string | null;
  cfop: string | null;
  commercialUnit: string | null;
  quantity: number;
  unitValue: number;
  totalValue: number;
  freightAmount: number | null;
  discountAmount: number | null;
  taxSnapshot: Record<string, string | number | null>;
  rawSnapshot: Record<string, string | number | null>;
};

export type ParsedInboundNfe = {
  accessKey: string;
  number: string;
  series: string;
  schemaVersion: string | null;
  authorizationProtocol: string;
  authorizationStatus: string;
  authorizationMessage: string | null;
  issueDate: string;
  operationDate: string | null;
  operationNature: string | null;
  issuerTaxId: string;
  issuerName: string;
  recipientTaxId: string;
  productsAmount: number;
  freightAmount: number;
  discountAmount: number;
  totalAmount: number;
  items: InboundNfeItem[];
  payments: Array<{ number: string | null; dueDate: string | null; amount: number }>;
};

const decodeXml = (value: string) => value
  .replace(/&lt;/g, "<")
  .replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&amp;/g, "&")
  .trim();

const escapeTag = (tag: string) => tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function firstBlock(xml: string, tag: string) {
  const safe = escapeTag(tag);
  return xml.match(new RegExp(`<(?:[A-Za-z0-9_]+:)?${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${safe}>`, "i"))?.[1] ?? null;
}

function allBlocks(xml: string, tag: string) {
  const safe = escapeTag(tag);
  return [...xml.matchAll(new RegExp(`<(?:[A-Za-z0-9_]+:)?${safe}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/(?:[A-Za-z0-9_]+:)?${safe}>`, "gi"))].map((match) => match[1] ?? "");
}

function text(xml: string, tag: string) {
  const value = firstBlock(xml, tag);
  return value === null ? null : decodeXml(value.replace(/<[^>]+>/g, ""));
}

function numberValue(xml: string, tag: string) {
  const value = text(xml, tag);
  if (!value) return 0;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function digits(value: string | null) {
  return (value ?? "").replace(/\D/g, "");
}

function attribute(xml: string, tag: string, name: string) {
  const safeTag = escapeTag(tag);
  const safeName = escapeTag(name);
  const opening = xml.match(new RegExp(`<(?:[A-Za-z0-9_]+:)?${safeTag}\\b([^>]*)>`, "i"))?.[1] ?? "";
  return opening.match(new RegExp(`${safeName}=["']([^"']+)["']`, "i"))?.[1] ?? null;
}

function taxSnapshot(det: string) {
  const taxes = firstBlock(det, "imposto") ?? "";
  const fields = ["orig", "CST", "CSOSN", "vBC", "pICMS", "vICMS", "vIPI", "vPIS", "vCOFINS", "CSTIS", "cClassTrib", "vBCIBSCBS", "vIBS", "vCBS"];
  return Object.fromEntries(fields.map((field) => [field, text(taxes, field)]).filter(([, value]) => value !== null));
}

export function parseInboundNfe(xmlInput: string): ParsedInboundNfe {
  const xml = String(xmlInput ?? "").trim().replace(/^\uFEFF/, "");
  if (!xml) throw new Error("O arquivo XML está vazio.");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error("O XML contém uma declaração externa não permitida.");
  if (!/<(?:[A-Za-z0-9_]+:)?nfeProc\b/i.test(xml)) throw new Error("Envie o XML processado e autorizado da NF-e (nfeProc).");

  const infNfe = firstBlock(xml, "infNFe");
  const infProt = firstBlock(xml, "infProt");
  if (!infNfe || !infProt) throw new Error("O XML não contém a NF-e e o protocolo de autorização.");

  const accessKey = digits((attribute(xml, "infNFe", "Id") ?? "").replace(/^NFe/i, ""));
  const protocolKey = digits(text(infProt, "chNFe"));
  if (accessKey.length !== 44 || protocolKey !== accessKey) throw new Error("A chave de acesso da NF-e é inválida ou não corresponde ao protocolo.");

  const authorizationStatus = text(infProt, "cStat") ?? "";
  if (authorizationStatus !== "100") throw new Error(`A NF-e não está autorizada pela SEFAZ (status ${authorizationStatus || "não informado"}).`);

  const ide = firstBlock(infNfe, "ide") ?? "";
  const emit = firstBlock(infNfe, "emit") ?? "";
  const dest = firstBlock(infNfe, "dest") ?? "";
  const total = firstBlock(infNfe, "ICMSTot") ?? "";
  const issuerTaxId = digits(text(emit, "CNPJ") ?? text(emit, "CPF"));
  const recipientTaxId = digits(text(dest, "CNPJ") ?? text(dest, "CPF"));
  if (!issuerTaxId || !recipientTaxId) throw new Error("O XML não identifica corretamente emitente e destinatário.");

  const items = allBlocks(infNfe, "det").map((det, index) => {
    const product = firstBlock(det, "prod") ?? "";
    return {
      itemNumber: Number(attribute(det, "det", "nItem") ?? index + 1),
      supplierProductCode: text(product, "cProd"),
      description: text(product, "xProd") ?? `Item ${index + 1}`,
      ncm: text(product, "NCM"),
      cest: text(product, "CEST"),
      cfop: text(product, "CFOP"),
      commercialUnit: text(product, "uCom"),
      quantity: numberValue(product, "qCom"),
      unitValue: numberValue(product, "vUnCom"),
      totalValue: numberValue(product, "vProd"),
      freightAmount: text(product, "vFrete") === null ? null : numberValue(product, "vFrete"),
      discountAmount: text(product, "vDesc") === null ? null : numberValue(product, "vDesc"),
      taxSnapshot: taxSnapshot(det),
      rawSnapshot: {
        ean: text(product, "cEAN"),
        tributaryUnit: text(product, "uTrib"),
        tributaryQuantity: text(product, "qTrib"),
        tributaryUnitValue: text(product, "vUnTrib"),
        purchaseOrder: text(product, "xPed"),
        purchaseOrderItem: text(product, "nItemPed"),
      },
    };
  });
  if (!items.length) throw new Error("A NF-e não possui itens.");

  const installments = allBlocks(infNfe, "dup").map((dup) => ({
    number: text(dup, "nDup"),
    dueDate: text(dup, "dVenc"),
    amount: numberValue(dup, "vDup"),
  }));
  const payments = installments.length ? installments : allBlocks(infNfe, "detPag").map((payment) => ({
    number: text(payment, "tPag"),
    dueDate: null,
    amount: numberValue(payment, "vPag"),
  }));

  return {
    accessKey,
    number: text(ide, "nNF") ?? "",
    series: text(ide, "serie") ?? "",
    schemaVersion: attribute(xml, "nfeProc", "versao") ?? attribute(xml, "infNFe", "versao"),
    authorizationProtocol: text(infProt, "nProt") ?? "",
    authorizationStatus,
    authorizationMessage: text(infProt, "xMotivo"),
    issueDate: text(ide, "dhEmi") ?? text(ide, "dEmi") ?? "",
    operationDate: text(ide, "dhSaiEnt") ?? text(ide, "dSaiEnt"),
    operationNature: text(ide, "natOp"),
    issuerTaxId,
    issuerName: text(emit, "xNome") ?? "Emitente não informado",
    recipientTaxId,
    productsAmount: numberValue(total, "vProd"),
    freightAmount: numberValue(total, "vFrete"),
    discountAmount: numberValue(total, "vDesc"),
    totalAmount: numberValue(total, "vNF"),
    items,
    payments,
  };
}
