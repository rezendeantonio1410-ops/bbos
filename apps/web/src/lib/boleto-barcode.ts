/**
 * Barras "Intercalado 2 de 5" (ITF), o padrão FEBRABAN do código de barras
 * do boleto. Devolve as barras pretas como [início, largura] em módulos.
 */
const PATTERNS = ["nnwwn", "wnnnw", "nwnnw", "wwnnn", "nnwnw", "wnwnn", "nwwnn", "nnnww", "wnnwn", "nwnwn"];
const WIDE = 3;

export function itfBars(digits: string) {
  if (!/^\d+$/.test(digits) || digits.length % 2) throw new Error("O código ITF precisa de um número par de dígitos.");
  const bars: Array<[number, number]> = [];
  let x = 0;
  const put = (black: boolean, wide: boolean) => {
    const width = wide ? WIDE : 1;
    if (black) bars.push([x, width]);
    x += width;
  };
  // Início: barra fina, espaço fino, barra fina, espaço fino.
  put(true, false); put(false, false); put(true, false); put(false, false);
  for (let i = 0; i < digits.length; i += 2) {
    const black = PATTERNS[Number(digits[i])]!;
    const white = PATTERNS[Number(digits[i + 1])]!;
    for (let k = 0; k < 5; k++) {
      put(true, black[k] === "w");
      put(false, white[k] === "w");
    }
  }
  // Fim: barra larga, espaço fino, barra fina.
  put(true, true); put(false, false); put(true, false);
  return { bars, width: x };
}

export function formatDigitableLine(line: string) {
  const d = line.replace(/\D/g, "");
  if (d.length !== 47) return line;
  return `${d.slice(0, 5)}.${d.slice(5, 10)} ${d.slice(10, 15)}.${d.slice(15, 21)} ${d.slice(21, 26)}.${d.slice(26, 32)} ${d[32]} ${d.slice(33)}`;
}
