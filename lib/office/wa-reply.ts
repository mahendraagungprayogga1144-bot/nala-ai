import { randomBytes } from "node:crypto";
import { todayWib } from "@/lib/date";
import { resolveActorByUserId } from "@/lib/henima-sales/authz";
import { salesDb } from "@/lib/henima-sales/db";
import { SALES_PRODUCT_CATEGORY } from "@/lib/henima-sales/types";
import { getPublicShareOrigin } from "@/lib/auth/app-url";
import { createClient } from "@/lib/supabase/server";
import { answerPublicWa } from "./wa-ai";
import type { WaInboxMessage, WaInboxThread } from "./types";

export type WaDesk = {
  ok: boolean;
  notice: string | null;
  path: string | null;
  greeting: string;
  today: number;
  brand: string;
};

export type WaPublicLink = {
  brand: string;
  greeting: string;
};

type CatalogItem = { name: string; price: number | null; stock: number };

const TOKEN = /^[a-f0-9]{32}$/i;
const VISITOR = /^[a-zA-Z0-9_-]{8,40}$/;

function missingTable(error: { message?: string } | null) {
  const message = `${error?.message || ""}`.toLowerCase();
  return message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find the table");
}

function rp(amount: number) {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

export function defaultGreeting(brand: string) {
  return `Halo, saya ${brand}. Cerita saja mau parfum yang seperti apa, atau kalau lagi lamar kerja, sebut posisi yang kamu incar.`;
}

function productLine(item: CatalogItem) {
  const price = item.price != null ? rp(item.price) : "harga tanya sales";
  const ready = item.stock > 0 ? "tersedia" : "habis";
  return `• ${item.name} — ${price} (${ready})`;
}

export function composeWaReply(text: string, brand: string, greeting: string, products: CatalogItem[]) {
  const q = text.toLowerCase();
  const list = products.slice(0, 6);
  const named = list.filter((item) => {
    const name = item.name.toLowerCase().trim();
    return name.length >= 3 && q.includes(name);
  });
  if (named.length) return `${brand}:\n${named.map(productLine).join("\n")}\nMau yang ini?`;
  if (/stok|ready|tersedia|\bada\b/.test(q)) {
    const ready = list.filter((item) => item.stock > 0);
    if (!ready.length) return `${brand}: stok yang bisa disebut dari sini sedang kosong.`;
    return `Yang tersedia di ${brand}: ${ready.map((item) => item.name).join(", ")}.`;
  }
  if (/katalog|harga|produk|parfum|menu|berapa|\bbeli\b|\bpesan\b|\border\b|\bmau\b/.test(q)) {
    if (!list.length) return `${brand}: katalog belum diisi. Sebut barangnya lagi nanti setelah produk diisi.`;
    return `Katalog ${brand}:\n${list.map(productLine).join("\n")}\nMau yang mana?`;
  }
  if (/terima kasih|makasih|thanks|\bsiap\b|\boke\b|\bok\b/.test(q)) return `Siap. Sebut nama barangnya kalau mau lanjut.`;
  if (/halo|hai|hei|pagi|siang|sore|malam|assalam|permisi/.test(q)) {
    if (greeting && !/ketik katalog|saya balas otomatis/i.test(greeting)) return greeting;
    return `Halo, saya ${brand}. Lagi cari parfum, mau tanya harga, atau lagi lamar kerja? Cerita saja.`;
  }
  if (!list.length) return `Halo, saya ${brand}. Katalognya belum diisi, tapi pertanyaanmu tetap boleh disampaikan.`;
  return `Halo, saya ${brand}. Yang lagi ada:\n${list.map(productLine).join("\n")}\nMau saya bantu pilihkan?`;
}

async function catalog(businessId: string, take = 6): Promise<CatalogItem[]> {
  const db = salesDb();
  const first = await db.from("products").select("name, price, stock, category").eq("business_id", businessId).order("name").limit(40);
  const query = first.error?.message?.toLowerCase().includes("category")
    ? await db.from("products").select("name, price, stock").eq("business_id", businessId).order("name").limit(40)
    : first;
  if (query.error) return [];
  const rows = (query.data || []).map((row) => ({
    name: String(row.name || "Produk"),
    price: "price" in row && row.price != null ? Number(row.price) : null,
    stock: Number(row.stock) || 0,
    category: "category" in row && row.category ? String(row.category) : "",
  }));
  const henima = rows.filter((row) => row.category === SALES_PRODUCT_CATEGORY);
  return (henima.length ? henima : rows).slice(0, take).map(({ name, price, stock }) => ({ name, price, stock }));
}

async function actorBusiness(preferredBusinessId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = salesDb();
  const actor = await resolveActorByUserId(admin, user.id, preferredBusinessId);
  return { admin, actor };
}

export async function loadWaDesk(preferredBusinessId: string): Promise<WaDesk> {
  const empty: WaDesk = {
    ok: false,
    notice: "Tautan balasan WA belum tersambung.",
    path: null,
    greeting: "",
    today: 0,
    brand: "Henima Sales",
  };
  try {
    const owned = await actorBusiness(preferredBusinessId);
    if (!owned) return { ...empty, notice: "Masuk dulu untuk membuka tautan WA." };
    const link = await ensureWaLink(owned.admin, owned.actor.businessId, owned.actor.businessName);
    if (!link.ok) return { ...empty, notice: link.notice, brand: owned.actor.businessName };
    const today = todayWib();
    const { count } = await owned.admin
      .from("module_wa_reply_messages")
      .select("id", { count: "exact", head: true })
      .eq("link_id", link.id)
      .eq("direction", "in")
      .gte("created_at", `${today}T00:00:00+07:00`);
    return {
      ok: true,
      notice: null,
      path: `/w/${link.token}`,
      greeting: link.greeting,
      today: count || 0,
      brand: owned.actor.businessName,
    };
  } catch {
    return empty;
  }
}

type Ensured =
  | { ok: true; id: string; token: string; greeting: string; businessId: string }
  | { ok: false; notice: string };

async function ensureWaLink(admin: ReturnType<typeof salesDb>, businessId: string, brand: string): Promise<Ensured> {
  const { data, error } = await admin
    .from("module_wa_reply_links")
    .select("id, token, greeting")
    .eq("business_id", businessId)
    .maybeSingle();
  if (error) {
    return {
      ok: false,
      notice: missingTable(error)
        ? "Tautan balasan WA belum ada di database. Jalankan migration 20261028_wa_reply.sql."
        : "Tautan WA belum bisa dibaca.",
    };
  }
  if (data?.token && TOKEN.test(String(data.token))) {
    return {
      ok: true,
      id: String(data.id),
      token: String(data.token),
      greeting: String(data.greeting || defaultGreeting(brand)),
      businessId,
    };
  }
  const token = randomBytes(16).toString("hex");
  const greeting = defaultGreeting(brand);
  const { data: created, error: insertError } = await admin
    .from("module_wa_reply_links")
    .insert({ business_id: businessId, token, greeting })
    .select("id, token, greeting")
    .single();
  if (insertError || !created) {
    return { ok: false, notice: missingTable(insertError) ? "Tautan balasan WA belum ada di database. Jalankan migration 20261028_wa_reply.sql." : "Tautan WA belum bisa dibuat." };
  }
  return { ok: true, id: String(created.id), token: String(created.token), greeting: String(created.greeting || greeting), businessId };
}

export async function publicWaLink(token: string): Promise<WaPublicLink | null> {
  if (!TOKEN.test(token)) return null;
  try {
    const admin = salesDb();
    const { data, error } = await admin.from("module_wa_reply_links").select("greeting, business_id").eq("token", token.toLowerCase()).maybeSingle();
    if (error || !data) return null;
    const { data: business } = await admin.from("businesses").select("name").eq("id", data.business_id).maybeSingle();
    const brand = String(business?.name || "Henima");
    return { brand, greeting: String(data.greeting || defaultGreeting(brand)) };
  } catch {
    return null;
  }
}

export async function answerWaVisitor(input: {
  businessId: string;
  linkId: string;
  brand: string;
  greeting: string;
  visitor: string;
  text: string;
  persist?: boolean;
}) {
  const clean = input.text.trim().slice(0, 500);
  if (!VISITOR.test(input.visitor) || !clean) return { ok: false as const, message: "Pesan tidak berlaku." };
  const admin = salesDb();
  const today = todayWib();
  const { count } = await admin
    .from("module_wa_reply_messages")
    .select("id", { count: "exact", head: true })
    .eq("link_id", input.linkId)
    .eq("visitor_key", input.visitor)
    .eq("direction", "in")
    .gte("created_at", `${today}T00:00:00+07:00`);
  if ((count || 0) >= 40) return { ok: false as const, message: "Kuota chat hari ini sudah penuh." };
  const products = await catalog(input.businessId, 15);
  const { count: aiToday } = await admin
    .from("module_wa_reply_messages")
    .select("id", { count: "exact", head: true })
    .eq("link_id", input.linkId)
    .eq("direction", "out")
    .gte("created_at", `${today}T00:00:00+07:00`);
  const { data: earlier } = await admin
    .from("module_wa_reply_messages")
    .select("direction, body")
    .eq("link_id", input.linkId)
    .eq("visitor_key", input.visitor)
    .order("created_at", { ascending: false })
    .limit(8);
  const history = (earlier || [])
    .reverse()
    .map((row) => ({ direction: row.direction === "out" ? ("out" as const) : ("in" as const), body: String(row.body || "") }));
  const aiReply = (aiToday || 0) < 120 ? await answerPublicWa({ brand: input.brand, greeting: input.greeting, products, history, question: clean }) : null;
  const reply = aiReply || composeWaReply(clean, input.brand, input.greeting, products);
  if (input.persist !== false) {
    await admin.from("module_wa_reply_messages").insert([
      { business_id: input.businessId, link_id: input.linkId, visitor_key: input.visitor, direction: "in", body: clean },
      { business_id: input.businessId, link_id: input.linkId, visitor_key: input.visitor, direction: "out", body: reply },
    ]);
  }
  return { ok: true as const, reply };
}

export async function replyOnWaLink(token: string, visitor: string, text: string) {
  const clean = text.trim().slice(0, 500);
  if (!TOKEN.test(token) || !VISITOR.test(visitor)) return { ok: false as const, message: "Tautan tidak berlaku." };
  if (!clean) return { ok: false as const, message: "Tulis pesan dulu." };
  try {
    const admin = salesDb();
    const { data: link, error } = await admin
      .from("module_wa_reply_links")
      .select("id, business_id, greeting")
      .eq("token", token.toLowerCase())
      .maybeSingle();
    if (error || !link) return { ok: false as const, message: "Tautan tidak berlaku." };
    const { data: business } = await admin.from("businesses").select("name").eq("id", link.business_id).maybeSingle();
    const brand = String(business?.name || "Henima");
    const greeting = String(link.greeting || defaultGreeting(brand));
    return answerWaVisitor({
      businessId: String(link.business_id),
      linkId: String(link.id),
      brand,
      greeting,
      visitor,
      text: clean,
    });
  } catch {
    return { ok: false as const, message: "Balasan belum terkirim. Coba lagi." };
  }
}

export async function loadWaInbox(preferredBusinessId: string): Promise<WaInboxThread[]> {
  try {
    const owned = await actorBusiness(preferredBusinessId);
    if (!owned) return [];
    const link = await ensureWaLink(owned.admin, owned.actor.businessId, owned.actor.businessName);
    if (!link.ok) return [];
    const { data, error } = await owned.admin
      .from("module_wa_reply_messages")
      .select("id, visitor_key, direction, body, created_at")
      .eq("link_id", link.id)
      .order("created_at", { ascending: false })
      .limit(120);
    if (error || !data) return [];
    const grouped = new Map<string, WaInboxMessage[]>();
    for (const row of data) {
      const visitor = String(row.visitor_key || "");
      if (!VISITOR.test(visitor)) continue;
      const direction = row.direction === "out" ? "out" : "in";
      const message: WaInboxMessage = {
        id: String(row.id),
        direction,
        body: String(row.body || ""),
        at: String(row.created_at || ""),
      };
      const bucket = grouped.get(visitor);
      if (bucket) bucket.push(message);
      else grouped.set(visitor, [message]);
    }
    return [...grouped.entries()].slice(0, 8).map(([visitor, messages], index) => {
      const ordered = [...messages].reverse();
      const last = ordered[ordered.length - 1];
      return {
        visitor,
        label: /^\d{8,16}$/.test(visitor) ? `+${visitor}` : `Chat ${index + 1}`,
        preview: last?.body || "",
        at: last?.at || "",
        messages: ordered.slice(-20),
      };
    });
  } catch {
    return [];
  }
}

export async function publicWaMessages(token: string, visitor: string) {
  if (!TOKEN.test(token) || !VISITOR.test(visitor)) return [];
  try {
    const admin = salesDb();
    const { data: link } = await admin.from("module_wa_reply_links").select("id").eq("token", token.toLowerCase()).maybeSingle();
    if (!link) return [];
    const { data } = await admin
      .from("module_wa_reply_messages")
      .select("id, direction, body, created_at")
      .eq("link_id", link.id)
      .eq("visitor_key", visitor)
      .order("created_at", { ascending: true })
      .limit(40);
    return (data || []).map((row) => ({
      id: String(row.id),
      direction: row.direction === "out" ? ("out" as const) : ("in" as const),
      body: String(row.body || ""),
      at: String(row.created_at || ""),
    }));
  } catch {
    return [];
  }
}

export async function saveWaGreeting(preferredBusinessId: string, greeting: string) {
  const text = greeting.trim().slice(0, 400);
  if (text.length < 8) return { ok: false as const, message: "Balasan pembuka minimal 8 karakter." };
  try {
    const owned = await actorBusiness(preferredBusinessId);
    if (!owned) return { ok: false as const, message: "Masuk dulu untuk mengubah balasan." };
    const link = await ensureWaLink(owned.admin, owned.actor.businessId, owned.actor.businessName);
    if (!link.ok) return { ok: false as const, message: link.notice };
    const { error } = await owned.admin.from("module_wa_reply_links").update({ greeting: text }).eq("id", link.id);
    if (error) return { ok: false as const, message: "Balasan belum tersimpan." };
    return { ok: true as const, message: "Balasan pembuka tersimpan. Customer baru akan melihat kalimat ini." };
  } catch {
    return { ok: false as const, message: "Balasan belum tersimpan." };
  }
}

export async function describeWa(preferredBusinessId: string, question: string) {
  const desk = await loadWaDesk(preferredBusinessId);
  if (!desk.ok) return desk.notice || "Tautan WA belum siap.";
  const text = question.toLowerCase();
  if (/tautan|link|salin|bagi/.test(text)) {
    const url = `${getPublicShareOrigin()}${desk.path}`;
    const wa = `https://wa.me/?text=${encodeURIComponent(url)}`;
    return `Tautan WhatsApp ${desk.brand}: ${wa}. Ketuk tautan itu supaya WhatsApp terbuka dengan alamat chat.`;
  }
  if (/chat|pesan|masuk|baca/.test(text)) {
    return desk.today
      ? `Hari ini ${desk.today} chat masuk lewat tautan ${desk.brand}. Isi chatnya ada di panel Balas WA.`
      : `Hari ini belum ada chat masuk lewat tautan ${desk.brand}. Chat yang masuk nanti bisa dibaca di panel.`;
  }
  return `Henima AI yang membalas tautan ${desk.brand} sendiri. Customer dan orang yang melamar bisa nanya apa pun yang aman. Harga dan stok diambil dari katalog. Omzet dan data pemilik tidak dibuka di chat itu. Kalimat pembuka: ${desk.greeting}`;
}
