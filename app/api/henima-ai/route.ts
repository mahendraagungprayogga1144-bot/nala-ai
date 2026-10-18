import Anthropic from "@anthropic-ai/sdk";
import { PDFDocument, rgb } from "pdf-lib";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { embedBrandFonts } from "@/lib/henima-sales/pdf-fonts";

export const maxDuration = 60;

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

type InMsg = {
  role?: string;
  content?: string;
  image?: { mediaType?: string; data?: string };
};

const MODE_NOTES: Record<string, string> = {
  image: "User meminta gambar atau stiker. Jelaskan singkat apa yang dibuat. Server yang menghasilkan file gambarnya.",
  write: "User ingin teks ditulis atau diedit. Langsung berikan naskahnya.",
  web: "User ingin info terkini. Pakai pencarian web.",
  research: "User ingin riset mendalam. Pakai pencarian web bila perlu, lalu tulis laporan yang lengkap.",
  sketch: "User meminta sketsa. Server membuat gambarnya. Jelaskan singkat hasilnya.",
  template: "Buat template yang bisa dipakai ulang, lengkap, siap diisi.",
  slides: "Susun presentasi lengkap. Tiap slide: judul lalu poin-poin. Server mengubahnya jadi PDF.",
  pdf: "Tulis dokumen lengkap dan rapi. Server mengubahnya jadi file PDF.",
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

  const modeId = String(body.mode || "");
  const mode = MODE_NOTES[modeId] || "";
  const think = Boolean(body.think);
  const lastUser = [...incoming].reverse().find((m) => m?.role === "user");
  const lastText = cleanText(lastUser?.content, 4000);
  const hasUpload = Boolean(lastUser?.image?.data);
  const draw = !hasUpload && wantsPicture(lastText, modeId);
  const makePdf = wantsDocument(lastText, modeId);
  const businessQuestion = aboutBusiness(lastText);
  const worldQuestion = !businessQuestion && !draw && !makePdf && needsWorld(lastText);

  const system = `Kamu adalah Henima AI. Kamu menjawab soal apa saja di seluruh dunia: negara, kota, sejarah, sains, budaya, olahraga, teknologi, berita, tokoh, bahasa, kesehatan umum, dan kehidupan sehari-hari.
Jangan persempit jawaban ke usaha user atau ke satu negara. Kalau topiknya luas, jawab lengkap.
Untuk fakta, berita, harga, tempat, orang, dan kejadian, pakai pencarian web dulu baru menjawab. Sebut sumbernya singkat kalau ada.
Kalau ditanya kamu bisa apa, jawab bahwa kamu bisa bantu hampir semua hal di dunia, termasuk gambar, PDF, dan info terkini. Jangan buat daftar menu bisnis atau ternak.
Kalau user minta gambar, balas satu kalimat saja. File gambar dibuat server.
Untuk daftar, mulai baris dengan "- ". Jangan pakai emoji sama sekali. Jangan pakai bintang, pagar, atau markdown.
${worldQuestion ? "Pertanyaan ini soal dunia. Wajib cari di web dulu, lalu jawab tuntas." : ""}
${mode}
${think ? "Jawab lebih dalam dan urut." : ""}

Pengguna: ${userName}
${
  businessQuestion
    ? `Bisnis aktif: ${business ? `${business.name} (${business.type || "umum"})` : "belum dipilih"}
Jangan mengarang angka. Kalau angkanya tidak ada di data, bilang belum tercatat.
DATA GERCEP:
${snapshot}`
    : ""
}`;

  try {
    const picture = draw ? generateImage(`Buat gambar ini, tanpa teks penjelasan: ${lastText}`) : Promise.resolve(null);
    const reply = await answer(system, messages, think || modeId === "research" || worldQuestion);
    const image = await picture;
    let text = tidyReply(reply) || "Aku belum bisa menyusun jawaban. Coba ulangi dengan lebih spesifik.";
    if (draw && !image) text += "\n\nGambarnya belum terbentuk. Coba ulangi dengan deskripsi yang lebih konkret.";

    let file: { name: string; mediaType: string; data: string } | undefined;
    if (makePdf && reply) {
      const pdf = await textToPdf(lastText.slice(0, 80) || "Henima AI", reply);
      const slug = (lastText || "henima").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "henima";
      file = { name: `${slug}.pdf`, mediaType: "application/pdf", data: pdf };
    }

    return NextResponse.json({
      reply: text,
      image: image || undefined,
      file,
    });
  } catch {
    return NextResponse.json({ error: "GPT Astra sedang tidak menjawab. Coba lagi sebentar." }, { status: 502 });
  }
}

