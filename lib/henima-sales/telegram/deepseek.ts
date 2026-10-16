import type { ProductRow } from "../types";
import type { ReportPeriod } from "./nl-sale";
import { salesLogError } from "../log";

export type HenimaAiIntent =
  | { kind: "rekap" | "pdf"; period: ReportPeriod }
  | { kind: "nota"; query?: string }
  | { kind: "riwayat" }
  | { kind: "target" }
  | { kind: "help" }
  | { kind: "expense"; amount: number; note: string; yesterday?: boolean }
  | { kind: "expense_list"; period: ReportPeriod }
  | { kind: "sale"; text: string }
  | { kind: "unknown" };

const PERIODS = new Set<ReportPeriod>([
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "custom",
]);

export function deepseekConfigured() {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export function parseHenimaAiJson(raw: string): HenimaAiIntent | null {
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
  const kind = String(data.kind || data.type || "unknown").toLowerCase();
  const period = PERIODS.has(data.period as ReportPeriod) ? (data.period as ReportPeriod) : "today";
  if (kind === "rekap" || kind === "recap" || kind === "report") return { kind: "rekap", period };
  if (kind === "pdf" || kind === "keuangan" || kind === "finance") {
    return { kind: "pdf", period: period === "today" ? "this_month" : period };
  }
  if (kind === "nota" || kind === "invoice") return { kind: "nota", query: data.query ? String(data.query) : undefined };
  if (kind === "riwayat" || kind === "history") return { kind: "riwayat" };
  if (kind === "target") return { kind: "target" };
  if (kind === "help") return { kind: "help" };
  if (kind === "expense_list" || kind === "expenses") return { kind: "expense_list", period };
  if (kind === "expense") {
    const amount = Math.round(Number(data.amount) || 0);
    if (!(amount > 0)) return { kind: "unknown" };
    return {
      kind: "expense",
      amount,
      note: String(data.note || "Operasional").slice(0, 120),
      yesterday: Boolean(data.yesterday),
    };
  }
  if (kind === "sale") {
    const text = String(data.text || "").trim();
    if (!text) return { kind: "unknown" };
    return { kind: "sale", text };
  }
  return { kind: "unknown" };
}

export async function interpretHenimaChat(text: string, products: ProductRow[]): Promise<HenimaAiIntent | null> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return null;
  const catalog = products.map((p) => p.name).filter(Boolean).slice(0, 8).join(", ") || "Afternoon, The Distance";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);
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
        temperature: 0,
        max_tokens: 220,
        messages: [
          {
            role: "system",
            content: `Kamu parser chat sales parfum Henima. Katalog: ${catalog}.
Balas HANYA JSON valid, tanpa markdown.
kind: pdf|rekap|nota|riwayat|target|help|expense|expense_list|sale|unknown
period: today|yesterday|this_week|last_week|this_month|last_month
Keuangan/omzet/profit perusahaan → kind=pdf, period=this_month kecuali user sebut hari ini.
Pengeluaran/biaya + nominal → kind=expense, amount rupiah angka, note singkat, yesterday true jika kemarin.
Daftar biaya tanpa nominal → expense_list.
Catat penjualan → kind=sale dan text bentuk: laku QTY NAMA harga NOMINAL atas nama NAMA no NOMOR tf|qris|cash
Tidak yakin → unknown.`,
          },
          { role: "user", content: text.slice(0, 400) },
        ],
      }),
    });
    if (!res.ok) {
      salesLogError("deepseek", { status: res.status }, { status: res.status });
      return null;
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    return parseHenimaAiJson(body.choices?.[0]?.message?.content || "");
  } catch (err) {
    salesLogError("deepseek", err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
