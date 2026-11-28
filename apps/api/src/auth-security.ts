export const MINIMUM_PASSWORD_LENGTH = 8;

/** Senhas que qualquer pessoa tentaria primeiro. */
const OBVIOUS = ["12345678", "123456789", "1234567890", "87654321", "senha123", "password", "abcd1234", "bispo123", "bispocoffee", "cafe1234"];

/**
 * Regra simples para a equipe: 8 caracteres, com letras e números.
 * A força vem também do bloqueio de 15 min após 5 tentativas erradas (LoginAttemptLimiter).
 */
export function passwordPolicyError(password: string): string | null {
  if (password.length < MINIMUM_PASSWORD_LENGTH) {
    return `A senha precisa ter pelo menos ${MINIMUM_PASSWORD_LENGTH} caracteres.`;
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    return "A senha precisa ter letras e pelo menos um número.";
  }
  const lower = password.toLowerCase();
  if (/^(.)\1+$/.test(password) || OBVIOUS.some((weak) => lower.startsWith(weak) && lower.length <= weak.length + 2)) {
    return "Essa senha é fácil demais de adivinhar. Tente juntar uma palavra e um número, por exemplo um nome e um ano.";
  }
  return null;
}

type LoginAttempt = {
  failures: number;
  windowStartedAt: number;
  blockedUntil: number | null;
};

export class LoginAttemptLimiter {
  private readonly attempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly maxAttempts = 5,
    private readonly windowMs = 15 * 60 * 1000,
    private readonly blockMs = 15 * 60 * 1000,
    private readonly now: () => number = Date.now,
  ) {}

  retryAfterSeconds(key: string): number {
    const attempt = this.attempts.get(key);
    if (!attempt) return 0;
    const currentTime = this.now();
    if (attempt.blockedUntil && attempt.blockedUntil > currentTime) {
      return Math.max(1, Math.ceil((attempt.blockedUntil - currentTime) / 1000));
    }
    if (currentTime - attempt.windowStartedAt >= this.windowMs) this.attempts.delete(key);
    return 0;
  }

  recordFailure(key: string) {
    const currentTime = this.now();
    const current = this.attempts.get(key);
    const attempt = !current || currentTime - current.windowStartedAt >= this.windowMs
      ? { failures: 0, windowStartedAt: currentTime, blockedUntil: null }
      : current;
    attempt.failures += 1;
    if (attempt.failures >= this.maxAttempts) attempt.blockedUntil = currentTime + this.blockMs;
    this.attempts.set(key, attempt);
  }

  clear(key: string) {
    this.attempts.delete(key);
  }
}
