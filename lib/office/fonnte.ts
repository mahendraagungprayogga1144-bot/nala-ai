import { randomBytes } from "node:crypto";
import { getPublicShareOrigin } from "@/lib/auth/app-url";
import { resolveActorByUserId } from "@/lib/henima-sales/authz";
import { salesDb } from "@/lib/henima-sales/db";
import { createClient } from "@/lib/supabase/server";
import { answerWaVisitor, defaultGreeting } from "./wa-reply";

const KEY = /^[a-f0-9]{32}$/i;

type FonnteLink = {
  id: string;
  businessId: string;
  greeting: string;
  token: string | null;
  device: string | null;
  key: string | null;
};

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function missingColumn(error: { message?: string } | null) {
  const message = `${error?.message || ""}`.toLowerCase();
  return message.includes("fonnte_") || (message.includes("column") && message.includes("does not exist"));
}

export function fonnteWebhookUrl(key: string) {
  return `${getPublicShareOrigin()}/api/wa-fonnte?key=${key}`;
}

export async function readFonnteLink(businessId: string): Promise<{ link: FonnteLink | null; notice: string | null }> {
  const admin = salesDb();
  const { data, error } = await admin
    .from("module_wa_reply_links")
    .select("id, business_id, greeting, fonnte_token, fonnte_device, fonnte_key")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    return {
      link: null,
      notice: missingColumn(error)
        ? "Kolom Fonnte belum ada. Jalankan SQL 20261028_wa_fonnte.sql di Supabase."
        : "Sambungan Fonnte belum bisa dibaca.",
    };
  }
  if (!data) return { link: null, notice: null };
  return {
    link: {
      id: String(data.id),
      businessId: String(data.business_id),
      greeting: String(data.greeting || ""),
      token: data.fonnte_token ? String(data.fonnte_token) : null,
      device: data.fonnte_device ? String(data.fonnte_device) : null,
      key: data.fonnte_key ? String(data.fonnte_key) : null,
    },
    notice: null,
  };
}

async function targetBusiness(preferredBusinessId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const actor = await resolveActorByUserId(salesDb(), user.id, preferredBusinessId);
  return actor?.businessId ? String(actor.businessId) : null;
}

export async function ensureFonnteKey(preferredBusinessId: string) {
  const businessId = await targetBusiness(preferredBusinessId);
  if (!businessId) return { ok: false as const, message: "Masuk dulu untuk menyambungkan WhatsApp.", webhook: null, device: null, hasToken: false };
  const current = await readFonnteLink(businessId);
  if (current.notice) return { ok: false as const, message: current.notice, webhook: null, device: null, hasToken: false };
  if (!current.link) return { ok: false as const, message: "Tautan WA belum siap.", webhook: null, device: null, hasToken: false };
  if (current.link.key && KEY.test(current.link.key)) {
    return {
      ok: true as const,
      message: null,
      webhook: fonnteWebhookUrl(current.link.key),
      device: current.link.device,
      hasToken: Boolean(current.link.token),
    };
  }
  const key = randomBytes(16).toString("hex");
  const admin = salesDb();
  const { error } = await admin.from("module_wa_reply_links").update({ fonnte_key: key }).eq("id", current.link.id);
  if (error) {
    return {
      ok: false as const,
      message: missingColumn(error) ? "Kolom Fonnte belum ada. Jalankan SQL 20261028_wa_fonnte.sql di Supabase." : "Kunci webhook belum tersimpan.",
      webhook: null,
      device: null,
      hasToken: false,
    };
  }
  return { ok: true as const, message: null, webhook: fonnteWebhookUrl(key), device: current.link.device, hasToken: Boolean(current.link.token) };
}

export async function validateFonnteToken(token: string) {
  const clean = token.trim();
  if (clean.length < 10 || clean.length > 200 || /\s/.test(clean)) {
    return { ok: false as const, message: "Token Fonnte belum lengkap." };
  }
  try {
    const res = await fetch("https://api.fonnte.com/device", {
      headers: { Authorization: clean },
      cache: "no-store",
    });
    const body = (await res.json().catch(() => ({}))) as { status?: boolean; Status?: boolean; reason?: string; device?: string; device_status?: string };
    const reason = `${body.reason || ""}`;
    if (!res.ok || body.status === false || body.Status === false || /token/i.test(reason)) {
      return { ok: false as const, message: "Token Fonnte ditolak. Salin token dari menu Device di Fonnte." };
    }
    const device = digits(String(body.device || ""));
    const connected = !/disconnect/i.test(String(body.device_status || body.status || ""));
    return { ok: true as const, token: clean, device, connected: Boolean(device) && connected };
  } catch {
    return { ok: false as const, message: "Fonnte belum bisa dihubungi. Coba lagi." };
  }
}

