import { BadRequestException } from "@nestjs/common";

export const CUSTOMER_VISIT_PURPOSES = [
  "PROSPECCAO",
  "APRESENTACAO",
  "NEGOCIACAO",
  "POS_VENDA",
  "COBRANCA",
  "OUTRO",
] as const;

export const CUSTOMER_VISIT_OUTCOMES = [
  "ACOMPANHAR",
  "INTERESSADO",
  "COTACAO",
  "PEDIDO",
  "SEM_INTERESSE",
  "NAO_LOCALIZADO",
] as const;

const requiredText = (value: unknown, message: string, maxLength: number) => {
  const text = String(value ?? "").trim();
  if (!text) throw new BadRequestException(message);
  if (text.length > maxLength) {
    throw new BadRequestException(
      `O campo deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return text;
};

const optionalText = (value: unknown, maxLength: number) => {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (text.length > maxLength) {
    throw new BadRequestException(
      `O campo deve ter no máximo ${maxLength} caracteres.`,
    );
  }
  return text;
};

export function parseCustomerVisitInput(body: Record<string, unknown>) {
  const visitAt = new Date(String(body.visitAt ?? ""));
  if (Number.isNaN(visitAt.getTime())) {
    throw new BadRequestException("Informe a data e a hora da visita.");
  }

  const purpose = requiredText(
    body.purpose,
    "Informe o objetivo da visita.",
    80,
  );
  if (!(CUSTOMER_VISIT_PURPOSES as readonly string[]).includes(purpose)) {
    throw new BadRequestException("Objetivo da visita inválido.");
  }

  const outcome = requiredText(
    body.outcome,
    "Informe o resultado da visita.",
    80,
  );
  if (!(CUSTOMER_VISIT_OUTCOMES as readonly string[]).includes(outcome)) {
    throw new BadRequestException("Resultado da visita inválido.");
  }

  const facts = requiredText(
    body.facts,
    "Registre o que aconteceu na visita.",
    4_000,
  );
  if (facts.length < 3) {
    throw new BadRequestException(
      "Registre os principais fatos que aconteceram na visita.",
    );
  }

  const nextAction = optionalText(body.nextAction, 1_000);
  const nextActionAtRaw = String(body.nextActionAt ?? "").trim();
  const nextActionAt = nextActionAtRaw ? new Date(nextActionAtRaw) : null;
  if (nextActionAt && Number.isNaN(nextActionAt.getTime())) {
    throw new BadRequestException("A data da próxima ação é inválida.");
  }
  if (nextActionAt && !nextAction) {
    throw new BadRequestException(
      "Descreva a próxima ação antes de definir a data.",
    );
  }

  return {
    visitAt,
    contactName: optionalText(body.contactName, 200),
    purpose,
    outcome,
    facts,
    nextAction,
    nextActionAt,
  };
}
