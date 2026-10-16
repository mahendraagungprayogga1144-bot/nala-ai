import { salesLogError } from "../log";

export function infobipBaseUrl() {
  const raw = (process.env.INFOBIP_BASE_URL || "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
  return raw;
}

export function infobipConfigured() {
  return Boolean(process.env.INFOBIP_API_KEY?.trim() && infobipBaseUrl());
}

export function infobipMonitorReady() {
  return infobipConfigured() && Boolean(process.env.INFOBIP_WA_FROM?.trim() && process.env.INFOBIP_WA_TO?.trim());
}

export function whatsAppTextBody(from: string, to: string, text: string) {
  return {
    from: from.replace(/\s+/g, ""),
    to: to.replace(/\D/g, ""),
    content: { text: text.slice(0, 4000) },
  };
}

export function whatsAppTemplateBody(from: string, to: string, templateName: string, placeholder: string) {
  return {
    messages: [
      {
        from: from.replace(/\s+/g, ""),
        to: to.replace(/\D/g, ""),
        content: {
          templateName,
          language: "en",
          templateData: { body: { placeholders: [placeholder.slice(0, 300)] } },
        },
      },
    ],
  };
}

export function infobipAccepted(body: { status?: { groupName?: string }; messages?: { status?: { groupName?: string } }[] }) {
  const name = body.status?.groupName || body.messages?.[0]?.status?.groupName || "";
  return name === "PENDING" || name === "DELIVERED" || name === "ACCEPTED";
}

async function infobipPost(path: string, payload: unknown) {
  const key = process.env.INFOBIP_API_KEY?.trim();
  const base = infobipBaseUrl();
  if (!key || !base) return { ok: false as const, reason: "not_configured" };
  const res = await fetch(`https://${base}${path}`, {
    method: "POST",
    headers: {
      Authorization: `App ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = (await res.json().catch(() => ({}))) as { status?: { groupName?: string }; messages?: { status?: { groupName?: string } }[] };
  if (!res.ok || !infobipAccepted(body)) {
    salesLogError("infobip_send", { status: res.status, group: body.status?.groupName || body.messages?.[0]?.status?.groupName }, { status: res.status });
    return { ok: false as const, reason: `http_${res.status}` };
  }
  return { ok: true as const };
}

export async function sendWhatsAppText(to: string, text: string) {
  const from = process.env.INFOBIP_WA_FROM?.trim();
  if (!from || !to.trim()) return { ok: false as const, reason: "not_configured" };
  const plain = await infobipPost("/whatsapp/1/message/text", whatsAppTextBody(from, to, text));
  if (plain.ok) return plain;
  const template = process.env.INFOBIP_WA_TEMPLATE?.trim() || "welcome_multiple_languages";
  return infobipPost("/whatsapp/1/message/template", whatsAppTemplateBody(from, to, template, text));
}

/** Founder monitor only. Never used to message customers. */
export async function notifyFounderWhatsApp(text: string) {
  const to = process.env.INFOBIP_WA_TO?.trim();
  if (!to || !text.trim()) return;
  try {
    await sendWhatsAppText(to, text);
  } catch (err) {
    salesLogError("infobip_notify", err);
  }
}
