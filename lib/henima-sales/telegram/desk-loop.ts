import type { SalesReport } from "../report-service";
import { salesLogError } from "../log";
import type { Actor, ProductRow } from "../types";
import type { SalesDb } from "../db";
import { formatCashPosition, CAPABLE_REPLY, fallbackDeskDecision, deskDecisionToEffects } from "./agent";
import { deskToolsFor, runDeskTool } from "./desk-tools";
import { mainMenuKeyboard } from "./menu";
import type { BotEffect, Session } from "./session";
import { newDraft } from "./session";

type ChatMsg = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

type ToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

const MAX_ROUNDS = 4;

function snapshotFacts(report: SalesReport, actor: Actor, catalog: ProductRow[]) {
  return [
    `role=${actor.role} nama=${actor.nama} bisnis=${actor.businessName}`,
    `snapshot ${report.range.label}: omzet=${report.totalRevenue} hpp=${report.hppTotal || 0} biaya=${report.opexTotal || 0} sisa_laba=${report.profitTotal || 0} pcs=${report.totalQty} trx=${report.totalOrders}`,
    `katalog=${catalog.map((p) => p.name).join(", ") || "Afternoon, The Distance"}`,
    "Sisa uang = laba bersih operasional (omzet-HPP-biaya), bukan rekening bank.",
  ].join("\n");
}

export async function runDeskLoop(opts: {
  db: SalesDb;
  actor: Actor;
  text: string;
  history?: string;
  catalog: ProductRow[];
  report: SalesReport;
  range: { from: string; to: string };
  session: Session;
}): Promise<{ session: Session; effects: BotEffect[] } | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  const idle: Session = { state: "idle", draft: newDraft(), memory: opts.session.memory };
  if (!key) {
    const fb = fallbackDeskDecision(opts.text, opts.report);
    return deskDecisionToEffects(fb, opts.session, opts.actor, opts.catalog, opts.range);
  }

  const tools = deskToolsFor(opts.actor);
  const messages: ChatMsg[] = [
    {
      role: "system",
      content: `Kamu asisten operasional Henima Sales, gaya Gercep OS: tegas, jelas, eksekusi. Jangan markdown. Bahasa user.
Pakai TOOLS sampai pekerjaan selesai. Jangan bilang tidak bisa kalau tool-nya ada.
Jangan mengarang angka — ambil dari tool atau snapshot.
Klarifikasi singkat hanya jika nama/nominal wajib tapi kosong.
Setelah tool sukses, konfirmasi hasil nyata.
${snapshotFacts(opts.report, opts.actor, opts.catalog)}`,
    },
  ];
  if (opts.history) messages.push({ role: "user", content: `Riwayat:\n${opts.history}` });
  messages.push({ role: "user", content: opts.text.slice(0, 800) });

  const extraEffects: BotEffect[] = [];
  let finalText = "";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const res = await fetch("https://api.deepseek.com/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "deepseek-chat",
          temperature: 0.2,
          max_tokens: 500,
          tools,
          messages,
        }),
      });
      if (!res.ok) {
        salesLogError("desk_loop", { status: res.status }, { status: res.status });
        break;
      }
      const body = (await res.json()) as {
        choices?: { message?: ChatMsg; finish_reason?: string }[];
      };
      const msg = body.choices?.[0]?.message;
      if (!msg) break;
      if (msg.content) finalText = String(msg.content).trim();
      const calls = msg.tool_calls || [];
      if (!calls.length) break;

      messages.push({ role: "assistant", content: msg.content || "", tool_calls: calls });
      for (const call of calls) {
        let parsed: unknown = {};
        try {
          parsed = JSON.parse(call.function.arguments || "{}");
        } catch {
          parsed = {};
        }
        const out = await runDeskTool(call.function.name, parsed, {
          db: opts.db,
          actor: opts.actor,
          catalog: opts.catalog,
        });
        if (out.effects?.length) extraEffects.push(...out.effects);
        messages.push({ role: "tool", tool_call_id: call.id, content: out.text.slice(0, 2500) });
      }
    }
  } catch (err) {
    salesLogError("desk_loop", err);
  } finally {
    clearTimeout(timer);
  }

  if (!finalText) {
    finalText = extraEffects.length ? "Sudah dikerjakan." : formatCashPosition(opts.report);
    if (!extraEffects.length && !opts.text) finalText = CAPABLE_REPLY;
  }

  return {
    session: idle,
    effects: [
      { type: "reply", reply: { text: finalText.slice(0, 3500), keyboard: mainMenuKeyboard(opts.actor) } },
      ...extraEffects,
    ],
  };
}
