import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import {
  renderCustomerAccessEmail,
  renderCustomerEmail,
} from "./customer-email-template";

type TransactionalEmail = {
  destination: string;
  subject: string;
  html: string;
};

@Injectable()
export class CustomerNotificationService {
  private readonly database = new PrismaClient();

  private emailAssets() {
    return {
      logoUrl:
        process.env.STOREFRONT_EMAIL_LOGO_URL?.trim() ||
        "https://app.bispocoffees.com.br/brand/logo/bispo-logo-official-transparent.png",
      sealUrl:
        process.env.STOREFRONT_EMAIL_SEAL_URL?.trim() ||
        "https://app.bispocoffees.com.br/brand/logo/bispo-seal-black.jpg",
    };
  }

  private async sendTransactionalEmail(
    message: TransactionalEmail,
    options: { allowUnconfigured?: boolean } = {},
  ) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.STOREFRONT_FROM_EMAIL?.trim();
    const replyTo = process.env.STOREFRONT_REPLY_TO?.trim();
    if (!apiKey || !from) {
      if (options.allowUnconfigured) return "";
      throw new Error("RESEND_API_KEY/STOREFRONT_FROM_EMAIL não configurados.");
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.destination],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject: message.subject,
        html: message.html,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(`Resend recusou a notificação (${response.status}).`);
    return String(body?.id || "");
  }

  private async sendEmail(row: any) {
    const payload = row.payload || {};
    return this.sendTransactionalEmail({
      destination: row.destination,
      subject: `${payload.title} · pedido ${payload.orderCode}`,
      html: renderCustomerEmail(payload, this.emailAssets()),
    });
  }

  async sendCustomerAccessCode(
    destination: string,
    code: string,
    expiresInMinutes: number,
  ) {
    return this.sendTransactionalEmail(
      {
        destination,
        subject: "Seu código de acesso · Bispo Coffees",
        html: renderCustomerAccessEmail(
          { code, expiresInMinutes },
          this.emailAssets(),
        ),
      },
      { allowUnconfigured: process.env.NODE_ENV !== "production" },
    );
  }

  async processNext() {
    const activationValue =
      process.env.CUSTOMER_NOTIFICATIONS_ENABLED_AT?.trim();
    if (!activationValue || Number.isNaN(Date.parse(activationValue))) {
      return { processed: false, disabled: true };
    }
    const activationDate = new Date(activationValue);
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `WITH candidate AS (
         SELECT id FROM "CustomerNotificationOutbox"
          WHERE status IN ('PENDING','FAILED') AND ("nextAttemptAt" IS NULL OR "nextAttemptAt" <= NOW())
            AND "createdAt" >= $1::timestamptz
          ORDER BY "createdAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1
       )
       UPDATE "CustomerNotificationOutbox" n
          SET status='PROCESSING',attempts=n.attempts+1,"lastError"=NULL,"updatedAt"=NOW()
         FROM candidate WHERE n.id=candidate.id
       RETURNING n.id,n.channel,n.destination,n.payload,n.attempts`,
      activationDate,
    );
    const row = rows[0];
    if (!row) return { processed: false };
    try {
      if (row.channel !== "EMAIL")
        throw new Error(`Canal ainda não configurado: ${row.channel}`);
      const providerMessageId = await this.sendEmail(row);
      await this.database.$executeRawUnsafe(
        `UPDATE "CustomerNotificationOutbox" SET status='SENT',"providerMessageId"=$2,"sentAt"=NOW(),"updatedAt"=NOW() WHERE id=$1`,
        row.id,
        providerMessageId,
      );
      return { processed: true, sent: true, id: row.id };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const retryMinutes = Math.min(
        120,
        Math.max(5, 2 ** Math.min(Number(row.attempts || 1), 6)),
      );
      await this.database.$executeRawUnsafe(
        `UPDATE "CustomerNotificationOutbox" SET status='FAILED',"lastError"=$2,"nextAttemptAt"=NOW()+($3||' minutes')::interval,"updatedAt"=NOW() WHERE id=$1`,
        row.id,
        message.slice(0, 2000),
        String(retryMinutes),
      );
      return { processed: true, failed: true, error: message };
    }
  }
}
