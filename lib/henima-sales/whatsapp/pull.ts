import type { SalesDb } from "../db";
import { periodRange, type PeriodKind } from "../dates";
import { listProducts } from "../staff-service";
import { buildSalesReport } from "../report-service";
import { resolveActiveFounder } from "../authz";
import { periodFromText } from "../telegram/nl-sale";
import { runDeskLoop } from "../telegram/desk-loop";
import { newDraft } from "../telegram/session";
import { fmtRp } from "../money";

export async function answerWhatsAppPull(db: SalesDb, text: string) {
  const actor = await resolveActiveFounder(db);
  if (!actor) return "Akun founder belum ada, jadi data tidak bisa ditarik.";
  const catalog = await listProducts(db, actor.businessId);
  const parsed = periodFromText(text);
  const explicitDay = /\b(hari\s+ini|today|kemarin|yesterday)\b/i.test(text);
  const kind = (parsed.period === "today" && !explicitDay ? "this_month" : parsed.period) as PeriodKind;
  const range = periodRange(kind === "custom" ? "custom" : kind, { from: parsed.from, to: parsed.to });
  const report = await buildSalesReport(db, actor, { kind: "custom", from: range.from, to: range.to });
  const looped = await runDeskLoop({
    db,
    actor,
    text,
    catalog,
    report,
    range,
    session: { state: "idle", draft: newDraft() },
  });
  const reply = looped?.effects.find((effect) => effect.type === "reply");
  const spoken = reply && reply.type === "reply" ? reply.reply.text.trim() : "";
  if (spoken) return spoken.slice(0, 3500);
  return [
    range.label,
    `Omzet ${fmtRp(report.totalRevenue)}`,
    `HPP ${fmtRp(report.hppTotal || 0)}`,
    `Biaya ${fmtRp(report.opexTotal || 0)}`,
    `Laba bersih ${fmtRp(report.profitTotal || 0)}`,
    "Ini laba operasional, bukan saldo rekening.",
  ].join("\n");
}