export async function saveFonnteToken(preferredBusinessId: string, token: string) {
  const businessId = await targetBusiness(preferredBusinessId);
  if (!businessId) return { ok: false as const, message: "Masuk dulu untuk menyambungkan WhatsApp.", webhook: null, device: null };
  const checked = await validateFonnteToken(token);
  if (!checked.ok) return { ok: false as const, message: checked.message, webhook: null, device: null };
  const ready = await ensureFonnteKey(businessId);
  if (!ready.ok) return { ok: false as const, message: ready.message, webhook: null, device: null };
  const admin = salesDb();
  const { error } = await admin
    .from("module_wa_reply_links")
    .update({ fonnte_token: checked.token, fonnte_device: checked.device || null })
    .eq("business_id", businessId);
  if (error) {
    return {
      ok: false as const,
      message: missingColumn(error) ? "Kolom Fonnte belum ada. Jalankan SQL 20261028_wa_fonnte.sql di Supabase." : "Token belum tersimpan.",
      webhook: null,
      device: null,
    };
  }
  const where = checked.connected && checked.device ? `Nomor ${checked.device} tersambung.` : "Token tersimpan. Hubungkan perangkat di Fonnte sampai statusnya connect.";
  return { ok: true as const, message: where, webhook: ready.webhook, device: checked.device || null };
}

async function sendFonnte(token: string, target: string, message: string, inboxId: string) {
  const form = new FormData();
  form.set("target", target);
  form.set("message", message.slice(0, 4000));
  form.set("countryCode", "62");
  form.set("preview", "false");
  if (inboxId) form.set("inboxid", inboxId);
  const res = await fetch("https://api.fonnte.com/send", {
    method: "POST",
    headers: { Authorization: token },
    body: form,
  });
  const body = (await res.json().catch(() => ({}))) as { status?: boolean; Status?: boolean };
  return res.ok && body.status !== false && body.Status !== false;
}

export async function handleFonnteWebhook(key: string, payload: Record<string, unknown>) {
  if (!KEY.test(key)) return { ok: false as const, status: 401 };
  const admin = salesDb();
  const { data: link, error } = await admin
    .from("module_wa_reply_links")
    .select("id, business_id, greeting, fonnte_token, fonnte_device")
    .eq("fonnte_key", key.toLowerCase())
    .maybeSingle();
  if (error || !link?.fonnte_token) return { ok: true as const, status: 200 };
  const sender = digits(String(payload.sender || ""));
  const message = String(payload.message || payload.text || "").trim().slice(0, 500);
  const member = String(payload.member || "");
  const device = digits(String(payload.device || link.fonnte_device || ""));
  if (member || sender.includes("@") || !sender || sender === device || sender.length < 8 || sender.length > 16 || !message) {
    return { ok: true as const, status: 200 };
  }
  const { data: recent } = await admin
    .from("module_wa_reply_messages")
    .select("direction, body, created_at")
    .eq("link_id", link.id)
    .eq("visitor_key", sender)
    .order("created_at", { ascending: false })
    .limit(2);
  const newest = recent?.[0];
  const previous = recent?.[1];
  if (newest?.direction === "out" && previous?.direction === "in" && String(previous.body) === message) {
    return { ok: true as const, status: 200 };
  }
  const { data: business } = await admin.from("businesses").select("name").eq("id", link.business_id).maybeSingle();
  const brand = String(business?.name || "Henima");
  const greeting = String(link.greeting || defaultGreeting(brand));
  const answered = await answerWaVisitor({
    businessId: String(link.business_id),
    linkId: String(link.id),
    brand,
    greeting,
    visitor: sender,
    text: message,
    persist: false,
  });
  if (!answered.ok) return { ok: true as const, status: 200 };
  const sent = await sendFonnte(String(link.fonnte_token), sender, answered.reply, String(payload.inboxid || ""));
  if (!sent) return { ok: false as const, status: 502 };
  await admin.from("module_wa_reply_messages").insert([
    { business_id: link.business_id, link_id: link.id, visitor_key: sender, direction: "in", body: message },
    { business_id: link.business_id, link_id: link.id, visitor_key: sender, direction: "out", body: answered.reply },
  ]);
  return { ok: true as const, status: 200 };
}
