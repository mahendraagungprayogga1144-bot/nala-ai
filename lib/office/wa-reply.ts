import { randomBytes } from "node:crypto";
import { todayWib } from "@/lib/date";
import { resolveActorByUserId } from "@/lib/henima-sales/authz";
import { salesDb } from "@/lib/henima-sales/db";
import { SALES_PRODUCT_CATEGORY } from "@/lib/henima-sales/types";
import { createClient } from "@/lib/supabase/server";

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
  return `Halo, ini ${brand}. Ketik katalog, harga, atau stok. Saya balas otomatis.`;
}

export function composeWaReply(text: string, brand: string, greeting: string, products: CatalogItem[]) {
  const q = text.toLowerCase();
  const list = products.slice(0, 6);
  if (/katalog|harga|produk|parfum|menu|berapa/.test(q)) {
    if (!list.length) return `${brand}: katalog belum diisi. Sales akan membalas manual.`;
    const lines = list.map((item) => {
      const price = item.price != null ? rp(item.price) : "harga tanya sales";
      const ready = item.stock > 0 ? "tersedia" : "habis";
      return `• ${item.name} — ${price} (${ready})`;
    });
    return `Katalog ${brand}:\n${lines.join("\n")}\nMau yang mana?`;
  }
  if (/stok|ready|tersedia|\bada\b/.test(q)) {
    const ready = list.filter((item) => item.stock > 0);
    if (!ready.length) return `${brand}: stok yang bisa disebut dari sini sedang kosong.`;
    return `Yang tersedia di ${brand}: ${ready.map((item) => item.name).join(", ")}.`;
  }
  if (/halo|hai|hei|pagi|siang|sore|malam|assalam|permisi/.test(q)) return greeting;
  return `${greeting}\nKalau mau lihat barang, ketik katalog.`;
}

async function catalog(businessId: string): Promise<CatalogItem[]> {
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
  return (henima.length ? henima : rows).slice(0, 6).map(({ name, price, stock }) => ({ name, price, stock }));
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
    const today = todayWib();
    const { count } = await admin
      .from("module_wa_reply_messages")
      .select("id", { count: "exact", head: true })
      .eq("link_id", link.id)
      .eq("visitor_key", visitor)
      .eq("direction", "in")
      .gte("created_at", `${today}T00:00:00+07:00`);
    if ((count || 0) >= 40) return { ok: false as const, message: "Kuota chat hari ini sudah penuh. Lanjut besok atau hubungi sales." };
    const { data: business } = await admin.from("businesses").select("name").eq("id", link.business_id).maybeSingle();
    const brand = String(business?.name || "Henima");
    const greeting = String(link.greeting || defaultGreeting(brand));
    const products = await catalog(String(link.business_id));
    const reply = composeWaReply(clean, brand, greeting, products);
    await admin.from("module_wa_reply_messages").insert([
      { business_id: link.business_id, link_id: link.id, visitor_key: visitor, direction: "in", body: clean },
      { business_id: link.business_id, link_id: link.id, visitor_key: visitor, direction: "out", body: reply },
    ]);
    return { ok: true as const, reply };
  } catch {
    return { ok: false as const, message: "Balasan belum terkirim. Coba lagi." };
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
    return `Tautan balasan WA ${desk.brand}: ${desk.path}. Salin dari panel, lalu kirim ke customer. Mereka ketik di halaman itu dan langsung dibalas.`;
  }
  if (/chat|pesan|masuk/.test(text)) {
    return desk.today
      ? `Hari ini ${desk.today} chat masuk lewat tautan ${desk.brand}.`
      : `Hari ini belum ada chat masuk lewat tautan ${desk.brand}.`;
  }
  return `Balasan otomatis ${desk.brand}: ${desk.greeting} Kalau customer mengetik katalog, harga, atau stok, daftar produk Henima yang dikirim.`;
}
