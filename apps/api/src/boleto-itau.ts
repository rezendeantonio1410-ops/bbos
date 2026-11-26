/**
 * Boleto com Pix (Bolecode) do Itaú, emitido a partir de uma conta a receber.
 *
 * Três modos, escolhidos pela variável ITAU_BOLETO_MODE da API:
 * - "teste" (padrão): nada sai do BBOS. O boleto é montado aqui, com linha
 *   digitável válida no formato FEBRABAN, e marcado "BOLETO DE TESTE". Serve
 *   para treinar o fluxo antes de o Itaú liberar as chaves.
 * - "sandbox": chama o ambiente de testes do Itaú (precisa das chaves de sandbox).
 * - "producao": registra o boleto de verdade. Só ligar depois de validar no
 *   sandbox e com aprovação do responsável.
 *
 * As chaves (client_id, client_secret e certificado) ficam só no ambiente da
 * API no Render, nunca no código nem no banco.
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { request as httpsRequest } from "node:https";

export type BoletoMode = "teste" | "sandbox" | "producao";

export function boletoMode(env: NodeJS.ProcessEnv = process.env): BoletoMode {
  const raw = String(env.ITAU_BOLETO_MODE ?? "").trim().toLowerCase();
  if (raw === "sandbox") return "sandbox";
  if (raw === "producao" || raw === "produção" || raw === "production") return "producao";
  return "teste";
}

/** Conta da Bispo no Itaú (não é segredo: aparece impressa no boleto). */
export function beneficiaryAccount(env: NodeJS.ProcessEnv = process.env) {
  const digits = (value: unknown, size: number) => String(value ?? "").replace(/\D/g, "").padStart(size, "0").slice(-size);
  return {
    agency: digits(env.ITAU_AGENCIA, 4),
    account: digits(env.ITAU_CONTA, 5),
    wallet: digits(env.ITAU_CARTEIRA || "109", 3),
  };
}

// ---------------------------------------------------------------- FEBRABAN

/** Módulo 10 (pesos 2,1 da direita para a esquerda). */
export function mod10(value: string) {
  let sum = 0;
  let weight = 2;
  for (let i = value.length - 1; i >= 0; i--) {
    let product = Number(value[i]) * weight;
    if (product > 9) product = Math.floor(product / 10) + (product % 10);
    sum += product;
    weight = weight === 2 ? 1 : 2;
  }
  const rest = sum % 10;
  return rest === 0 ? 0 : 10 - rest;
}

