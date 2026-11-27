// Tipos e textos do envio direto, usados no portal do parceiro e no BBOS.
export type DirectShipmentDocument = {
  id: string;
  kind: "LABEL" | "INVOICE" | "PACKING_LIST" | "OTHER";
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedByName?: string | null;
  createdAt: string;
};

export type DirectShipment = {
  id: string;
  salesOrderId: string;
  partnerName: string;
  recipientName: string;
  recipientTaxId?: string | null;
  recipientEmail?: string | null;
  recipientPhone?: string | null;
  postalCode: string;
  street: string;
  number: string;
  complement?: string | null;
  district?: string | null;
  city: string;
  state: string;
  carrier: string;
  trackingCode: string;
  trackingUrl?: string | null;
  publicTrackingUrl: string;
  volumes?: number | null;
  weightKg?: number | null;
  notifyEndCustomer: boolean;
  status: "AWAITING_POST" | "POSTED";
  postedAt?: string | null;
  postedByName?: string | null;
  notifiedAt?: string | null;
  notifiedTo?: string | null;
  updatedByName?: string | null;
  documents: DirectShipmentDocument[];
};

export type DirectShipmentSummary = {
  salesOrderId: string;
  status: "AWAITING_POST" | "POSTED";
  city: string;
  state: string;
  partnerName: string;
  hasLabel: boolean;
};

export const DOCUMENT_KIND_OPTIONS: Array<{ value: DirectShipmentDocument["kind"]; label: string }> = [
  { value: "LABEL", label: "Etiqueta" },
  { value: "INVOICE", label: "Nota fiscal" },
  { value: "PACKING_LIST", label: "Romaneio" },
  { value: "OTHER", label: "Outro" },
];

export function formatPostalCode(value: string) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 8);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

export function directShipmentAddress(shipment: Pick<DirectShipment, "street" | "number" | "complement" | "district" | "city" | "state" | "postalCode">) {
  return [
    `${shipment.street}, ${shipment.number}${shipment.complement ? ` · ${shipment.complement}` : ""}`,
    [shipment.district, `${shipment.city}/${shipment.state}`].filter(Boolean).join(" · "),
    `CEP ${formatPostalCode(shipment.postalCode)}`,
  ];
}

/** Situação em uma frase, para o selo e o cartão. */
export function directShipmentStatus(shipment: Pick<DirectShipment, "status" | "postedAt"> & { documents?: DirectShipmentDocument[]; hasLabel?: boolean }) {
  if (shipment.status === "POSTED") {
    const date = shipment.postedAt ? new Date(shipment.postedAt).toLocaleDateString("pt-BR") : "";
    return { tone: "done" as const, label: date ? `Postado em ${date}` : "Postado" };
  }
  const hasLabel = shipment.hasLabel ?? Boolean(shipment.documents?.some((doc) => doc.kind === "LABEL"));
  return hasLabel
    ? { tone: "ready" as const, label: "Pronto para postar" }
    : { tone: "waiting" as const, label: "Falta a etiqueta" };
}

export function fileSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
