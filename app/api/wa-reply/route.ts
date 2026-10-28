import { NextResponse } from "next/server";
import { publicWaMessages, replyOnWaLink } from "@/lib/office/wa-reply";

export const maxDuration = 60;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const messages = await publicWaMessages(url.searchParams.get("token") || "", url.searchParams.get("visitor") || "");
  return NextResponse.json({ messages });
}

export async function POST(request: Request) {
  let body: { token?: string; visitor?: string; text?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Permintaan tidak valid." }, { status: 400 });
  }
  const result = await replyOnWaLink(String(body.token || ""), String(body.visitor || ""), String(body.text || ""));
  if (!result.ok) return NextResponse.json({ message: result.message }, { status: 400 });
  return NextResponse.json({ reply: result.reply });
}
