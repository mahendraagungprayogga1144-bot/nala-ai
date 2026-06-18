import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: "Kamu adalah NALA, AI assistant bisnis untuk Indonesia. Bantu pengguna mengelola keuangan, inventory, penjualan, dan bisnis mereka. Jawab dalam Bahasa Indonesia yang friendly dan helpful. Selalu berikan jawaban yang konkret dan actionable.",
      messages: messages.map((m: {role: string, content: string}) => ({
        role: m.role,
        content: m.content
      }))
    }),
  });

  const data = await response.json();
  const reply = data.content?.[0]?.text || "Maaf, tidak bisa memproses pesan kamu sekarang.";
  
  return NextResponse.json({ reply });
}