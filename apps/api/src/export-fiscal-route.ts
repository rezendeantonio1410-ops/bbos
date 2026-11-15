export type ExportFiscalProfile = {
  exportCfop?: string | null;
  exportNatureOperationId?: string | null;
  exportNatureOperationName?: string | null;
  exportDepartureLocation?: string | null;
  exportDepartureState?: string | null;
  exportValidatedByAccountant?: boolean;
};

export type ExportFiscalRoute = {
  cfop: string;
  natureOperationId: string;
  natureOperationName: string | null;
  departureLocation: string;
  departureState: string;
};

const text = (value: unknown) => String(value ?? "").trim();

export function resolveExportFiscalRoute(
  profile: ExportFiscalProfile,
): ExportFiscalRoute {
  const cfop = text(profile.exportCfop).replace(/\D/g, "");
  const natureOperationId = text(profile.exportNatureOperationId).replace(
    /\D/g,
    "",
  );
  const departureLocation = text(profile.exportDepartureLocation);
  const departureState = text(profile.exportDepartureState).toUpperCase();

  if (!/^7\d{3}$/.test(cfop)) {
    throw new Error(
      "Emissão de exportação bloqueada: configure um CFOP de exportação iniciado por 7 e validado pela contabilidade.",
    );
  }
  if (!natureOperationId) {
    throw new Error(
      "Emissão de exportação bloqueada: selecione a natureza de operação de exportação cadastrada no Bling.",
    );
  }
  if (!departureLocation) {
    throw new Error(
      "Emissão de exportação bloqueada: informe o local de embarque.",
    );
  }
  if (!/^[A-Z]{2}$/.test(departureState)) {
    throw new Error(
      "Emissão de exportação bloqueada: informe a UF de embarque.",
    );
  }
  if (!profile.exportValidatedByAccountant) {
    throw new Error(
      "Emissão de exportação bloqueada: a rota fiscal ainda não foi validada pela contabilidade.",
    );
  }

  return {
    cfop,
    natureOperationId,
    natureOperationName: text(profile.exportNatureOperationName) || null,
    departureLocation,
    departureState,
  };
}