function tidyReply(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/[*_`#]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function wantsPicture(text: string, mode: string) {
  if (mode === "image" || mode === "sketch") return true;
  const t = text.toLowerCase();
  if (/^(gambar|stiker|ilustrasi|logo)\b/.test(t)) return true;
  const visual = /(gambar|stiker|ilustrasi|logo|ikon|image|picture|wallpaper|artwork)/.test(t);
  const make = /(buat|bikin|bikinin|buatin|tolong|kasih|generate|desain|lukis|render|draw)/.test(t);
  return visual && make;
}

function aboutBusiness(text: string) {
  return /\b(bisnis|usaha|omzet|stok|keuangan|laba|rugi|ternak|pakan|hpp|penjualan|modal)\b/i.test(text);
}

function needsWorld(text: string) {
  return /\b(apa|siapa|kapan|dimana|di mana|kenapa|mengapa|bagaimana|berapa|dunia|negara|kota|berita|sejarah|fakta|siapakah|apakah|where|what|who|when|why|how)\b/i.test(text);
}

function wantsDocument(text: string, mode: string) {
  if (mode === "pdf" || mode === "slides") return true;
  return /(buat|bikin|unduh|download|susun|export|jadikan).{0,40}(pdf|presentasi|slide)/i.test(text);
}

async function answer(system: string, messages: Anthropic.Messages.MessageParam[], deep: boolean) {
  const max_tokens = deep ? 4000 : 2500;
  try {
    return await collectText(system, messages, max_tokens, true);
  } catch {
    return collectText(system, messages, max_tokens, false);
  }
}

async function collectText(
  system: string,
  messages: Anthropic.Messages.MessageParam[],
  max_tokens: number,
  search: boolean,
) {
  let thread = messages;
  let finalText = "";
  for (let round = 0; round < 4; round++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens,
      system,
      messages: thread,
      ...(search
        ? {
            tools: [
              {
                type: "web_search_20250305" as const,
                name: "web_search" as const,
                max_uses: 5,
              },
            ],
          }
        : {}),
    });
    const text = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n")
      .trim();
    if (text) finalText = text;
    if (response.stop_reason !== "pause_turn") break;
    thread = [...thread, { role: "assistant", content: response.content }];
  }
  return finalText;
}

async function generateImage(prompt: string): Promise<{ mediaType: string; data: string } | null> {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_API_KEY?.trim() ||
    "";
  if (!key) return null;
  const models = ["gemini-2.5-flash-image", "gemini-3-pro-image-preview"];
  for (const model of models) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt.slice(0, 2000) }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
          }),
          signal: AbortSignal.timeout(55_000),
        },
      );
      const json = (await res.json()) as {
        candidates?: { content?: { parts?: { inlineData?: { data?: string; mimeType?: string }; inline_data?: { data?: string; mime_type?: string } }[] } }[];
      };
      if (!res.ok) continue;
      for (const part of json.candidates?.[0]?.content?.parts || []) {
        const inline = part.inlineData || part.inline_data;
        if (inline?.data) {
          const blob = inline as { mimeType?: string; mime_type?: string };
          return { mediaType: blob.mimeType || blob.mime_type || "image/png", data: inline.data };
        }
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function textToPdf(title: string, body: string) {
  const doc = await PDFDocument.create();
  const { sans, sansBold } = await embedBrandFonts(doc);
  const margin = 48;
  const size = 11;
  const leading = 16;
  const pageW = 595;
  const pageH = 842;
  const maxW = pageW - margin * 2;
  const ink = rgb(0.1, 0.1, 0.1);
  let page = doc.addPage([pageW, pageH]);
  let y = pageH - margin;

  const draw = (text: string, font: typeof sans, fontSize: number) => {
    const safe = text.replace(/[^\u0000-\u024F\u1E00-\u1EFF]/g, " ").replace(/\s+/g, " ").trim();
    if (!safe) return;
    if (y < margin + fontSize) {
      page = doc.addPage([pageW, pageH]);
      y = pageH - margin;
    }
    page.drawText(safe, { x: margin, y, size: fontSize, font, color: ink });
    y -= fontSize + 5;
  };

  draw(title || "Henima AI", sansBold, 16);
  y -= 8;
  for (const raw of body.replace(/\r/g, "").split("\n")) {
    if (!raw.trim()) {
      y -= leading / 2;
      continue;
    }
    let rest = raw.trim();
    while (rest) {
      let cut = rest.length;
      while (cut > 1 && sans.widthOfTextAtSize(rest.slice(0, cut), size) > maxW) cut -= 1;
      if (cut < rest.length) {
        const space = rest.lastIndexOf(" ", cut);
        if (space > 24) cut = space;
      }
      draw(rest.slice(0, cut), sans, size);
      rest = rest.slice(cut).trim();
    }
  }
  return Buffer.from(await doc.save()).toString("base64");
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
