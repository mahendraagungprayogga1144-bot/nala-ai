import type { Actor, ProductRow } from "../types";
import type { SalesReport } from "../report-service";
import { fmtRp } from "../money";
import { salesLogError } from "../log";
import {
  isPeriodOnly,
  looksLikeFollowUp,
  looksLikeMoneyLeft,
  looksLikeQuestion,
  parseSalesChat,
  parseOpsIntent,
} from "./nl-sale";
import type { SessionMemory } from "./session";

export type AgentDecision = {
  reply: string;
  pdf?: boolean;
  kind?: string;
  from?: string;
  to?: string;
};

export function shouldAskAgent(
  text: string,
  catalog: ProductRow[],
  memory?: SessionMemory | null,
) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (parseSalesChat(t, catalog).looksLikeSale) return false;
  const ops = parseOpsIntent(t);
  if (ops.type === "expense" || ops.type === "recruit") return false;
  if (ops.type === "nota" || ops.type === "riwayat" || ops.type === "target" || ops.type === "help") return false;
  if (ops.type === "pdf" && !looksLikeMoneyLeft(t) && !isPeriodOnly(t) && !looksLikeFollowUp(t, memory?.lastUser)) {
    return false;
  }
  if (looksLikeQuestion(t) || looksLikeMoneyLeft(t) || isPeriodOnly(t)) return true;
  if (looksLikeFollowUp(t, memory?.lastUser)) return true;
  return false;
}

export function formatCashPosition(report: SalesReport) {
  const sisa = report.profitTotal || 0;
  return [
    "POSISI UANG OPERASIONAL",
    report.range.label,
    "Bukan saldo rekening bank — ini omzet dikurangi HPP dan biaya.",
    "",
    `Omzet penjualan   ${fmtRp(report.totalRevenue)}`,
    `HPP               ${fmtRp(report.hppTotal || 0)}`,
    `Laba kotor        ${fmtRp(report.grossProfit ?? report.totalRevenue - (report.hppTotal || 0))}`,
    `Biaya operasional ${fmtRp(report.opexTotal || 0)}`,
    `Sisa / laba bersih ${fmtRp(sisa)}`,
    "",
    `${report.totalQty} pcs · ${report.totalOrders} transaksi`,
  ].join("\n");
}

export function parseAgentJson(raw: string): AgentDecision | null {
  const trimmed = (raw || "").trim();
  if (!trimmed) return null;
  const jsonText = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(jsonText) as Record<string, unknown>;
  } catch {
    const m = jsonText.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      data = JSON.parse(m[0]) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  const reply = String(data.reply || data.answer || data.text || "").trim();
  if (reply.length < 8) return null;
  return {
    reply: reply.slice(0, 3500),
    pdf: Boolean(data.pdf),
  };
}

export async function askHenimaAgent(opts: {
  text: string;
  actor: Actor;
  report: SalesReport;
  history?: string;
}): Promise<AgentDecision | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  const fallback = { reply: formatCashPosition(opts.report) };
  if (!key) return fallback;
  const r = opts.report;
  const facts = [
    `periode=${r.range.label} (${r.range.from}..${r.range.to})`,
    `omzet=${r.totalRevenue}`,
    `hpp=${r.hppTotal || 0}`,
    `laba_kotor=${r.grossProfit ?? 0}`,
    `biaya=${r.opexTotal || 0}`,
    `laba_bersih_sisa=${r.profitTotal || 0}`,
    `pcs=${r.totalQty}`,
    `transaksi=${r.totalOrders}`,
    `scope=${r.scopeLabel}`,
    r.ranking.slice(0, 6).map((s) => `${s.nama}:${s.qty}pcs:${s.revenue}`).join("; "),
  ].join("\n");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: "deepseek-chat",
        temperature: 0.2,
        max_tokens: 420,
        messages: [
          {
            role: "system",
            content: `You are Henima's company desk assistant on Telegram. Speak like a sharp operator: short, warm, Indonesian unless the user wrote another language.
Use ONLY the provided facts. Never invent numbers.
"Sisa uang" = laba bersih operasional (omzet − HPP − biaya), NOT a bank balance. Say that once, plainly.
If the user follows up with a period (e.g. 3 months), answer for that period.
Reply ONLY JSON: {"reply":"...","pdf":false}
pdf=true only if they asked for a file/laporan.`,
          },
          {
            role: "user",
            content: [
              opts.history ? `Riwayat:\n${opts.history}` : "",
              `Angka:\n${facts}`,
              `User (${opts.actor.role} ${opts.actor.nama}): ${opts.text}`,
            ]
              .filter(Boolean)
              .join("\n\n")
              .slice(0, 2500),
          },
        ],
      }),
    });
    if (!res.ok) {
      salesLogError("henima_agent", { status: res.status }, { status: res.status });
      return fallback;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseAgentJson(body.choices?.[0]?.message?.content || "") || fallback;
  } catch (err) {
    salesLogError("henima_agent", err);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}
