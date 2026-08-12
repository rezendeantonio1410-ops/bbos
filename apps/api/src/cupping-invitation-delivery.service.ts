import { Injectable } from "@nestjs/common";

export type CuppingDelivery = { delivered: boolean; channel: "EMAIL" | "SMS" | "WHATSAPP"; developmentLink?: string; reason?: string };

@Injectable()
export class CuppingInvitationDeliveryService {
  async sendEmail(input: { email: string; link: string }): Promise<CuppingDelivery> {
    return { delivered: false, channel: "EMAIL", developmentLink: input.link, reason: `Provider de e-mail não configurado para ${input.email}.` };
  }
  async sendSms(input: { phone?: string | null; link: string }): Promise<CuppingDelivery> {
    return { delivered: false, channel: "SMS", developmentLink: input.link, reason: input.phone ? "Provider SMS não configurado." : "Telefone não cadastrado." };
  }
  async sendWhatsapp(input: { phone?: string | null; link: string }): Promise<CuppingDelivery> {
    return { delivered: false, channel: "WHATSAPP", developmentLink: input.link, reason: input.phone ? "Provider WhatsApp não configurado." : "Telefone não cadastrado." };
  }
}
