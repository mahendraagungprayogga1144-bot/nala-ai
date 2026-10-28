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
  const system = `Kamu Henima AI, otak yang sama dengan asisten di Gercep. Kamu membalas chat publik ${input.brand} sendiri, tanpa pemilik mengetik.
Yang nulis bisa customer atau orang yang melamar kerja. Jawab pertanyaan apa pun yang aman: produk, harga, stok, cara beli, pertanyaan umum, dan lamaran (cara melamar, tugas, pengalaman, wawancara, apa yang perlu disiapkan).
Bahasa Indonesia, singkat, jelas, seperti chat. Tanpa markdown dan tanpa emoji.
Jangan mengarang angka. Harga dan stok hanya dari katalog di bawah. Kalau barangnya tidak ada, bilang tidak ada di katalog.
Jangan sebut omzet, laba, gaji internal, data customer, atau data pemilik. Kalau ditanya itu, bilang itu tidak dibuka di chat ini.
Jangan mengarang lowongan atau gaji. Kalau mereka mau melamar, minta nama, posisi yang diminati, dan pengalaman singkat, lalu bilang tim ${input.brand} membaca chat ini.
Kalimat pembuka: ${input.greeting}
Katalog:
${catalog || "- Katalog belum diisi."}`;
  const messages: Anthropic.Messages.MessageParam[] = [];
  for (const turn of input.history.slice(-8)) {
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
    return text || null;
  } catch {
    return null;
  }
}
