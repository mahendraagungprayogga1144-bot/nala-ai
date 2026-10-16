import * as XLSX from "xlsx";
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

export type TaskStatus = "pending" | "running" | "completed" | "failed";

export function taskAfterWork(ok: boolean): TaskStatus {
  return ok ? "completed" : "failed";
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  pending: "MENUNGGU",
  running: "DIKERJAKAN",
  completed: "SELESAI",
  failed: "GAGAL",
};

export function formatTaskBoard(
  rows: { id: string; title: string; status: string; created_at?: string; detail?: string | null }[],
) {
  if (!rows.length) return "Belum ada tugas. Ketik: buat tugas nama pekerjaan";
  return [
    "TUGAS",
    ...rows.map((r) => {
      const status = STATUS_LABEL[r.status as TaskStatus] || r.status;
      const when = (r.created_at || "").slice(0, 16).replace("T", " ");
      const hasil = r.detail ? `\n   ${r.detail}` : "";
      return `${status} · ${r.id.slice(0, 8)} · ${r.title}${when ? ` · ${when}` : ""}${hasil}`;
    }),
  ].join("\n");
}

export async function createAgentTask(db: SalesDb, actor: Actor, title: string, detail?: string, status: TaskStatus = "pending") {
  const clean = redactSecrets(title).trim();
  if (clean.length < 2) return { ok: false as const, text: "Judul tugas wajib." };
  const { data, error } = await db
    .from("module_sales_agent_tasks")
    .insert({
      business_id: actor.businessId,
      staff_id: actor.staffId,
      title: clean.slice(0, 160),
      status,
      detail: detail ? redactSecrets(detail).slice(0, 500) : null,
      updated_at: new Date().toISOString(),
    })
    .select("id, title, status, created_at, detail")
    .single();
  if (error || !data) {
    if (missingTable(error)) return { ok: false as const, text: "Tabel tugas belum ada. Jalankan SQL agent di Supabase." };
    return { ok: false as const, text: "Tugas gagal dibuat." };
  }
  return { ok: true as const, id: String(data.id), text: formatTaskBoard([data]) };
}

export async function listAgentTasks(db: SalesDb, actor: Actor) {
  const { data, error } = await db
    .from("module_sales_agent_tasks")
    .select("id, title, status, created_at, detail")
    .eq("business_id", actor.businessId)
    .eq("staff_id", actor.staffId)
    .order("created_at", { ascending: false })
    .limit(8);
  if (error) {
    if (missingTable(error)) return { missing: true as const, text: "Tabel tugas belum ada. Jalankan SQL agent di Supabase." };
    return { missing: false as const, text: "Daftar tugas gagal dibaca." };
  }
  return { missing: false as const, text: formatTaskBoard(data || []) };
}

export async function setAgentTaskStatus(
  db: SalesDb,
  actor: Actor,
  idPrefix: string,
  status: TaskStatus,
  result?: string,
) {
  const key = idPrefix.trim().toLowerCase();
  if (key.length < 4) return "ID tugas terlalu pendek.";
  const { data: rows, error } = await db
    .from("module_sales_agent_tasks")
    .select("id, title, status, created_at, detail")
    .eq("business_id", actor.businessId)
    .eq("staff_id", actor.staffId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    if (missingTable(error)) return "Tabel tugas belum ada.";
    return "Status tugas gagal diubah.";
  }
  const hit = (rows || []).find((r) => String(r.id).toLowerCase().startsWith(key) || String(r.title).toLowerCase().includes(key));
  if (!hit) return "Tugas tidak ketemu. Ketik: lihat tugas";
  const stored = status;
  const { error: upd } = await db
    .from("module_sales_agent_tasks")
    .update({
      status: stored,
      detail: result ? redactSecrets(result).slice(0, 500) : hit.detail,
      updated_at: new Date().toISOString(),
    })
    .eq("id", hit.id)
    .eq("business_id", actor.businessId);
  if (upd) return "Status tugas gagal disimpan.";
  return formatTaskBoard([{ ...hit, status: stored, detail: result || hit.detail }]);
}

export type SheetRow = { date: string; customer: string; qty: number; omzet: number; hpp: number; laba: number };

export function salesCsv(rows: SheetRow[]) {
  const head = "tanggal,customer,qty,omzet,hpp,laba_kotor";
  const body = rows.map((r) =>
    [r.date, `"${r.customer.replace(/"/g, "'")}"`, r.qty, r.omzet, r.hpp, r.laba].join(","),
  );
  return [head, ...body].join("\n");
}

export function salesXlsxBase64(rows: SheetRow[]) {
  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      Tanggal: r.date,
      Customer: r.customer,
      Qty: r.qty,
      Omzet: r.omzet,
      HPP: r.hpp,
      "Laba kotor": r.laba,
    })),
  );
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Penjualan");
  const out = XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return Buffer.from(out).toString("base64");
}
