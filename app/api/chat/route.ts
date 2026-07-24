import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  directKasirAnswer,
  fetchKasirChatSnapshot,
  isKasirQuestion,
  kasirSnapshotToContext,
} from "@/lib/chat/kasir-snapshot";
import { CHAT_TOOLS, runChatTool, type ChatBiz } from "@/lib/chat/tools";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_TOOL_ROUNDS = 6;

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages: chatHistory, context } = await req.json();

  const cookieStore = await cookies();
  const activeBusinessId = cookieStore.get("active_business_id")?.value;

  const { data: businessesRaw } = await supabase
    .from("businesses")
    .select("id, type, name")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const businesses = (businessesRaw || []) as ChatBiz[];
  const business = businesses.find((b) => b.id === activeBusinessId) || businesses[0] || null;
  const businessId = business?.id;
  const kulinerBusiness = businesses.find((b) => b.type === "kuliner") || null;
  const kasirBusinessId = business?.type === "kuliner" ? businessId : kulinerBusiness?.id;
  const kasirBusinessName = business?.type === "kuliner" ? business?.name : kulinerBusiness?.name;
  const isPertanian = business?.type === "pertanian" || context === "pertanian";
  const unitLabel = isPertanian ? "kg" : "pcs";

  const productQuery = supabase
    .from("products")
    .select("name, stock, min_stock, price, cost, category")
    .eq("user_id", user.id);
  if (businessId) productQuery.eq("business_id", businessId);
  const { data: products } = await productQuery;

  let agriContext = "";
  if (isPertanian && businessId) {
    const [{ data: fields }, { data: costs }] = await Promise.all([
      supabase.from("agri_fields").select("nama_lahan, luas_lahan, jenis_tanaman, status").eq("business_id", businessId),
      supabase.from("agri_production_costs").select("kategori, jumlah").eq("business_id", businessId),
    ]);
    agriContext = `\nKonteks pertanian: Lahan=${JSON.stringify(fields || [])}. Biaya produksi=${JSON.stringify(costs || [])}.`;
  }

  const productContext =
    products && products.length > 0
      ? `Daftar stok/inventory user saat ini: ${JSON.stringify(products)}${agriContext}`
      : `User belum punya produk apapun di sistem.${agriContext}`;

  let kulinerContext = "";
  let kasirSnapshot = null;
  if (kasirBusinessId && kasirBusinessName) {
    kasirSnapshot = await fetchKasirChatSnapshot(supabase, kasirBusinessId, kasirBusinessName);
    kulinerContext = kasirSnapshotToContext(kasirSnapshot);
  }

  const lastUserMsg = [...chatHistory].reverse().find((m: { role: string }) => m.role === "user");
  if (kasirSnapshot && lastUserMsg && isKasirQuestion(chatHistory)) {
    const quick = directKasirAnswer(kasirSnapshot, lastUserMsg.content);
    if (quick) {
      return NextResponse.json({ reply: quick });
    }
  }

  const pertanianPrompt = isPertanian
    ? `
Kamu juga ahli pertanian Indonesia. Bantu hitung estimasi keuntungan panen, kebutuhan pupuk/pestisida, waktu panen, HPP, margin, dan rekomendasi komoditas.
Satuan default untuk stok pertanian adalah kg/ton/karung, BUKAN pcs.
`
    : "";

  const bizList = businesses.map((b) => `${b.name} (${b.type || "-"})`).join(", ") || "belum ada";
  const activeLabel = business ? `${business.name} (${business.type || "-"})` : "belum dipilih";

  const system = `Kamu adalah Gercep AI — asisten operasional UMKM Indonesia yang andal. Gaya: tegas, singkat, langsung eksekusi. JANGAN pakai markdown (bintang/bold). Maksimal 1 emoji kalau perlu.

Bisnis user: ${bizList}. Bisnis aktif sekarang: ${activeLabel}.
${pertanianPrompt}

KAMU PUNYA TOOLS — pakai sampai pekerjaan selesai, jangan bilang "nggak bisa" kalau tool-nya ada:
- catat_transaksi → catat pemasukan/pengeluaran keuangan pribadi/bisnis
- kelola_stok → produk inventory (bukan menu F&B)
- buat_menu_kasir → INPUT/UPDATE MENU yang muncul di Kasir F&B (nasi goreng, es teh, dll). Ini yang dipakai kalau user minta "input menu ke kasir"
- list_menu_kasir → cek menu yang sudah ada
- lihat_keuangan → lihat transaksi terbaru
- list_bisnis → cek bisnis aktif

Aturan:
1. Kalau user minta catat uang/jasa/pemasukan/pengeluaran → WAJIB panggil catat_transaksi (jangan cuma janji).
2. Kalau user minta input/tambah MENU ke kasir → WAJIB panggil buat_menu_kasir (bukan kelola_stok).
3. Kalau user minta stok produk biasa (bukan menu hidangan) → kelola_stok.
4. Scope PRIBADI vs BISNIS: rumah/pribadi/keluarga = pribadi; jual/toko/usaha/jasa bisnis = bisnis. Kalau ambigu, tanya singkat.
5. Setelah tool sukses, konfirmasi hasil nyata (angka/nama). Kalau tool gagal, sampaikan pesan error tool apa adanya.
6. Jangan bilang kamu tidak punya akses ke kasir/menu kalau tools di atas tersedia.

Stok inventory (baca saja): ${productContext}
${
  kulinerContext
    ? `DATA KASIR REAL-TIME (untuk pertanyaan omzet/order):${kulinerContext}`
    : "Belum ada bisnis kuliner — buat_menu_kasir akan bilang kalau belum siap."
}`;

  type Msg = Anthropic.Messages.MessageParam;
  const messages: Msg[] = Array.isArray(chatHistory) ? [...chatHistory] : [];

  const toolCtx = {
    supabase,
    userId: user.id,
    business,
    businesses,
    unitLabel,
    isPertanian,
  };

  let finalText = "";
  let didMutate = false;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system,
      tools: CHAT_TOOLS,
      messages,
    });

    const toolUses = response.content.filter((b) => b.type === "tool_use");
    const texts = response.content.filter((b) => b.type === "text");
    if (texts.length) {
      finalText = texts.map((t) => (t.type === "text" ? t.text : "")).join("\n").trim();
    }

    if (response.stop_reason !== "tool_use" || toolUses.length === 0) {
      break;
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const block of toolUses) {
      if (block.type !== "tool_use") continue;
      const result = await runChatTool(block.name, block.input, toolCtx);
      if (
        block.name === "catat_transaksi" ||
        block.name === "kelola_stok" ||
        block.name === "buat_menu_kasir"
      ) {
        didMutate = true;
      }
      toolResults.push({
        type: "tool_result",
        tool_use_id: block.id,
        content: result,
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  if (!finalText) {
    finalText = didMutate
      ? "Sudah dikerjakan. Cek Kasir / Keuangan / Inventory sesuai permintaanmu."
      : "Bisa diulang lebih spesifik? Contoh: catat pemasukan 1 juta jasa, atau buat menu Nasi Goreng harga 20rb HPP 10rb stok 20.";
  }

  return NextResponse.json({
    reply: finalText,
    transaction: didMutate ? { ok: true } : null,
  });
}