/** Módulo 11 do dígito geral do código de barras (pesos 2..9). */
export function mod11Barcode(value: string) {
  let sum = 0;
  let weight = 2;
  for (let i = value.length - 1; i >= 0; i--) {
    sum += Number(value[i]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  return dv === 0 || dv === 10 || dv === 11 ? 1 : dv;
}

/**
 * Fator de vencimento: dias desde 07/10/1997. Ao chegar a 9999 (21/02/2025) o
 * fator recomeçou em 1000 em 22/02/2025 (regra FEBRABAN).
 */
export function dueFactor(due: Date) {
  const base = Date.UTC(1997, 9, 7);
  const day = Date.UTC(due.getUTCFullYear(), due.getUTCMonth(), due.getUTCDate());
  const days = Math.round((day - base) / 86_400_000);
  if (days < 1000) throw new Error("Vencimento inválido para boleto.");
  return days <= 9999 ? days : ((days - 10000) % 9000) + 1000;
}

/** Código de barras (44 dígitos) de um boleto Itaú, carteira simples. */
export function itauBarcode(input: { agency: string; account: string; wallet: string; ourNumber: string; due: Date; amountCents: number }) {
  const ourNumber = input.ourNumber.padStart(8, "0").slice(-8);
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents <= 0 || input.amountCents > 9_999_999_999)
    throw new Error("Valor inválido para boleto.");
  const accountDac = mod10(`${input.agency}${input.account}`);
  const ourNumberDac = mod10(`${input.agency}${input.account}${input.wallet}${ourNumber}`);
  const freeField = `${input.wallet}${ourNumber}${ourNumberDac}${input.agency}${input.account}${accountDac}000`;
  const factor = String(dueFactor(input.due)).padStart(4, "0");
  const value = String(input.amountCents).padStart(10, "0");
  const withoutDv = `3419${factor}${value}${freeField}`;
  const dv = mod11Barcode(withoutDv);
  return { barcode: `3419${dv}${factor}${value}${freeField}`, ourNumber, ourNumberDac };
}

/** Linha digitável (47 dígitos) a partir do código de barras. */
export function digitableLine(barcode: string) {
  if (!/^\d{44}$/.test(barcode)) throw new Error("Código de barras inválido.");
  const bankCurrency = barcode.slice(0, 4);
  const free = barcode.slice(19);
  const f1 = `${bankCurrency}${free.slice(0, 5)}`;
  const f2 = free.slice(5, 15);
  const f3 = free.slice(15, 25);
  return `${f1}${mod10(f1)}${f2}${mod10(f2)}${f3}${mod10(f3)}${barcode[4]}${barcode.slice(5, 19)}`;
}

export function formatDigitableLine(line: string) {
  const d = line.replace(/\D/g, "");
  if (d.length !== 47) return line;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
}

/** Vencimento do boleto: hoje ou depois, nunca no passado. */
export function boletoDueDate(requested: string | undefined, receivableDue: Date, today: Date = new Date()) {
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const pick = requested ? new Date(`${requested.slice(0, 10)}T12:00:00Z`) : receivableDue;
  if (Number.isNaN(pick.getTime())) throw new Error("Data de vencimento inválida.");
  const day = Date.UTC(pick.getUTCFullYear(), pick.getUTCMonth(), pick.getUTCDate());
  if (day < start)
    throw new Error("O vencimento desta conta já passou. Escolha uma nova data de vencimento para o boleto.");
  if (day - start > 365 * 86_400_000) throw new Error("Vencimento acima de 1 ano.");
  return new Date(day + 12 * 3_600_000);
}

// ---------------------------------------------------------------- Pagador

export type BoletoPayer = {
  name: string;
  taxId: string;
  address?: string | null;
  addressNumber?: string | null;
  district?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
};

/** O que falta no cadastro do cliente para o banco aceitar o boleto. */
export function payerProblems(payer: BoletoPayer) {
  const problems: string[] = [];
  const doc = payer.taxId.replace(/[^0-9A-Za-z]/g, "");
  if (!payer.name.trim()) problems.push("nome do cliente");
  if (doc.length !== 11 && doc.length !== 14) problems.push("CPF ou CNPJ do cliente");
  if (!payer.address?.trim()) problems.push("endereço");
  if (!payer.city?.trim()) problems.push("cidade");
  if (!/^[A-Z]{2}$/.test(String(payer.state ?? "").trim().toUpperCase())) problems.push("estado (UF)");
  if (String(payer.zipCode ?? "").replace(/\D/g, "").length !== 8) problems.push("CEP");
  return problems;
}

// ---------------------------------------------------------------- Itaú API

/**
 * Corpo do registro na API Itaú "Boleto com Pix" (boletos_pix v2).
 * Campos conferidos com a documentação pública; validar no sandbox antes da produção.
 */
export function itauBoletoPayload(input: {
  mode: Exclude<BoletoMode, "teste">;
  agency: string;
  account: string;
  wallet: string;
  ourNumber: string;
  yourNumber: string;
  issueDate: Date;
  due: Date;
  amountCents: number;
  payer: BoletoPayer;
  pixKey: string;
}) {
  const doc = input.payer.taxId.replace(/[^0-9A-Za-z]/g, "").toUpperCase();
  const company = doc.length === 14;
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const value = String(input.amountCents).padStart(17, "0");
  return {
    etapa_processo_boleto: input.mode === "producao" ? "efetivacao" : "validacao",
    beneficiario: { id_beneficiario: `${input.agency}${input.account}${mod10(`${input.agency}${input.account}`)}`.padStart(12, "0") },
    dado_boleto: {
      tipo_boleto: "a vista",
      codigo_carteira: input.wallet,
      valor_total_titulo: value,
      codigo_especie: "01",
      data_emissao: iso(input.issueDate),
      pagador: {
        pessoa: {
          nome_pessoa: input.payer.name.slice(0, 50),
          tipo_pessoa: company
            ? { codigo_tipo_pessoa: "J", numero_cadastro_nacional_pessoa_juridica: doc }
            : { codigo_tipo_pessoa: "F", numero_cadastro_pessoa_fisica: doc },
        },
        endereco: {
          nome_logradouro: [input.payer.address, input.payer.addressNumber].filter(Boolean).join(", ").slice(0, 45),
          nome_bairro: String(input.payer.district ?? "").slice(0, 15),
          nome_cidade: String(input.payer.city ?? "").slice(0, 20),
          sigla_UF: String(input.payer.state ?? "").toUpperCase(),
          numero_CEP: String(input.payer.zipCode ?? "").replace(/\D/g, ""),
        },
      },
      dados_individuais_boleto: [
        {
          numero_nosso_numero: input.ourNumber.padStart(8, "0"),
          data_vencimento: iso(input.due),
          valor_titulo: value,
          texto_seu_numero: input.yourNumber.slice(0, 10),
        },
      ],
    },
    dados_qrcode: { chave: input.pixKey },
  };
}

/** Lê a resposta do registro: linha digitável, código de barras e Pix copia e cola. */
export function readItauBoleto(payload: any) {
  const data = payload?.data ?? payload;
  const item = data?.dado_boleto?.dados_individuais_boleto?.[0] ?? {};
  const barcode = String(item.codigo_barras ?? "").replace(/\D/g, "");
  const line = String(item.numero_linha_digitavel ?? "").replace(/\D/g, "") || (barcode.length === 44 ? digitableLine(barcode) : "");
  const pix = data?.dados_qrcode?.emv ?? data?.dados_qrcode?.pix_copia_e_cola ?? null;
  if (!barcode && !line) throw new Error("O Itaú não devolveu a linha digitável do boleto.");
  return { barcode, digitableLine: line, pixCopyPaste: pix ? String(pix) : null, externalId: data?.id_boleto_individual ?? item.id_boleto_individual ?? null };
}

const HOSTS = {
  sandbox: { token: "https://devportal.itau.com.br/api/jwt", boletos: "https://devportal.itau.com.br/sandboxapi/pix_recebimentos_conciliacoes/v2/boletos_pix" },
  producao: { token: "https://sts.itau.com.br/api/oauth/token", boletos: "https://secure.api.itau/pix_recebimentos_conciliacoes/v2/boletos_pix" },
} as const;

export class BoletoUnavailable extends Error {}

function credentials(env: NodeJS.ProcessEnv) {
  const clientId = env.ITAU_CLIENT_ID?.trim();
  const clientSecret = env.ITAU_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret)
    throw new BoletoUnavailable("Faltam as chaves do Itaú (ITAU_CLIENT_ID e ITAU_CLIENT_SECRET) no Render.");
  const read = (path?: string) => (path ? readFileSync(path, "utf8") : undefined);
  const cert = read(env.ITAU_CERT_PATH);
  const key = read(env.ITAU_KEY_PATH);
  return { clientId, clientSecret, cert, key };
}

