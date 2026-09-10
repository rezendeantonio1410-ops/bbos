import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ConfirmationDocumentPdfInput = {
  snapshot: any;
  version: number;
  documentId: string;
  documentHash: string;
  createdAt: Date;
};

export function nextConfirmationVersion(versions: Array<{ version: number }>) {
  return Math.max(0, ...versions.map((item) => item.version)) + 1;
}

const label = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const labels: Record<string, string> = {
    ARABICA: "Arábica",
    ROBUSTA: "Robusta",
    ROBUSTA_CONILON: "Robusta/Conilon",
    CANEPHORA: "Canephora/Robusta/Conilon",
    BAG_30_KG: "Sacas de 30 kg",
    BAG_60_KG: "Sacas de 60 kg",
    BIG_BAG: "Big Bag",
  };
  return labels[String(value)] ?? String(value).replaceAll("_", " ");
};

const value = (item: unknown) =>
  item === null || item === undefined || item === "" ? "—" : String(item);

/** Generates a compact, deterministic PDF from the persisted document snapshot. */
export function buildPurchaseConfirmationPdf(input: ConfirmationDocumentPdfInput) {
  const snapshot = input.snapshot ?? {};
  const coffee = snapshot.coffee ?? {};
  const supplier = snapshot.supplier ?? {};
  const specification = snapshot.specification ?? {};
  const quantity = snapshot.quantity ?? {};
  const commercial = snapshot.commercial ?? {};
  const payment = snapshot.payment ?? {};
  const company = snapshot.company ?? {};
  const lines = [
    "BISPO COFFEES",
    "CONFIRMAÇÃO DE COMPRA DE CAFÉ VERDE",
    `Compra: ${value(snapshot.purchaseNumber)}`,
    `Documento: ${input.documentId} · versão ${input.version}`,
    `Emitido em: ${input.createdAt.toISOString()}`,
    `Código verificável: ${input.documentHash}`,
    "",
    "COMPRADOR",
    value(company.name),
    "",
    "FORNECEDOR",
    `${value(supplier.name)} · ${value(supplier.taxId)}`,
    `Origem: ${value(supplier.farmName)} · ${value(supplier.municipality)} / ${value(supplier.state)} · ${value(supplier.region)}`,
    "",
    "IDENTIFICAÇÃO DO CAFÉ",
    `Safra: ${value(coffee.harvest)}`,
    `Espécie: ${label(coffee.species)} · Cultivar: ${label(coffee.variety)}`,
    `Processo: ${label(coffee.process)} · Região cafeeira: ${value(coffee.originRegion)}`,
    "",
    "ESPECIFICAÇÕES CONTRATADAS",
    `Qualidade: ${value(specification.qualityCategory)}`,
    `Peneira: ${value(specification.contractedScreen)} · Defeitos máximos: ${value(specification.maxDefects)}`,
    `Umidade máxima: ${value(specification.maxMoisturePercent)}% · Pontuação mínima: ${value(specification.minimumScore)}`,
    `Acondicionamento: ${label(quantity.packagingType)} · Volumes: ${value(quantity.volumeQuantity)}`,
    `Peso nominal/volume: ${value(quantity.nominalUnitWeightKg)} kg · Peso total: ${value(quantity.contractedWeightKg)} kg`,
    "",
    "CONDIÇÕES COMERCIAIS",
    `Preço/kg: ${value(commercial.pricePerKg)} · Valor total: ${value(commercial.totalValue)} ${value(commercial.currency)}`,
    `Entrega prevista: ${value(commercial.expectedAt)}`,
    `Pagamento: ${value(payment.type)}`,
    `Contato comercial: ${value(supplier.contactName ?? supplier.contactEmail ?? supplier.contactPhone)}`,
    commercial.broker
      ? `Corretor: ${value(commercial.broker.name)} · Comissão: ${value(commercial.broker.commissionPercent)}%`
      : "Corretor: Não informado",
    `Observações: ${value(specification.additionalSpecification ?? snapshot.commercialNotes)}`,
    "",
    "APROVAÇÃO E CONTROLE",
    `Responsável comprador: ${value(snapshot.approvedByName ?? snapshot.buyerName)}`,
    `Versão dos termos: ${value(snapshot.terms?.version)}`,
    `Versão do documento: ${input.version}`,
    `Identificação: ${input.documentId}`,
    "",
    "PROTEÇÃO DE DADOS PESSOAIS",
    "As partes comprometem-se a tratar os dados pessoais relacionados a este documento em conformidade com a Lei nº 13.709/2018 (LGPD), para finalidades legítimas da relação contratual, cumprimento de obrigações legais e exercício regular de direitos.",
    "",
    "Documento gerado eletronicamente pelo BBOs a partir do snapshot contratual desta versão. Esta versão não é sobrescrita por alterações posteriores.",
  ];
  return simplePdf(lines);
}

function simplePdf(lines: string[]) {
  const escape = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/[()]/g, "\\$&")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  const logoCandidates = [
    join(process.cwd(), "../web/public/brand/logo/bispo-logo-official.jpg"),
    join(process.cwd(), "../../apps/web/public/brand/logo/bispo-logo-official.jpg"),
  ];
  const logoPath = logoCandidates.find((candidate) => existsSync(candidate));
  const logo = logoPath ? readFileSync(logoPath) : null;
  const content = [
    ...(logo ? ["q", "160 0 0 45 50 770 cm", "/Im1 Do", "Q"] : []),
    "BT",
    "/F1 9 Tf",
    logo ? "50 750 Td" : "50 790 Td",
    ...lines.flatMap((line) => [`(${escape(line.slice(0, 110))}) Tj`, "0 -14 Td"]),
    "ET",
  ].join("\n");
  const resources = logo
    ? "/Resources << /Font << /F1 5 0 R >> /XObject << /Im1 6 0 R >> >>"
    : "/Resources << /Font << /F1 5 0 R >> >>";
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>"),
    Buffer.from("<< /Type /Pages /Kids [3 0 R] /Count 1 >>"),
    Buffer.from(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ${resources} /Contents 4 0 R >>`),
    Buffer.from(`<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"),
  ];
  if (logo) {
    objects.push(Buffer.concat([
      Buffer.from(`<< /Type /XObject /Subtype /Image /Width 860 /Height 240 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${logo.length} >>\nstream\n`),
      logo,
      Buffer.from("\nendstream"),
    ]));
  }
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n")];
  const offsets: number[] = [0];
  for (let index = 0; index < objects.length; index += 1) {
    const object = objects[index];
    if (!object) continue;
    offsets[index + 1] = Buffer.concat(chunks).length;
    chunks.push(Buffer.from(`${index + 1} 0 obj\n`), object, Buffer.from("\nendobj\n"));
  }
  const xref = Buffer.concat(chunks).length;
  chunks.push(Buffer.from(`xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`));
  return Buffer.concat(chunks);
}
