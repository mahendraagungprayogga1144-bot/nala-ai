import Anthropic from "@anthropic-ai/sdk";

type CatalogItem = { name: string; price: number | null; stock: number };
type Turn = { direction: "in" | "out"; body: string };

function rp(amount: number) {
  return `Rp${Math.round(amount).toLocaleString("id-ID")}`;
}

function tidy(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/[*_`#]+/g, "")
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 1400);
}

function isCanned(text: string) {
  return /ketik katalog|saya balas otomatis/i.test(text);
}

export async function answerPublicWa(input: {
  brand: string;
  greeting: string;
  products: CatalogItem[];
  history: Turn[];
  question: string;
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const catalog = input.products
    .slice(0, 15)
    .map((item) => {
      const price = item.price != null ? rp(item.price) : "harga belum diisi";
      const ready = item.stock > 0 ? `stok ${item.stock}` : "habis";
      return `- ${item.name}: ${price}, ${ready}`;
    })
    .join("\n");
  const tone = input.greeting && !isCanned(input.greeting) ? `Nada yang pemilik mau: ${input.greeting}` : "";
  const system = `Kamu Henima AI, orang yang membalas WhatsApp ${input.brand}. Kamu fleksibel seperti chat Henima AI di Gercep, bukan menu otomatis.
Jawaban bahasa Indonesia, hangat, singkat, seperti orang yang sedang chat. Tanpa markdown dan tanpa emoji.
Customer boleh nanya apa saja: rekomendasi parfum, harga, stok, cara beli, hadiah, acara, atau lamaran kerja. Jawab langsung sesuai pertanyaannya.
Kalau mereka minta rekomendasi, pilih 1 sampai 3 parfum dari katalog yang paling masuk akal, sebut harga dan stoknya, lalu jelaskan singkat kenapa cocok. Jangan suruh mereka mengetik kata kunci.
Harga dan stok hanya boleh dari katalog. Jangan mengarang produk, harga, atau stok. Kalau katalog kosong, bilang katalog belum diisi dan tetap bantu pertanyaannya yang lain.
Orang yang melamar kerja boleh nanya tugas, cara melamar, atau pengalaman. Jangan mengarang lowongan atau gaji. Minta nama, posisi yang diminati, dan pengalaman singkat, lalu bilang tim ${input.brand} membaca chat ini.
Jangan sebut omzet, laba, gaji internal, atau data customer.
Jangan pernah membalas dengan kalimat "ketik katalog, harga, atau stok".
${tone}
Katalog:
${catalog || "- Katalog belum diisi."}`;
  const messages: Anthropic.Messages.MessageParam[] = [];
  for (const turn of input.history.slice(-8)) {
    if (turn.direction === "out" && isCanned(turn.body)) continue;
    const role = turn.direction === "out" ? "assistant" : "user";
    const content = turn.body.trim().slice(0, 500);
    if (!content) continue;
    const last = messages[messages.length - 1];
    if (last && last.role === role) continue;
    messages.push({ role, content });
  }
  if (messages[0]?.role === "assistant") messages.shift();
  if (messages[messages.length - 1]?.role === "user") messages.pop();
  messages.push({ role: "user", content: input.question.trim().slice(0, 500) });
  try {
    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 700,
      system,
      messages,
    });
    const text = tidy(
      response.content
        .filter((block) => block.type === "text")
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("\n"),
    );
    if (!text || isCanned(text)) return null;
    return text;
  } catch {
    return null;
  }
}
