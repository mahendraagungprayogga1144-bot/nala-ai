import { formatFinanceForPrompt, type FinanceSnapshot } from "../finance/calculations";
import type { MentorContextPack } from "../memory-types";

export function formatMemoryContext(pack: MentorContextPack, finance?: FinanceSnapshot | null) {
  const parts: string[] = [];
  parts.push(`Pertanyaan: ${pack.query}`);
  parts.push(`Topics: ${pack.topics.join(", ") || "—"}`);
  parts.push(`Business ID: ${pack.businessId || "tidak teridentifikasi"}`);

  if (pack.owner) {
    parts.push(
      [
        "OWNER MEMORY:",
        `vision: ${pack.owner.business_vision || "(kosong)"}`,
        `goals: ${pack.owner.long_term_goals || "(kosong)"}`,
        `communication: ${pack.owner.communication_style || "(kosong)"}`,
        `decision prefs: ${pack.owner.decision_preferences || "(kosong)"}`,
        `philosophy: ${pack.owner.business_philosophy || "(kosong)"}`,
        `risk: ${pack.owner.risk_tolerance || "(kosong)"}`,
        `working: ${pack.owner.working_preferences || "(kosong)"}`,
      ].join("\n"),
    );
  } else {
    parts.push("OWNER MEMORY: belum tersedia.");
  }

  if (pack.business) {
    const b = pack.business;
    parts.push(
      [
        "BUSINESS MEMORY:",
        `name: ${b.name}`,
        `category: ${b.category}`,
        `status: ${b.status}`,
        `description: ${b.description || "(kosong)"}`,
        `model: ${b.business_model || "(kosong)"}`,
        `products: ${b.products_services || "(kosong)"}`,
        `customers: ${b.target_customers || "(kosong)"}`,
        `channels: ${b.sales_channels || "(kosong)"}`,
        `ops: ${b.operational_structure || "(kosong)"}`,
        `goals: ${b.business_goals || b.targets || "(kosong)"}`,
        `challenges: ${b.current_challenges || "(kosong)"}`,
      ].join("\n"),
    );
  } else {
    parts.push("BUSINESS MEMORY: belum tersedia.");
  }

  if (pack.decisions.length) {
    parts.push(
      "DECISION MEMORY:\n" +
        pack.decisions
          .slice(0, 8)
          .map(
            (d) =>
              `- [${d.decision_date}] ${d.title} (${d.status})\n  expected: ${d.expected_outcome || "—"}\n  actual: ${d.actual_outcome || "—"}\n  reasoning: ${d.reasoning || "—"}`,
          )
          .join("\n"),
    );
  }

  if (pack.strategies.length) {
    parts.push(
      "STRATEGIC MEMORY:\n" +
        pack.strategies
          .slice(0, 6)
          .map((s) => `- ${s.title} (${s.status}): ${s.business_strategy || s.short_term_targets || "—"}`)
          .join("\n"),
    );
  }

  if (pack.learnings.length) {
    parts.push(
      "LEARNING MEMORY:\n" +
        pack.learnings
          .slice(0, 6)
          .map((l) => `- ${l.lesson} | evidence: ${l.evidence || "—"} | source: ${l.source}`)
          .join("\n"),
    );
  }

  if (finance) {
    parts.push("FINANCIAL SNAPSHOT (calculated from owner records only):\n" + formatFinanceForPrompt(finance));
  } else if (pack.financial.length) {
    parts.push(
      "FINANCIAL RAW RECORDS:\n" +
        pack.financial
          .slice(0, 12)
          .map(
            (f) =>
              `- ${f.metric_type} ${f.amount} ${f.currency} (${f.certainty}) @ ${f.transaction_date} source=${f.data_source}`,
          )
          .join("\n"),
    );
  }

  if (pack.missing.length) {
    parts.push("MISSING INFORMATION:\n- " + pack.missing.join("\n- "));
  }
  if (pack.sourcesUsed.length) {
    parts.push("SOURCES USED: " + pack.sourcesUsed.join(", "));
  }
  parts.push(pack.note);
  return parts.join("\n\n");
}
