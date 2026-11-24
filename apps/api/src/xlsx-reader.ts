import { inflateRawSync } from "node:zlib";

/**
 * Minimal, dependency-free .xlsx reader: returns the cell text of one sheet as
 * rows of strings. Supports shared strings, inline strings, numbers and booleans.
 * Formulas return their cached value. Good enough for simple data imports.
 */

const MAX_UNCOMPRESSED = 20 * 1024 * 1024;

function unzip(buffer: Buffer): Map<string, Buffer> {
  const files = new Map<string, Buffer>();
  // End of central directory record (last 22..65557 bytes).
  let eocd = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65_557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("Arquivo .xlsx inválido.");
  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error("Arquivo .xlsx inválido.");
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8");
    offset += 46 + nameLength + extraLength + commentLength;

    if (buffer.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("Arquivo .xlsx inválido.");
    const localName = buffer.readUInt16LE(localOffset + 26);
    const localExtra = buffer.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localName + localExtra;
    const data = buffer.subarray(start, start + compressedSize);
    if (!/\.(xml|rels)$/.test(name)) continue;
    const content =
      method === 0
        ? data
        : method === 8
          ? inflateRawSync(data, { maxOutputLength: MAX_UNCOMPRESSED })
          : null;
    if (!content) continue;
    total += content.length;
    if (total > MAX_UNCOMPRESSED) throw new Error("Planilha grande demais.");
    files.set(name, content);
  }
  return files;
}

const decode = (text: string) =>
  text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, "&");

/** Concatenates every <t> run of a string item (handles rich text). */
const textRuns = (xml: string) =>
  [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => decode(m[1] ?? "")).join("");

function columnIndex(ref: string) {
  const letters = ref.replace(/\d+/g, "");
  let index = 0;
  for (const char of letters) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
}

export function xlsxSheetNames(buffer: Buffer): string[] {
  const workbook = unzip(buffer).get("xl/workbook.xml")?.toString("utf8") ?? "";
  return [...workbook.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => decode(m[1] ?? ""));
}

export function readXlsxRows(buffer: Buffer, sheetName?: string): string[][] {
  const files = unzip(buffer);
  const workbook = files.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rels = files.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  const sheets = [...workbook.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => {
    const attrs = m[1] ?? "";
    return {
      name: decode(/\bname="([^"]*)"/.exec(attrs)?.[1] ?? ""),
      rid: /\br:id="([^"]*)"/.exec(attrs)?.[1] ?? "",
    };
  });
  const sheet = (sheetName && sheets.find((s) => s.name === sheetName)) || sheets[0];
  if (!sheet) throw new Error("A planilha não possui abas.");
  const target =
    new RegExp(`<Relationship\\b[^>]*\\bId="${sheet.rid}"[^>]*\\bTarget="([^"]*)"`).exec(rels)?.[1] ??
    new RegExp(`<Relationship\\b[^>]*\\bTarget="([^"]*)"[^>]*\\bId="${sheet.rid}"`).exec(rels)?.[1] ??
    "worksheets/sheet1.xml";
  const path = target.startsWith("/") ? target.slice(1) : `xl/${target.replace(/^\.\//, "")}`;
  const xml = files.get(path)?.toString("utf8");
  if (!xml) throw new Error("Aba da planilha não encontrada.");

  const shared = [
    ...(files.get("xl/sharedStrings.xml")?.toString("utf8") ?? "").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map((m) => textRuns(m[1] ?? ""));

  const rows: string[][] = [];
  for (const row of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
    const values: string[] = [];
    for (const cell of (row[1] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      const ref = /\br="([A-Z]+\d+)"/.exec(attrs)?.[1];
      const type = /\bt="([^"]*)"/.exec(attrs)?.[1];
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "inlineStr") value = textRuns(body);
      else if (type === "b") value = raw === "1" ? "TRUE" : "FALSE";
      else if (raw !== undefined) value = decode(raw);
      const index = ref ? columnIndex(ref) : values.length;
      values[index] = value.trim();
    }
    rows.push(Array.from(values, (v) => v ?? ""));
  }
  return rows;
}
