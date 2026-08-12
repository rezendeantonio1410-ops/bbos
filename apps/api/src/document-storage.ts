import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

export type StoredDocument = { storageKey: string; fileName: string; mimeType: string; sizeBytes: number };
export interface DocumentStorageProvider { upload(input: { customerId: string; fileName: string; mimeType: string; buffer: Buffer }): Promise<StoredDocument>; get(storageKey: string): Promise<Buffer>; }

export class LocalDocumentStorageProvider implements DocumentStorageProvider {
  private readonly root = join(process.cwd(), "storage", "customer-documents");
  async upload(input: { customerId: string; fileName: string; mimeType: string; buffer: Buffer }) { const storageKey = `${input.customerId}/${randomUUID()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`; const path = join(this.root, storageKey); await mkdir(dirname(path), { recursive: true }); await writeFile(path, input.buffer, { flag: "wx" }); return { storageKey, fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.buffer.length }; }
  get(storageKey: string) { const path = join(this.root, storageKey); if (!path.startsWith(this.root)) throw new Error("Documento inválido."); return readFile(path); }
}
