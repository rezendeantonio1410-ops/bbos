import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { prisma } from "@bbos/database";
import { randomUUID } from "node:crypto";
import {
  DIRECT_SHIPMENT_DOCUMENT_LABEL,
  assertDirectShipmentFile,
  directShipmentDocumentKind,
  directShipmentEmailTarget,
  directShipmentTrackingUrl,
  safeFileName,
  validateDirectShipment,
  type DirectShipmentDocumentKind,
  type DirectShipmentInput,
} from "./direct-shipment";

type Upload = { originalname: string; mimetype: string; size?: number; buffer: Buffer };

const COLUMNS = `s.id,s."salesOrderId",s."partnerId",s."recipientName",s."recipientTaxId",s."recipientEmail",
  s."recipientPhone",s."postalCode",s.street,s.number,s.complement,s.district,s.city,s.state,s.carrier,
  s."trackingCode",s."trackingUrl",s.volumes,s."weightKg"::float AS "weightKg",s."notifyEndCustomer",s.status,
  s."postedAt",s."postedByName",s."notifiedAt",s."notifiedTo",s."updatedByName",s."createdAt",s."updatedAt"`;

function badRequest(error: unknown): never {
  throw new BadRequestException(error instanceof Error ? error.message : "Dados inválidos.");
}

@Injectable()
export class DirectShipmentService {
  private readonly database = prisma;

  async list(companyId: string) {
    return this.database.$queryRawUnsafe<any[]>(
      `SELECT s."salesOrderId",s.status,s.city,s.state,p.name AS "partnerName",
              EXISTS (SELECT 1 FROM "PartnerDirectShipmentDocument" d WHERE d."shipmentId"=s.id AND d.kind='LABEL') AS "hasLabel"
         FROM "PartnerDirectShipment" s JOIN "StorefrontPartner" p ON p.id=s."partnerId"
        WHERE s."companyId"=$1
        ORDER BY s."updatedAt" DESC LIMIT 500`,
      companyId,
    );
  }

