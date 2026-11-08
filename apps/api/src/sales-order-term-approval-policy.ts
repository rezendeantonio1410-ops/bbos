type ApproverIdentity = {
  name?: unknown;
  email?: unknown;
  role?: unknown;
};

const normalize = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");

const configuredEmails = () =>
  new Set(
    String(process.env.BBOS_TERM_CREDIT_APPROVER_EMAILS ?? "")
      .split(",")
      .map((item) => normalize(item))
      .filter(Boolean),
  );

export function isDesignatedTermCreditApprover(actor: ApproverIdentity) {
  if (!["ADMIN", "EXECUTIVE"].includes(String(actor.role ?? ""))) return false;
  const allowedEmails = configuredEmails();
  const email = normalize(actor.email);
  if (allowedEmails.size) return allowedEmails.has(email);
  const firstName = normalize(actor.name).split(/\s+/)[0];
  return firstName === "jose" || firstName === "suzi";
}

export function requiresDelinquencyApproval(input: {
  paymentType?: unknown;
  overdueCount?: unknown;
  overdueAmount?: unknown;
}) {
  const paymentType = String(input.paymentType ?? "").toUpperCase();
  const overdueCount = Math.max(0, Number(input.overdueCount ?? 0));
  const overdueAmount = Math.max(0, Number(input.overdueAmount ?? 0));
  return paymentType === "TERM" && (overdueCount > 0 || overdueAmount > 0.005);
}
