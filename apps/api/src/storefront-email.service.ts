import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@bbos/database";
import { createHmac, randomUUID } from "node:crypto";

const money = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

@Injectable()
export class StorefrontEmailService {
  private readonly database = new PrismaClient();

  private trackingToken(orderId: string) {
    const secret = process.env.STOREFRONT_TRACKING_SECRET?.trim();
    if (!secret) throw new Error("STOREFRONT_TRACKING_SECRET não configurado.");
    const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000;
    const payload = Buffer.from(
      JSON.stringify({ orderId, expiresAt }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret)
      .update(payload)
      .digest("base64url");
    return `${payload}.${signature}`;
  }

  async sendPaidOrder(orderId: string) {
    const apiKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.STOREFRONT_EMAIL_FROM?.trim();
    const webUrl = process.env.STOREFRONT_WEB_URL?.trim()?.replace(/\/$/, "");
    if (!apiKey || !from || !webUrl) {
      console.warn("E-mail transacional não configurado", {
        orderId,
        missing: [
          !apiKey && "RESEND_API_KEY",
          !from && "STOREFRONT_EMAIL_FROM",
          !webUrl && "STOREFRONT_WEB_URL",
        ].filter(Boolean),
      });
      return { sent: false, configured: false };
    }
    const rows = await this.database.$queryRawUnsafe<any[]>(
      `SELECT id,code,customer,delivery,items,"subtotalCents","shippingCents","totalCents","paidAt"
         FROM "StorefrontOrder" WHERE id=$1 AND status='PAID' LIMIT 1`,
      orderId,
    );
    const order = rows[0];
    if (!order) return { sent: false, configured: true };
    const recipient = String(order.customer?.email || "")
      .trim()
      .toLowerCase();
    if (!recipient) return { sent: false, configured: true };

    const notificationId = randomUUID();
    const claimed = await this.database.$queryRawUnsafe<any[]>(
      `INSERT INTO "StorefrontNotification" (id,"orderId",type,status,recipient,attempts,"createdAt","updatedAt")
       VALUES ($1,$2,'ORDER_PAID','PROCESSING',$3,1,NOW(),NOW())
       ON CONFLICT ("orderId",type) DO UPDATE
         SET status='PROCESSING',attempts="StorefrontNotification".attempts+1,"updatedAt"=NOW(),"lastError"=NULL
       WHERE "StorefrontNotification".status='FAILED'
       RETURNING id`,
      notificationId,
      orderId,
      recipient,
    );
    if (!claimed[0]) return { sent: false, configured: true, duplicate: true };

    const items = Array.isArray(order.items) ? order.items : [];
    const token = this.trackingToken(order.id);
    const trackingUrl = `${webUrl}/loja/pedido/${encodeURIComponent(order.id)}?token=${encodeURIComponent(token)}`;
    const itemRows = items
      .map(
        (item: any) => `<tr>
          <td style="padding:14px 0;border-bottom:1px solid #e8e4dc">
            <strong style="font-size:16px">${escapeHtml(item.name)}</strong><br>
            <span style="color:#6f746f;font-size:13px">${escapeHtml(item.quantity)} × ${escapeHtml(item.grind)}</span>
          </td>
          <td style="padding:14px 0;border-bottom:1px solid #e8e4dc;text-align:right;font-weight:600">${money(Number(item.totalCents || 0))}</td>
        </tr>`,
      )
      .join("");
    const html = `<!doctype html><html><body style="margin:0;background:#f3f1ec;color:#10201b;font-family:Arial,sans-serif">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:34px 16px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#fff">
          <tr><td style="padding:34px 40px;border-top:5px solid #10201b">
            <div style="font-size:27px;letter-spacing:.15em">BISPO</div>
            <div style="margin-top:3px;color:#7b817c;font-size:10px;letter-spacing:.28em">TRUE COFFEE</div>
          </td></tr>
          <tr><td style="padding:12px 40px 30px">
            <div style="color:#7b6147;font-size:11px;letter-spacing:.16em">PEDIDO CONFIRMADO · ${escapeHtml(order.code)}</div>
            <h1 style="margin:18px 0 12px;font-family:Georgia,serif;font-size:34px;font-weight:400;line-height:1.1">Seu café já começou o caminho.</h1>
            <p style="margin:0 0 24px;color:#59615d;font-size:15px;line-height:1.7">Olá, ${escapeHtml(String(order.customer?.name || "").split(" ")[0])}. Recebemos seu pagamento e cuidaremos de cada etapa até a sua xícara.</p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${itemRows}</table>
            <table role="presentation" width="100%" style="margin-top:18px"><tr><td style="color:#6f746f">Entrega</td><td style="text-align:right">${order.shippingCents ? money(order.shippingCents) : "Grátis"}</td></tr><tr><td style="padding-top:10px;font-size:18px">Total</td><td style="padding-top:10px;text-align:right;font-size:22px;font-weight:700">${money(order.totalCents)}</td></tr></table>
            <a href="${trackingUrl}" style="display:block;margin-top:28px;padding:16px;background:#10201b;color:#fff;text-align:center;text-decoration:none;font-size:13px;letter-spacing:.08em">ACOMPANHAR MEU CAFÉ →</a>
            <p style="margin:28px 0 0;color:#7b817c;font-size:12px;line-height:1.6">Escolhido por José e Suzi. Preparado pela Bispo Coffees com o mesmo cuidado da origem à entrega.</p>
          </td></tr>
        </table>
      </td></tr></table></body></html>`;

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
          "idempotency-key": `bispo-order-paid-${order.id}`,
        },
        body: JSON.stringify({
          from,
          to: [recipient],
          subject: `Pedido ${order.code} confirmado · Bispo Coffees`,
          html,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(`Resend ${response.status}`);
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontNotification" SET status='SENT',"providerId"=$2,"sentAt"=NOW(),"updatedAt"=NOW() WHERE id=$1`,
        claimed[0].id,
        result.id || null,
      );
      return { sent: true, configured: true };
    } catch (error) {
      await this.database.$executeRawUnsafe(
        `UPDATE "StorefrontNotification" SET status='FAILED',"lastError"=$2,"updatedAt"=NOW() WHERE id=$1`,
        claimed[0].id,
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Falha desconhecida",
      );
      throw error;
    }
  }
}