  async get(companyId: string, salesOrderId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT ${COLUMNS},p.name AS "partnerName"
         FROM "PartnerDirectShipment" s JOIN "StorefrontPartner" p ON p.id=s."partnerId"
        WHERE s."companyId"=$1 AND s."salesOrderId"=$2 LIMIT 1`,
      companyId,
      salesOrderId,
    );
    const shipment = rows[0];
    if (!shipment) return null;
    const documents = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,kind,"fileName","mimeType","sizeBytes","uploadedByName","createdAt"
         FROM "PartnerDirectShipmentDocument" WHERE "shipmentId"=$1 ORDER BY "createdAt" ASC`,
      shipment.id,
    );
    return {
      ...shipment,
      publicTrackingUrl: directShipmentTrackingUrl(shipment.trackingCode, shipment.trackingUrl),
      documents: documents.map((doc) => ({
        ...doc,
        label: DIRECT_SHIPMENT_DOCUMENT_LABEL[doc.kind as DirectShipmentDocumentKind] ?? doc.kind,
      })),
    };
  }

  /** Cria ou atualiza a ficha. Depois de postado, nada muda. */
  async save(companyId: string, salesOrderId: string, partnerId: string, input: DirectShipmentInput, actorName: string) {
    let data;
    try {
      data = validateDirectShipment(input);
    } catch (error) {
      badRequest(error);
    }
    const [order] = await this.database.$queryRawUnsafe<any[]>(
      `SELECT status::text AS status FROM "SalesOrder" WHERE id=$1 AND "companyId"=$2`,
      salesOrderId,
      companyId,
    );
    if (!order) throw new NotFoundException("Pedido não encontrado.");
    if (order.status === "CANCELLED") throw new BadRequestException("Pedido cancelado não recebe envio direto.");
    const existing = await this.get(companyId, salesOrderId);
    if (existing?.status === "POSTED") {
      throw new ConflictException("A Bispo já postou este envio; a ficha não pode mais ser alterada.");
    }
    const values = [
      data.recipientName, data.recipientTaxId, data.recipientEmail, data.recipientPhone, data.postalCode,
      data.street, data.number, data.complement, data.district, data.city, data.state, data.carrier,
      data.trackingCode, data.trackingUrl, data.volumes, data.weightKg, data.notifyEndCustomer, actorName.slice(0, 120),
    ];
    await this.database.$executeRawUnsafe(
      `INSERT INTO "PartnerDirectShipment"
        (id,"companyId","salesOrderId","partnerId","recipientName","recipientTaxId","recipientEmail","recipientPhone",
         "postalCode",street,number,complement,district,city,state,carrier,"trackingCode","trackingUrl",volumes,
         "weightKg","notifyEndCustomer","updatedByName")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20::numeric,$21,$22)
       ON CONFLICT ("salesOrderId") DO UPDATE SET
         "recipientName"=EXCLUDED."recipientName","recipientTaxId"=EXCLUDED."recipientTaxId",
         "recipientEmail"=EXCLUDED."recipientEmail","recipientPhone"=EXCLUDED."recipientPhone",
         "postalCode"=EXCLUDED."postalCode",street=EXCLUDED.street,number=EXCLUDED.number,
         complement=EXCLUDED.complement,district=EXCLUDED.district,city=EXCLUDED.city,state=EXCLUDED.state,
         carrier=EXCLUDED.carrier,"trackingCode"=EXCLUDED."trackingCode","trackingUrl"=EXCLUDED."trackingUrl",
         volumes=EXCLUDED.volumes,"weightKg"=EXCLUDED."weightKg","notifyEndCustomer"=EXCLUDED."notifyEndCustomer",
         "updatedByName"=EXCLUDED."updatedByName","updatedAt"=NOW()
       WHERE "PartnerDirectShipment".status='AWAITING_POST' AND "PartnerDirectShipment"."partnerId"=EXCLUDED."partnerId"`,
      randomUUID(), companyId, salesOrderId, partnerId, ...values,
    );
    return this.get(companyId, salesOrderId);
  }

  private async requireShipment(companyId: string, salesOrderId: string) {
    const shipment = await this.get(companyId, salesOrderId);
    if (!shipment) throw new NotFoundException("Este pedido não tem envio direto.");
    return shipment;
  }

  async addDocument(companyId: string, salesOrderId: string, kindValue: unknown, file: Upload | undefined, actorName: string) {
    const shipment = await this.requireShipment(companyId, salesOrderId);
    if (shipment.status === "POSTED") throw new ConflictException("Envio já postado; não é possível anexar documentos.");
    let kind: DirectShipmentDocumentKind;
    try {
      kind = directShipmentDocumentKind(kindValue);
      assertDirectShipmentFile(file);
    } catch (error) {
      badRequest(error);
    }
    if (shipment.documents.length >= 10) throw new BadRequestException("Limite de 10 documentos por envio.");
    await this.database.$executeRawUnsafe(
      `INSERT INTO "PartnerDirectShipmentDocument" (id,"shipmentId",kind,"fileName","mimeType","sizeBytes",data,"uploadedByName")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      randomUUID(), shipment.id, kind, safeFileName(file!.originalname), file!.mimetype, file!.buffer.length,
      file!.buffer, actorName.slice(0, 120),
    );
    return this.get(companyId, salesOrderId);
  }

  async removeDocument(companyId: string, salesOrderId: string, documentId: string) {
    const shipment = await this.requireShipment(companyId, salesOrderId);
    if (shipment.status === "POSTED") throw new ConflictException("Envio já postado; os documentos ficam guardados.");
    await this.database.$executeRawUnsafe(
      `DELETE FROM "PartnerDirectShipmentDocument" WHERE id=$1 AND "shipmentId"=$2`,
      documentId,
      shipment.id,
    );
    return this.get(companyId, salesOrderId);
  }

  async document(companyId: string, salesOrderId: string, documentId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT d."fileName",d."mimeType",d.data
         FROM "PartnerDirectShipmentDocument" d
         JOIN "PartnerDirectShipment" s ON s.id=d."shipmentId"
        WHERE d.id=$1 AND s."companyId"=$2 AND s."salesOrderId"=$3 LIMIT 1`,
      documentId,
      companyId,
      salesOrderId,
    );
    if (!rows[0]) throw new NotFoundException("Documento não encontrado.");
    // O driver devolve bytea como Uint8Array; o Express só envia binário cru a partir de Buffer.
    return { fileName: String(rows[0].fileName), mimeType: String(rows[0].mimeType), data: Buffer.from(rows[0].data) };
  }

  /** A Bispo marca como postado; se o parceiro pediu, entra na fila o aviso em nome dele. */
  async markPosted(companyId: string, salesOrderId: string, actor: { name: string; email?: string | null }) {
    const shipment = await this.requireShipment(companyId, salesOrderId);
    if (shipment.status === "POSTED") return { ...shipment, alreadyPosted: true };
    if (!shipment.documents.some((doc: any) => doc.kind === "LABEL")) {
      throw new BadRequestException("Falta a etiqueta. Peça ao parceiro para anexar antes de postar.");
    }
    const updated = await this.database.$queryRawUnsafe<any[]>(
      `UPDATE "PartnerDirectShipment" SET status='POSTED',"postedAt"=NOW(),"postedByName"=$3,"updatedAt"=NOW()
        WHERE "companyId"=$1 AND "salesOrderId"=$2 AND status='AWAITING_POST'
        RETURNING "postedAt"`,
      companyId,
      salesOrderId,
      actor.name.slice(0, 120),
    );
    if (!updated[0]) return { ...(await this.get(companyId, salesOrderId)), alreadyPosted: true };
    let notice: { to: string; test: boolean } | null = null;
    if (shipment.notifyEndCustomer) {
      notice = directShipmentEmailTarget({
        live: process.env.DIRECT_SHIPMENT_EMAIL_LIVE?.trim() === "true",
        recipientEmail: shipment.recipientEmail,
        testEmail: actor.email?.trim() || null,
      });
      if (notice) {
        const payload = {
          partnerName: shipment.partnerName,
          recipientName: shipment.recipientName,
          carrier: shipment.carrier,
          trackingCode: shipment.trackingCode,
          trackingUrl: shipment.publicTrackingUrl,
          volumes: shipment.volumes,
          city: shipment.city,
          state: shipment.state,
          postedAt: new Date(updated[0].postedAt).toISOString(),
          test: notice.test,
          intendedRecipient: shipment.recipientEmail,
          partnerReplyTo: await this.partnerEmail(shipment.partnerId),
        };
        await this.database.$executeRawUnsafe(
          `INSERT INTO "CustomerNotificationOutbox"
            (id,"companyId","salesOrderId",channel,destination,template,payload,status,attempts,"idempotencyKey","createdAt","updatedAt")
           VALUES ($1,$2,$3,'EMAIL',$4,'PARTNER_DIRECT_SHIPMENT',$5::jsonb,'PENDING',0,$6,NOW(),NOW())
           ON CONFLICT ("idempotencyKey") DO NOTHING`,
          randomUUID(), companyId, salesOrderId, notice.to, JSON.stringify(payload), `direct-shipment:${shipment.id}:posted`,
        );
        await this.database.$executeRawUnsafe(
          `UPDATE "PartnerDirectShipment" SET "notifiedAt"=NOW(),"notifiedTo"=$2 WHERE id=$1`,
          shipment.id,
          notice.test ? `${notice.to} (teste)` : notice.to,
        );
      }
    }
    return { ...(await this.get(companyId, salesOrderId)), notice };
  }

  private async partnerEmail(partnerId: string) {
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT email FROM "StorefrontPartner" WHERE id=$1 LIMIT 1`,
      partnerId,
    );
    return String(rows[0]?.email ?? "").trim() || null;
  }
}
