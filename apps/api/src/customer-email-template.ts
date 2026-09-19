type EmailItem = {
  name?: string;
  quantity?: number;
  grind?: string;
  unitPriceCents?: number;
  totalCents?: number;
  weightGrams?: number;
};

export type CustomerEmailPayload = {
  title?: string;
  detail?: string;
  orderCode?: string;
  eventType?: string;
  trackingUrl?: string | null;
  customer?: { name?: string; phone?: string };
  delivery?: {
    street?: string;
    number?: string;
    complement?: string;
    district?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  };
  items?: EmailItem[];
  subtotalCents?: number;
  shippingCents?: number;
  totalCents?: number;
  shippingServiceName?: string;
  carrierName?: string;
  estimatedDeliveryDays?: number;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const money = (cents: unknown) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(cents || 0) / 100);

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const postalCode = (value: unknown) => {
  const normalized = digits(value);
  return normalized.length === 8 ? `${normalized.slice(0, 5)}-${normalized.slice(5)}` : String(value ?? "");
};

const statusIndex: Record<string, number> = {
  ORDER_RECEIVED: 0,
  PAYMENT_CONFIRMED: 0,
  PREPARING: 1,
  INVOICE_AUTHORIZED: 2,
  SHIPMENT_CREATED: 2,
  SHIPPED: 3,
  OUT_FOR_DELIVERY: 3,
  DELIVERED: 4,
};

const sensoryNotes: Record<string, string> = {
  caramelo: "Caramelo e chocolate em uma xícara equilibrada — um café para transformar o cotidiano em ritual.",
  "doce de leite": "Açúcar mascavo, doce de leite e a lembrança de alfajor em uma experiência vibrante.",
  tangerina: "Uma leitura luminosa, cítrica e elegante, escolhida para trazer frescor à xícara.",
  singular: "Um perfil de identidade marcante, com complexidade e acabamento prolongado.",
  sublime: "Uma experiência épica, rara em expressão e precisa em cada camada sensorial.",
  essencial: "Equilíbrio e conforto para o café de todos os dias, sem abrir mão da origem.",
  intenso: "Estrutura, presença e uma doçura profunda para uma xícara de personalidade.",
  raros: "Uma seleção de disponibilidade limitada, construída para revelar o extraordinário da origem.",
};

const steps = ["Confirmado", "Em preparo", "NF emitida", "A caminho", "Entregue"];

function stepCells(eventType: string) {
  const current = statusIndex[eventType] ?? 0;
  return steps
    .map((label, index) => {
      const complete = index < current;
      const active = index === current;
      const dot = complete ? "#E0EAE9" : active ? "#FFFFFF" : "#0E191D";
      const border = complete || active ? "#E0EAE9" : "#84908f";
      const color = index <= current ? "#FFFFFF" : "#9AA3A1";
      return `<td width="20%" valign="top" style="padding:0 4px 0 0;color:${color};font-family:Arial,sans-serif;font-size:10px;line-height:14px;text-transform:uppercase;letter-spacing:.6px"><span style="display:block;width:11px;height:11px;border-radius:50%;background:${dot};border:2px solid ${border};margin:0 0 10px"></span>${escapeHtml(label)}</td>`;
    })
    .join("");
}

function itemRows(items: EmailItem[]) {
  return items
    .map((item) => {
      const price = Number(item.totalCents ?? Number(item.unitPriceCents || 0) * Number(item.quantity || 1));
      return `<tr><td style="padding:18px 0;border-top:1px solid #E0EAE9"><div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:27px;color:#0E191D">${escapeHtml(item.name || "Café Bispo")}</div><div style="padding-top:5px;font-family:Arial,sans-serif;font-size:12px;line-height:19px;color:#626B69">${escapeHtml(item.quantity || 1)} × ${escapeHtml(item.grind || "Grãos")}${item.weightGrams ? ` · ${escapeHtml(item.weightGrams)} g` : ""}</div></td><td align="right" valign="top" style="padding:21px 0 18px;border-top:1px solid #E0EAE9;font-family:Arial,sans-serif;font-size:14px;color:#0E191D;white-space:nowrap">${escapeHtml(money(price))}</td></tr>`;
    })
    .join("");
}

