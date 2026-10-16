import type { SalesReport } from "../report-service";
import { salesLogError } from "../log";
import type { Actor, ProductRow } from "../types";
import type { SalesDb } from "../db";
import { formatCashPosition, CAPABLE_REPLY, fallbackDeskDecision, deskDecisionToEffects, greetingReply } from "./agent";
import { deskToolsFor, runDeskTool } from "./desk-tools";
import { mainMenuKeyboard } from "./menu";
import { looksLikeChitchat, looksLikeHowTo, needsCompanyData } from "./nl-sale";
import type { BotEffect, Session } from "./session";
import { newDraft } from "./session";

type ChatMsg = { role: string; content?: string | null; tool_calls?: ToolCall[]; tool_call_id?: string };

type ToolCall = {
  id: string;
  type: string;
  function: { name: string; arguments: string };
};

const MAX_ROUNDS = 4;

function snapshotFacts(report: SalesReport | null, actor: Actor, catalog: ProductRow[], chitchat: boolean) {
  const lines = [
    `role=${actor.role} nama=${actor.nama} bisnis=${actor.businessName}`,
    `katalog=${catalog.map((p) => p.name).join(", ") || "Afternoon, The Distance"}`,
  ];
  if (!chitchat && report) {
    lines.push(
      `snapshot ${report.range.label}: omzet=${report.totalRevenue} hpp=${report.hppTotal || 0} biaya=${report.opexTotal || 0} sisa_laba=${report.profitTotal || 0} pcs=${report.totalQty} trx=${report.totalOrders}`,
      "Sisa uang = laba bersih operasional (omzet-HPP-biaya), bukan rekening bank. Jangan sebut angka ini kecuali user minta.",
    );
  }
  return lines.join("\n");
}

export async function runDeskLoop(opts: {
  db: SalesDb;
  actor: Actor;
  text: string;
  history?: string;
  longMemory?: string;
  telegramUserId?: number | null;
  catalog: ProductRow[];
  report: SalesReport;
  range: { from: string; to: string };
  session: Session;
}): Promise<{ session: Session; effects: BotEffect[] } | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  const idle: Session = { state: "idle", draft: newDraft(), memory: opts.session.memory };
  const chitchat = looksLikeChitchat(opts.text);
  const howTo = looksLikeHowTo(opts.text);
  const talk = chitchat || howTo || !needsCompanyData(opts.text);
  if (!key) {
    const fb = fallbackDeskDecision(opts.text, opts.report, opts.actor);
    return deskDecisionToEffects(fb, opts.session, opts.actor, opts.catalog, opts.range);
  }

  const tools = deskToolsFor(opts.actor);
  const messages: ChatMsg[] = [
    {
      role: "system",
      content: `Kamu asisten pribadi founder Henima. Ngobrol natural dulu: ide, strategi, masalah, brainstorm, tulisan. Jangan markdown. Bahasa user.
Jangan mengarahkan setiap chat ke omzet atau laporan. Panggil TOOLS hanya jika user minta data live, file, tugas, atau ubah perusahaan.
Kalau user bertanya apakah suatu pekerjaan bisa dilakukan, jawab iya atau tidak, lalu minta detail yang kurang. Jangan balas daftar kosong.
Jangan mengarang angka. Jangan bilang pekerjaan eksternal selesai kalau tidak ada tool-nya. Shell dan SSH tidak tersedia.
${snapshotFacts(talk ? null : opts.report, opts.actor, opts.catalog, talk)}
${opts.longMemory ? `Memori bisnis:\n${opts.longMemory}` : ""}
${opts.session.memory?.summary ? `Ringkasan chat lama:\n${opts.session.memory.summary}` : ""}`,
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
          temperature: talk ? 0.5 : 0.2,
          max_tokens: talk ? 700 : 500,
          ...(chitchat || howTo ? {} : { tools, tool_choice: "auto" }),
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
          telegramUserId: opts.telegramUserId,
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
    if (chitchat) finalText = greetingReply(opts.actor);
    else if (extraEffects.length) finalText = "Sudah dikerjakan.";
    else if (talk) finalText = "Aku di sini. Cerita idenya, atau kasih tugas yang mau dikerjakan.";
    else finalText = formatCashPosition(opts.report);
  }

  return {
    session: idle,
    effects: [
      { type: "reply", reply: { text: finalText.slice(0, 3500), keyboard: mainMenuKeyboard(opts.actor) } },
      ...extraEffects,
    ],
  };
}