function call(url: string, options: { method: string; headers: Record<string, string>; body: string; cert?: string; key?: string }) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const req = httpsRequest(url, { method: options.method, headers: options.headers, cert: options.cert, key: options.key, timeout: 20000 }, (res) => {
      let text = "";
      res.on("data", (chunk) => (text += chunk));
      res.on("end", () => {
        let body: any = null;
        try { body = text ? JSON.parse(text) : null; } catch { body = text; }
        resolve({ status: res.statusCode ?? 0, body });
      });
    });
    req.on("timeout", () => req.destroy(new Error("O Itaú não respondeu a tempo.")));
    req.on("error", reject);
    req.end(options.body);
  });
}

/** Registra o boleto no Itaú (sandbox ou produção). */
export async function registerItauBoleto(payload: ReturnType<typeof itauBoletoPayload>, mode: Exclude<BoletoMode, "teste">, env: NodeJS.ProcessEnv = process.env) {
  const { clientId, clientSecret, cert, key } = credentials(env);
  if (mode === "producao" && (!cert || !key))
    throw new BoletoUnavailable("Falta o certificado do Itaú (ITAU_CERT_PATH e ITAU_KEY_PATH) no Render.");
  const hosts = HOSTS[mode];
  const token = await call(hosts.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: clientId, client_secret: clientSecret }).toString(),
    cert,
    key,
  });
  const accessToken = token.body?.access_token;
  if (token.status >= 400 || !accessToken) throw new BoletoUnavailable(`Itaú recusou o acesso (${token.status}).`);
  const response = await call(hosts.boletos, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
      "x-itau-apikey": clientId,
      "x-itau-correlationID": randomUUID(),
    },
    body: JSON.stringify(payload),
    cert,
    key,
  });
  if (response.status >= 400) {
    const detail = response.body?.mensagem ?? response.body?.message ?? response.body?.campos?.[0]?.mensagem ?? "";
    throw new BoletoUnavailable(`Itaú recusou o boleto (${response.status})${detail ? `: ${detail}` : ""}.`);
  }
  return readItauBoleto(response.body);
}
