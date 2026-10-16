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
  type ReportPeriod,
} from "./nl-sale";
import type { BotEffect, Session, SessionMemory } from "./session";
import { newDraft } from "./session";
import { applyNaturalChat } from "./fsm";
import { mainMenuKeyboard } from "./menu";
import { todayWib } from "@/lib/date";
import { addDaysYmd } from "../dates";

export type DeskAction =
  | "answer"
  | "pdf"
  | "rekap"
  | "nota"
  | "riwayat"
  | "target"
  | "team"
  | "briefing"
  | "recruit"
  | "expense"
  | "expense_list"
  | "sale"
  | "help";

export type AgentDecision = {
  action: DeskAction;
  reply: string;
  pdf?: boolean;
  period?: ReportPeriod;
  from?: string;
  to?: string;
  query?: string;
  nama?: string;
  amount?: number;
  note?: string;
  yesterday?: boolean;
  saleText?: string;
};

const ACTIONS = new Set<DeskAction>([
  "answer",
  "pdf",
  "rekap",
  "nota",
  "riwayat",
  "target",
  "team",
  "briefing",
  "recruit",
  "expense",
  "expense_list",
  "sale",
  "help",
]);

export const CAPABLE_REPLY = [
  "Siap. Bilang aja mau apa — saya kerjakan.",
  "",
  "Catat penjualan · biaya · rekrut sales",
  "Lihat sisa uang, omzet, tim, target",
  "PDF, nota, riwayat",
  "",
  "Contoh: uang sisa 3 bulan · rekrut sales Andi · nota Dimas",
].join("\n");

export function shouldAskAgent(
  text: string,
  catalog: ProductRow[],
  memory?: SessionMemory | null,
) {
  return shouldUseDeskAgent(text, catalog, memory, true);
}

export function shouldUseDeskAgent(
  text: string,
  catalog: ProductRow[],
  memory?: SessionMemory | null,
  unmatched = false,
) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (!t) return false;
  if (parseSalesChat(t, catalog).looksLikeSale) return false;
  const ops = parseOpsIntent(t);
  if (ops.type === "expense") return false;
  if (ops.type === "recruit" && ops.nama) return false;
  if (unmatched || ops.type === "none") return true;
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
  const rawAction = String(data.action || data.kind || data.type || "").toLowerCase();
  const action: DeskAction = ACTIONS.has(rawAction as DeskAction)
    ? (rawAction as DeskAction)
    : data.pdf
      ? "pdf"
      : "answer";
  const reply = String(data.reply || data.answer || data.text || "").trim();
  if (action === "answer" && reply.length < 8) return null;
  const period = data.period as ReportPeriod | undefined;
  return {
    action,
    reply: reply.slice(0, 3500),
    pdf: Boolean(data.pdf) || action === "pdf",
    period,
    from: data.from ? String(data.from) : undefined,
    to: data.to ? String(data.to) : undefined,
    query: data.query ? String(data.query) : undefined,
    nama: String(data.nama || data.name || "").trim() || undefined,
    amount: Math.round(Number(data.amount) || 0) || undefined,
    note: data.note ? String(data.note).slice(0, 120) : undefined,
    yesterday: Boolean(data.yesterday),
    saleText: data.sale_text || data.saleText ? String(data.sale_text || data.saleText) : undefined,
  };
}

export function fallbackDeskDecision(text: string, report: SalesReport): AgentDecision {
  if (looksLikeMoneyLeft(text) || looksLikeQuestion(text)) {
    return { action: "answer", reply: formatCashPosition(report) };
  }
  return { action: "answer", reply: CAPABLE_REPLY };
}