export function renderCustomerEmail(
  payload: CustomerEmailPayload,
  assets: { logoUrl: string; sealUrl: string },
) {
  const customerFirstName = String(payload.customer?.name || "").trim().split(/\s+/)[0] || "Olá";
  const items = Array.isArray(payload.items) ? payload.items : [];
  const firstItem = String(items[0]?.name || "").toLowerCase();
  const note = sensoryNotes[firstItem] || "Escolhido com critério, preparado com cuidado e acompanhado até chegar à sua xícara.";
  const delivery = payload.delivery || {};
  const address = [delivery.street, delivery.number, delivery.complement].filter(Boolean).join(", ");
  const place = [delivery.district, delivery.city && delivery.state ? `${delivery.city}/${delivery.state}` : delivery.city].filter(Boolean).join(" · ");
  const tracking = payload.trackingUrl
    ? `<tr><td style="padding:0 42px 42px"><a href="${escapeHtml(payload.trackingUrl)}" style="display:block;background:#0A0A0A;color:#FFFFFF;text-decoration:none;text-align:center;padding:17px 22px;font-family:Arial,sans-serif;font-size:11px;line-height:16px;letter-spacing:1.7px;text-transform:uppercase">Acompanhar meu pedido&nbsp;&nbsp;→</a></td></tr>`
    : "";
  const orderSummary = items.length
    ? `<tr><td style="padding:42px 42px 0"><div style="font-family:Arial,sans-serif;font-size:10px;line-height:14px;letter-spacing:2px;text-transform:uppercase;color:#0E191D">Sua escolha</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px">${itemRows(items)}<tr><td colspan="2" style="border-top:1px solid #E0EAE9"></td></tr></table></td></tr>
      <tr><td style="padding:28px 42px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#E0EAE9;border-left:3px solid #0E191D"><tr><td style="padding:20px 22px"><div style="font-family:Arial,sans-serif;font-size:10px;line-height:14px;letter-spacing:1.7px;text-transform:uppercase;color:#0E191D">Uma leitura de José e Suzi</div><div style="padding-top:8px;font-family:Georgia,'Times New Roman',serif;font-size:15px;line-height:23px;font-style:italic;color:#0E191D">${escapeHtml(note)}</div></td></tr></table></td></tr>
      <tr><td style="padding:31px 42px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="50%" valign="top" style="padding:0 18px 25px 0"><div style="font:10px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#626B69">Destino</div><div style="padding-top:8px;font:13px/21px Arial,sans-serif;color:#0E191D">${escapeHtml(address)}<br>${escapeHtml(place)}<br>CEP ${escapeHtml(postalCode(delivery.postalCode))}</div></td><td width="50%" valign="top" style="padding:0 0 25px 18px"><div style="font:10px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#626B69">Envio</div><div style="padding-top:8px;font:13px/21px Arial,sans-serif;color:#0E191D">${escapeHtml(payload.shippingServiceName || "Entrega")}${payload.carrierName ? `<br>${escapeHtml(payload.carrierName)}` : ""}${payload.estimatedDeliveryDays ? `<br>Até ${escapeHtml(payload.estimatedDeliveryDays)} dias úteis` : ""}</div></td></tr></table></td></tr>
      <tr><td style="padding:0 42px 31px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:5px 0;font:13px Arial,sans-serif;color:#626B69">Produto</td><td align="right" style="padding:5px 0;font:13px Arial,sans-serif;color:#0E191D">${escapeHtml(money(payload.subtotalCents))}</td></tr><tr><td style="padding:5px 0;font:13px Arial,sans-serif;color:#626B69">Entrega</td><td align="right" style="padding:5px 0;font:13px Arial,sans-serif;color:#0E191D">${escapeHtml(money(payload.shippingCents))}</td></tr><tr><td style="padding:17px 0 5px;border-top:1px solid #E0EAE9;font:20px Georgia,'Times New Roman',serif;color:#0E191D">Total</td><td align="right" style="padding:17px 0 5px;border-top:1px solid #E0EAE9;font:20px Georgia,'Times New Roman',serif;color:#0E191D">${escapeHtml(money(payload.totalCents))}</td></tr></table></td></tr>`
    : "";

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(payload.title || "Seu pedido Bispo")}</title></head><body style="margin:0;padding:0;background:#F1EEE8;color:#0E191D"><div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(payload.detail)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F1EEE8"><tr><td align="center" style="padding:24px 10px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#FFFFFF">
    <tr><td colspan="3" style="height:4px;background:#0E191D;font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td colspan="3" style="padding:25px 38px;background:#FFFFFF"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td width="72" valign="middle"><img src="${escapeHtml(assets.sealUrl)}" width="62" height="62" alt="Selo Bispo True Coffee" style="display:block;border:0;border-radius:50%"></td><td valign="middle"><img src="${escapeHtml(assets.logoUrl)}" width="168" alt="Bispo True Coffee" style="display:block;border:0;width:168px;max-width:100%;height:auto"></td><td align="right" valign="middle" style="font:9px/15px Arial,sans-serif;letter-spacing:1.5px;text-transform:uppercase;color:#626B69">Escolhido<br>na origem</td></tr></table></td></tr>
    <tr><td colspan="3" style="padding:43px 42px 38px;background:#0A0A0A;color:#FFFFFF"><div style="font:10px/14px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#E0EAE9">${escapeHtml(payload.title || "Seu pedido Bispo")}</div><h1 style="margin:18px 0 17px;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:42px;font-weight:400;color:#FFFFFF">Seu café já começou<br>a jornada.</h1><div style="font:14px/23px Arial,sans-serif;color:#E0EAE9">${escapeHtml(customerFirstName)}, ${escapeHtml(payload.detail || "acompanharemos cada etapa até o café chegar a você.")}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:27px;border-top:1px solid #3E484B"><tr><td style="padding-top:16px;font:11px/16px Arial,sans-serif;letter-spacing:.8px;text-transform:uppercase;color:#FFFFFF">${escapeHtml(payload.orderCode)}</td><td align="right" style="padding-top:16px;font:11px/16px Arial,sans-serif;color:#AEB8B6">Escolhido por José e Suzi</td></tr></table></td></tr>
    <tr><td colspan="3" style="padding:28px 42px 32px;background:#0E191D"><div style="margin-bottom:22px;font:10px/14px Arial,sans-serif;letter-spacing:2px;text-transform:uppercase;color:#E0EAE9">A jornada do seu pedido</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #84908F"><tr>${stepCells(String(payload.eventType || "ORDER_RECEIVED"))}</tr></table></td></tr>
    <tr><td colspan="3"><table role="presentation" width="100%" cellspacing="0" cellpadding="0">${orderSummary}${tracking}<tr><td style="padding:0 42px 32px;text-align:center;font:11px/18px Arial,sans-serif;color:#626B69">Se precisar, responda a este e-mail.<br>Será um prazer cuidar da sua escolha.</td></tr></table></td></tr>
    <tr><td colspan="3" style="padding:25px 42px;background:#E0EAE9"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="font:500 13px Arial,sans-serif;letter-spacing:2px;color:#0E191D">BISPO</td><td align="right" style="font:9px/15px Arial,sans-serif;letter-spacing:.4px;text-transform:uppercase;color:#52605D">José &amp; Suzi · Bispo Coffees<br>True Coffee · Londrina, Paraná</td></tr></table></td></tr>
  </table></td></tr></table></body></html>`;
}
