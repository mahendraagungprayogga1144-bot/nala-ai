import { NextResponse } from "next/server";
import { handleFonnteWebhook } from "@/lib/office/fonnte";

export const maxDuration = 60;

export async function POST(request: Request) {
  const key = new URL(request.url).searchParams.get("key") || "";
  let payload: Record<string, unknown> = {};
  const raw = await request.text();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) payload = parsed as Record<string, unknown>;
  } catch {
    const form = new URLSearchParams(raw);
    form.forEach((value, name) => {
      payload[name] = value;
    });
  }
  try {
    const result = await handleFonnteWebhook(key, payload);
    if (result.status === 401) return NextResponse.json({ ok: false }, { status: 401 });
    if (result.status === 502) return NextResponse.json({ ok: false }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 502 });
  }
}
