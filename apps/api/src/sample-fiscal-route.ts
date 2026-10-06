export const SAMPLE_CFOP_INTRA = "5911";
export const SAMPLE_CFOP_INTER = "6911";

export type SampleFiscalProfile = {
  state?: string | null;
  sampleNatureOperationId?: string | null;
  sampleNatureOperationName?: string | null;
  sampleValidatedByAccountant?: boolean;
};

export type SampleFiscalRoute = {
  originState: string;
  destinationState: string;
  scope: "INTRA" | "INTER";
  cfop: typeof SAMPLE_CFOP_INTRA | typeof SAMPLE_CFOP_INTER;
  natureOperationId: string;
  natureOperationName: string | null;
};

const normalizeState = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toUpperCase();

const normalizeId = (value: unknown) =>
  String(value ?? "")
    .replace(/\D/g, "")
    .trim();

export function resolveSampleFiscalRoute(
  profile: SampleFiscalProfile,
  destinationState: unknown,
): SampleFiscalRoute {
  const originState = normalizeState(profile.state);
  const resolvedDestination = normalizeState(destinationState);
  const natureOperationId = normalizeId(profile.sampleNatureOperationId);

  if (!originState || !/^[A-Z]{2}$/.test(originState)) {
    throw new Error(
      "Emissão de amostra bloqueada: UF fiscal da empresa não configurada.",
    );
  }
  if (!resolvedDestination || !/^[A-Z]{2}$/.test(resolvedDestination)) {
    throw new Error(
      "Emissão de amostra bloqueada: UF do destinatário não informada.",
    );
  }
  if (!natureOperationId) {
    throw new Error(
      "Emissão de amostra bloqueada: selecione no BBOS a natureza de operação de amostra cadastrada no Bling.",
    );
  }
  if (!profile.sampleValidatedByAccountant) {
    throw new Error(
      "Emissão de amostra bloqueada: a natureza fiscal de amostra ainda não foi validada pela contabilidade.",
    );
  }

  const interstate = originState !== resolvedDestination;
  return {
    originState,
    destinationState: resolvedDestination,
    scope: interstate ? "INTER" : "INTRA",
    cfop: interstate ? SAMPLE_CFOP_INTER : SAMPLE_CFOP_INTRA,
    natureOperationId,
    natureOperationName:
      String(profile.sampleNatureOperationName ?? "").trim() || null,
  };
}

export function blingItemNatureOperationId(item: any) {
  return normalizeId(
    item?.naturezaOperacao?.id ??
      item?.natureza?.id ??
      item?.idNaturezaOperacao,
  );
}

export function blingItemCfop(item: any) {
  return String(
    item?.cfop ??
      item?.codigoFiscal ??
      item?.tributacao?.cfop ??
      item?.tributos?.icms?.cfop ??
      "",
  ).replace(/\D/g, "");
}

export function sampleNatureIsApplied(
  items: unknown,
  natureOperationId: string,
) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every(
      (item) =>
        blingItemNatureOperationId(item) === normalizeId(natureOperationId),
    )
  );
}

export function sampleCfopIsApplied(items: unknown, cfop: string) {
  return (
    Array.isArray(items) &&
    items.length > 0 &&
    items.every((item) => blingItemCfop(item) === String(cfop))
  );
}
