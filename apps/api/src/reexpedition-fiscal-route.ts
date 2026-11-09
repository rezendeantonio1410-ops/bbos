export const REEXPEDITION_FISCAL_POLICY_VERSION = "2026-11-09" as const;

type Profile = {
  reexpeditionReturnNatureOperationId?: string | null;
  reexpeditionReturnNatureOperationName?: string | null;
  reexpeditionOutboundNatureOperationId?: string | null;
  reexpeditionOutboundNatureOperationName?: string | null;
  reexpeditionValidatedByAccountant?: boolean;
  reexpeditionFiscalPolicyVersion?: string | null;
};

function id(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

export function resolveReexpeditionFiscalRoute(profile: Profile) {
  const returnNatureOperationId = id(
    profile.reexpeditionReturnNatureOperationId,
  );
  const outboundNatureOperationId = id(
    profile.reexpeditionOutboundNatureOperationId,
  );
  if (!returnNatureOperationId || !outboundNatureOperationId) {
    throw new Error(
      "Reexpedição automática bloqueada: selecione no BBOS as naturezas de devolução de venda e de nova saída do Bling.",
    );
  }
  if (
    profile.reexpeditionFiscalPolicyVersion !==
      REEXPEDITION_FISCAL_POLICY_VERSION ||
    !profile.reexpeditionValidatedByAccountant
  ) {
    throw new Error(
      "Reexpedição automática bloqueada: a rota fiscal precisa ser validada uma vez pela contabilidade nas Integrações do BBOS.",
    );
  }
  if (returnNatureOperationId === outboundNatureOperationId) {
    throw new Error(
      "Reexpedição automática bloqueada: devolução (entrada) e nova saída precisam usar naturezas de operação distintas.",
    );
  }
  return {
    returnNatureOperationId,
    returnNatureOperationName:
      String(profile.reexpeditionReturnNatureOperationName ?? "").trim() ||
      null,
    outboundNatureOperationId,
    outboundNatureOperationName:
      String(profile.reexpeditionOutboundNatureOperationName ?? "").trim() ||
      null,
  };
}

export function reexpeditionCfopMatches(
  items: unknown,
  direction: "RETURN" | "OUTBOUND",
) {
  if (!Array.isArray(items) || !items.length) return false;
  const prefixes = direction === "RETURN" ? ["1", "2"] : ["5", "6"];
  return items.every((item: any) => {
    const cfop = String(item?.cfop ?? "").replace(/\D/g, "");
    return cfop.length === 4 && prefixes.includes(cfop.charAt(0));
  });
}
