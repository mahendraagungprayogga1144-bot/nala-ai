import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type InMsg = {
  role?: string;
  content?: string;
  image?: { mediaType?: string; data?: string };
};

const MODE_NOTES: Record<string, string> = {
  image: "Mode gambar/stiker: susun brief visual (subjek, gaya, warna, teks di gambar, rasio). Jangan mengaku sudah membuat file gambar.",
  write: "Mode tulis/edit: bantu merapikan atau menulis teks yang diminta. Langsung berikan naskahnya.",
  web: "Mode cari: user ingin info. Kamu tidak menelusuri web live. Jawab dari pengetahuan dan data bisnis, dan katakan itu bukan hasil telusuran langsung.",
  research: "Mode riset mendalam: susun laporan singkat — temuan, angka dari data, risiko, dan langkah berikutnya.",
  sketch: "Mode sketsa: jelaskan komposisi gambar yang bisa dilampirkan, langkah demi langkah, tanpa mengaku sudah menggambar.",
  template: "Mode template: buat kerangka yang bisa dipakai ulang, dengan bagian yang jelas dan placeholder.",
  slides: "Mode presentasi: susun outline slide. Tiap slide: judul + 3 poin paling penting.",
  pdf: "Mode PDF: susun dokumen rapi (judul, ringkasan, isi, penutup) yang siap disalin. Jangan mengaku file PDF sudah terunduh.",
};

function rp(n: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Math.round(n) || 0,
  );
}

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function cleanText(value: unknown, max: number) {
  return String(value || "")
    .replace(/\0/g, "")
    .trim()
    .slice(0, max);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "Mesin GPT Astra belum dikonfigurasi di server." },
      { status: 503 },
    );
  }

  let body: { messages?: InMsg[]; mode?: string; think?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Permintaan tidak terbaca." }, { status: 400 });
  }

  const incoming = Array.isArray(body.messages) ? body.messages.slice(-24) : [];
  const messages: Anthropic.Messages.MessageParam[] = [];
  for (const raw of incoming) {
    const role = raw?.role === "assistant" ? "assistant" : raw?.role === "user" ? "user" : null;
    if (!role) continue;
    const text = cleanText(raw.content, 8000);
    const media = cleanText(raw.image?.mediaType, 40);
    const data = cleanText(raw.image?.data, 3_800_000).replace(/^data:[^;]+;base64,/, "");
    if (role === "user" && media && IMAGE_TYPES.has(media) && data.length > 40) {
      messages.push({
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: media as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
              data,
            },
          },
          { type: "text", text: text || "Analisa gambar ini." },
        ],
      });
      continue;
    }
    if (!text) continue;
    messages.push({ role, content: text });
  }
  if (!messages.length || messages[messages.length - 1]?.role !== "user") {
    return NextResponse.json({ error: "Pesan kosong." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get("active_business_id")?.value;
  const [{ data: profile }, { data: businesses }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("businesses").select("id, name, type").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);
  const list = businesses || [];
  const business = list.find((b) => b.id === activeId) || list[0] || null;
  const userName = profile?.full_name || user.email?.split("@")[0] || "Owner";
  const snapshot = await loadSnapshot(supabase, user.id, business?.id || null);

  const mode = MODE_NOTES[String(body.mode || "")] || "";
  const think = Boolean(body.think);
  const system = `Kamu adalah Henima AI di Gercep OS. Pengguna memakai modul ini sebagai GPT Astra: untuk analisa bisnis dan bantuan umum.
Bahasa Indonesia, jelas, tenang, tanpa basa-basi. Jangan pakai markdown bintang atau pagar. Untuk daftar, mulai baris dengan "- ".
Jangan mengarang angka. Kalau datanya tidak ada di konteks, bilang belum ada di data Gercep.
Kamu tidak membuka internet secara langsung dan tidak membuat file gambar atau PDF biner.
Jangan mengaku sebagai ChatGPT.

Pengguna: ${userName}
Bisnis aktif: ${business ? `${business.name} (${business.type || "umum"})` : "belum dipilih"}
Bisnis di akun: ${list.map((b) => `${b.name} (${b.type || "-"})`).join(", ") || "belum ada"}
${mode}
${think ? "Mode berpikir: jawab lebih dalam, urut, dan lengkap. Tetap ringkas di pembuka." : ""}

DATA GERCEP (bulan berjalan, untuk analisa):
${snapshot}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: think || body.mode === "research" ? 1800 : 1000,
      system,
      messages,
    });
    const reply = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    return NextResponse.json({
      reply: reply || "Aku belum bisa menyusun jawaban. Coba ulangi dengan pertanyaan yang lebih spesifik.",
    });
  } catch {
    return NextResponse.json({ error: "GPT Astra sedang tidak menjawab. Coba lagi sebentar." }, { status: 502 });
  }
}

async function loadSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  businessId: string | null,
) {
  const lines: string[] = [];
  const start = monthStart();

  let productsQuery = supabase
    .from("products")
    .select("name, stock, min_stock, price, cost, category")
    .eq("user_id", userId)
    .limit(40);
  if (businessId) productsQuery = productsQuery.eq("business_id", businessId);
  const { data: products, error: productError } = await productsQuery;
  if (productError) {
    lines.push(`Stok tidak terbaca: ${productError.message}`);
  } else if (!products?.length) {
    lines.push("Belum ada produk di inventory.");
  } else {
    const low = products.filter((p) => Number(p.stock) <= Number(p.min_stock || 0));
    lines.push(
      `Produk (${products.length} ditampilkan): ${products
        .slice(0, 18)
        .map((p) => `${p.name} stok ${p.stock} jual ${rp(Number(p.price || 0))}`)
        .join("; ")}`,
    );
    if (low.length) lines.push(`Stok menipis: ${low.map((p) => p.name).join(", ")}`);
  }

  const { data: txs, error: txError } = await supabase
    .from("transactions")
    .select("type, amount, scope")
    .eq("user_id", userId)
    .gte("transaction_date", start)
    .limit(2000);
  if (txError) {
    lines.push(`Keuangan tidak terbaca: ${txError.message}`);
  } else {
    let masuk = 0;
    let keluar = 0;
    for (const row of txs || []) {
      if (row.scope && row.scope !== "bisnis") continue;
      if (row.type === "pemasukan") masuk += Number(row.amount) || 0;
      else keluar += Number(row.amount) || 0;
    }
    lines.push(`Keuangan bisnis bulan ini: pemasukan ${rp(masuk)}, pengeluaran ${rp(keluar)}, selisih ${rp(masuk - keluar)}.`);
  }

  if (businessId) {
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("total, deleted_at")
      .eq("business_id", businessId)
      .gte("order_date", start)
      .limit(400);
    if (!orderError && orders) {
      const live = orders.filter((row) => !row.deleted_at);
      const omzet = live.reduce((sum, row) => sum + (Number(row.total) || 0), 0);
      lines.push(`Order Henima bulan ini: ${live.length} transaksi, omzet ${rp(omzet)}.`);
    }
  }

  return lines.join("\n").slice(0, 7000);
}
