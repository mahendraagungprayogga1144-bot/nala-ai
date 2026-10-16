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

export async function sendWhatsAppText(to: string, text: string) {
  const key = process.env.INFOBIP_API_KEY?.trim();
  const base = infobipBaseUrl();
  const from = process.env.INFOBIP_WA_FROM?.trim();
  if (!key || !base || !from || !to.trim()) return { ok: false as const, reason: "not_configured" };
  const res = await fetch(`https://${base}/whatsapp/1/message/text`, {
    method: "POST",
    headers: {
      Authorization: `App ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(whatsAppTextBody(from, to, text)),
  });
  if (!res.ok) {
    salesLogError("infobip_send", { status: res.status }, { status: res.status });
    return { ok: false as const, reason: `http_${res.status}` };
  }
  return { ok: true as const };
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