export function deskDecisionToEffects(
  decision: AgentDecision,
  session: Session,
  actor: Actor,
  catalog: ProductRow[],
  range: { from: string; to: string },
): { session: Session; effects: BotEffect[] } {
  const idle: Session = { state: "idle", draft: newDraft(), memory: session.memory };
  const spoken: BotEffect[] = decision.reply
    ? [{ type: "reply", reply: { text: decision.reply, keyboard: mainMenuKeyboard(actor) } }]
    : [];
  const period = decision.period || "custom";
  switch (decision.action) {
    case "pdf":
      return {
        session: idle,
        effects: [...spoken, { type: "send_pdf", kind: period, from: decision.from || range.from, to: decision.to || range.to }],
      };
    case "rekap":
      return {
        session: idle,
        effects: [...spoken, { type: "send_report", kind: period, from: decision.from || range.from, to: decision.to || range.to }],
      };
    case "briefing":
      return {
        session: idle,
        effects: [
          ...spoken,
          {
            type: "send_briefing",
            query: decision.query,
            kind: period,
            from: decision.from || range.from,
            to: decision.to || range.to,
          },
        ],
      };
    case "nota":
      return { session: idle, effects: [...spoken, { type: "send_nota", query: decision.query }] };
    case "riwayat":
      return { session: idle, effects: [...spoken, { type: "send_riwayat" }] };
    case "target":
      return { session: idle, effects: [...spoken, { type: "send_target" }] };
    case "team":
      return { session: idle, effects: [...spoken, { type: "send_team" }] };
    case "help":
      return applyNaturalChat(session, actor, "help", catalog);
    case "recruit":
      return decision.nama
        ? { session: idle, effects: [...spoken, { type: "recruit_sales", nama: decision.nama }] }
        : applyNaturalChat(session, actor, "rekrut sales", catalog);
    case "expense":
      if (!(decision.amount && decision.amount > 0)) {
        return { session: idle, effects: spoken.length ? spoken : [{ type: "reply", reply: { text: CAPABLE_REPLY, keyboard: mainMenuKeyboard(actor) } }] };
      }
      return {
        session: idle,
        effects: [
          {
            type: "save_expense",
            amount: decision.amount,
            note: decision.note || "Operasional",
            expenseDate: decision.yesterday ? addDaysYmd(todayWib(), -1) : todayWib(),
          },
        ],
      };
    case "expense_list":
      return {
        session: idle,
        effects: [...spoken, { type: "send_expenses", kind: period, from: decision.from || range.from, to: decision.to || range.to }],
      };
    case "sale":
      return applyNaturalChat(session, actor, decision.saleText || decision.reply || "", catalog);
    case "answer":
    default: {
      const extra: BotEffect[] = decision.pdf
        ? [{ type: "send_pdf", kind: period, from: decision.from || range.from, to: decision.to || range.to }]
        : [];
      return {
        session: idle,
        effects: [
          ...(spoken.length
            ? spoken
            : [{ type: "reply" as const, reply: { text: CAPABLE_REPLY, keyboard: mainMenuKeyboard(actor) } }]),
          ...extra,
        ],
      };
    }
  }
}

export async function askHenimaAgent(opts: {
  text: string;
  actor: Actor;
  report: SalesReport;
  history?: string;
  catalog?: ProductRow[];
}): Promise<AgentDecision | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  const fallback = fallbackDeskDecision(opts.text, opts.report);
  if (!key) return fallback;
  const r = opts.report;
  const catalog = (opts.catalog || []).map((p) => p.name).filter(Boolean).slice(0, 8).join(", ") || "Afternoon, The Distance";
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
    `role=${opts.actor.role} nama=${opts.actor.nama}`,
    `katalog=${catalog}`,
    r.ranking.slice(0, 8).map((s) => `${s.nama}:${s.qty}pcs:${s.revenue}`).join("; "),
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
        temperature: 0.15,
        max_tokens: 480,
        messages: [
          {
            role: "system",
            content: `You are Henima Sales company desk. Execute what the user asked. Any language.
Tools/actions: answer, pdf, rekap, nota, riwayat, target, team, briefing, recruit, expense, expense_list, sale, help.
Use ONLY provided facts for numbers. Never invent money.
Sisa uang = laba bersih operasional (omzet-HPP-biaya), not a bank balance.
Follow-ups inherit the previous ask (e.g. "3 months" after leftover cash).
JSON only:
{"action":"answer","reply":"...","pdf":false,"period":"this_month","query":"","nama":"","amount":0,"note":"","yesterday":false,"sale_text":""}
action=answer → speak the result from facts.
action=pdf/rekap/briefing → also set period.
action=nota → query=customer name.
action=recruit → nama.
action=expense → amount IDR + note.
action=sale → sale_text like: laku 1 afternoon 130000 atas nama Sinta no 08.. qris
If they greet or ask what you can do → help or answer with a short capable list.`,
          },
          {
            role: "user",
            content: [
              opts.history ? `Riwayat:\n${opts.history}` : "",
              `Angka & konteks:\n${facts}`,
              `Perintah: ${opts.text}`,
            ]
              .filter(Boolean)
              .join("\n\n")
              .slice(0, 2800),
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
