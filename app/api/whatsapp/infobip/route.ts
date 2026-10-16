import { after, NextResponse } from "next/server";
import { salesDb } from "@/lib/henima-sales/db";
import { salesLog, salesLogError } from "@/lib/henima-sales/log";
import { normalizePhoneId } from "@/lib/henima-sales/phone";
import { infobipMonitorReady, sendWhatsAppText } from "@/lib/henima-sales/whatsapp/infobip";
import { answerWhatsAppPull } from "@/lib/henima-sales/whatsapp/pull";

export const maxDuration = 30;

type Inbound = {
  results?: {
    from?: string;
    to?: string;
    messageId?: string;
    message?: { type?: string; text?: string };
  }[];
};

export async function POST(request: Request) {
  if (!infobipMonitorReady()) {
    return NextResponse.json({ error: "WhatsApp monitor not configured" }, { status: 503 });
  }
  const secret = process.env.INFOBIP_WEBHOOK_SECRET?.trim();
  if (secret && request.headers.get("x-infobip-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: Inbound;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const founder = normalizePhoneId(process.env.INFOBIP_WA_TO || "");
  const inbound = (body.results || []).flatMap((row) => {
    const from = normalizePhoneId(row.from || "");
    const text = row.message?.text?.trim();
    if (!from || from !== founder || !text) return [];
    return [{ from, text, messageId: row.messageId }];
  });
  if (inbound.length) {
    after(async () => {
      for (const row of inbound) {
        salesLog("infobip_inbound", { messageId: row.messageId });
        try {
          const answer = await answerWhatsAppPull(salesDb(), row.text, row.messageId);
          if (answer.trim()) await sendWhatsAppText(row.from, answer);
        } catch (err) {
          salesLogError("infobip_reply", err);
        }
      }
    });
  }
  return NextResponse.json({ ok: true });
}
