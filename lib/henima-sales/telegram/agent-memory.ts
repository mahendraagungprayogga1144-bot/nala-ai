import type { Actor } from "../types";
import type { SalesDb } from "../db";
import type { SessionMemory } from "./session";

const SECRET = /\b(sk-[a-zA-Z0-9]{8,}|bearer\s+[a-z0-9._-]{12,}|(?:api[_-]?key|token|password|secret)\s*[:=]\s*\S+)/gi;

export function redactSecrets(text: string) {
  return (text || "").replace(SECRET, "[redacted]").slice(0, 800);
}

export function compactTurns(mem: SessionMemory | undefined, user: string, topic?: string): SessionMemory {
  const safe = redactSecrets(user);
  const prior = mem?.turns || [];
  const turns = [...prior, { role: "user" as const, text: safe.slice(0, 240) }];
  let summary = mem?.summary || "";
  let kept = turns;
  if (turns.length > 8) {
    const folded = turns
      .slice(0, -4)
      .map((t) => `${t.role}: ${t.text}`)
      .join(" | ")
      .slice(0, 400);
    summary = [summary, folded].filter(Boolean).join("\n").slice(-800);
    kept = turns.slice(-4);
  }
  return {
    lastUser: safe.slice(0, 240),
    topic: topic || mem?.topic,
    summary,
    turns: kept,
    pending: mem?.pending,
  };
}

function missingTable(err: unknown) {
  const msg = err instanceof Error ? err.message : String((err as { message?: string })?.message || err || "");
  return /Could not find the table|schema cache|module_sales_agent/i.test(msg);
}

export async function listAgentMemory(db: SalesDb, actor: Actor) {
  const { data, error } = await db
    .from("module_sales_agent_memory")
    .select("id, kind, content, created_at")
    .eq("business_id", actor.businessId)
    .eq("staff_id", actor.staffId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(12);
  if (error) {
    if (missingTable(error)) return { rows: [], missing: true as const };
    throw error;
  }
  return { rows: (data || []) as { id: string; kind: string; content: string; created_at: string }[], missing: false as const };
}

export async function saveAgentNote(db: SalesDb, actor: Actor, telegramUserId: number | null, content: string, kind = "note") {
  const clean = redactSecrets(content).trim();
  if (clean.length < 2) return { ok: false as const, message: "Catatan terlalu pendek." };
  const { error } = await db.from("module_sales_agent_memory").insert({
    business_id: actor.businessId,
    staff_id: actor.staffId,
    telegram_user_id: telegramUserId,
    kind,
    content: clean,
  });
  if (error) {
    if (missingTable(error)) {
      return { ok: false as const, message: "Memori jangka panjang belum aktif. Jalankan SQL 20261016_henima_sales_agent di Supabase." };
    }
    return { ok: false as const, message: "Catatan gagal disimpan." };
  }
  return { ok: true as const, message: "Catatan tersimpan di memori bisnis." };
}

export async function clearAgentMemory(db: SalesDb, actor: Actor) {
  const { error } = await db
    .from("module_sales_agent_memory")
    .update({ deleted_at: new Date().toISOString() })
    .eq("business_id", actor.businessId)
    .eq("staff_id", actor.staffId)
    .is("deleted_at", null);
  if (error) {
    if (missingTable(error)) return "Tabel memori belum ada.";
    return "Gagal menghapus memori.";
  }
  return "Memori jangka panjang dihapus. Riwayat sesi chat ini tetap sampai percakapan baru.";
}

export async function memoryContext(db: SalesDb, actor: Actor) {
  const listed = await listAgentMemory(db, actor);
  if (listed.missing || !listed.rows.length) return "";
  return listed.rows
    .slice(0, 6)
    .map((r) => `${r.kind}: ${r.content}`)
    .join("\n");
}

export async function createAgentTask(db: SalesDb, actor: Actor, title: string, detail?: string) {
  const clean = redactSecrets(title).trim();
  if (clean.length < 2) return "Judul tugas wajib.";
  const { data, error } = await db
    .from("module_sales_agent_tasks")
    .insert({
      business_id: actor.businessId,
      staff_id: actor.staffId,
      title: clean.slice(0, 160),
      status: "pending",
      detail: detail ? redactSecrets(detail).slice(0, 500) : null,
    })
    .select("id, title, status")
    .single();
  if (error) {
    if (missingTable(error)) return "Tabel tugas belum ada. Jalankan SQL agent di Supabase.";
    return "Tugas gagal dibuat.";
  }
  return `Tugas pending: ${data.title}`;
}

export function salesCsv(rows: { date: string; customer: string; qty: number; omzet: number; hpp: number; laba: number }[]) {
  const head = "tanggal,customer,qty,omzet,hpp,laba_kotor";
  const body = rows.map((r) =>
    [r.date, `"${r.customer.replace(/"/g, "'")}"`, r.qty, r.omzet, r.hpp, r.laba].join(","),
  );
  return [head, ...body].join("\n");
}
