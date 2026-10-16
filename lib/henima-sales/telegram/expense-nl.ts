import { calendarMonthRange, namedMonthWindow } from "../dates";
import { fmtRp } from "../money";
import { parseIdrAmountToken } from "./nl-sale";

export type ExpenseSnap = {
  id: string;
  amount: number;
  note: string;
  expenseDate: string;
  key?: string;
  before?: { amount: number; note: string; expenseDate: string };
};

export type ExpenseDraft = {
  op: "create" | "patch" | "delete" | "undo";
  key: string;
  id?: string;
  amount: number;
  note: string;
  expenseDate: string;
  before?: ExpenseSnap;
};

export type ExpensePlan =
  | { type: "none" }
  | { type: "ask"; text: string }
  | { type: "show"; text: string }
  | { type: "clarify"; text: string }
  | { type: "denied"; text: string }
  | { type: "confirm"; draft: ExpenseDraft; text: string };

const MONTH =
  "januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember|january|february|march|april|may|june|july|august|september|october|november|december";
const MONTH_INDEX: Record<string, number> = {
  januari: 1, january: 1, februari: 2, february: 2, maret: 3, march: 3, april: 4, mei: 5, may: 5,
  juni: 6, june: 6, juli: 7, july: 7, agustus: 8, august: 8, september: 9, oktober: 10, october: 10,
  november: 11, desember: 12, december: 12,
};

export function canChangeExpense(role: string, op: ExpenseDraft["op"]) {
  if (op === "create") return role === "FOUNDER" || role === "LEADER" || role === "SALES";
  return role === "FOUNDER" || role === "LEADER";
}

export function looksLikeExpenseMutation(text: string) {
  const t = (text || "").toLowerCase();
  return /\b(pengeluaran|pengluaran|biaya|opex|expense|catat|ubah|ganti|hapus|pindahkan|kembalikan|perubahan terakhir)\b/.test(t);
}

export function alreadyApplied(focus: ExpenseSnap | null | undefined, draft: ExpenseDraft) {
  if (!focus?.key || focus.key !== draft.key || !focus.id) return false;
  return focus.amount === draft.amount && focus.note === draft.note && focus.expenseDate === draft.expenseDate;
}

export function planExpenseMessage(
  text: string,
  ctx: { role: string; focus?: ExpenseSnap | null; rows?: ExpenseSnap[]; today: string },
): ExpensePlan {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  const t = raw.toLowerCase();
  if (!t || !looksLikeExpenseMutation(t)) return { type: "none" };
  if (/\b(laba|omzet|sisa|laporan|berapa)\b/.test(t) && !/\b(catat|ubah|ganti|hapus|pindahkan|pengeluaran\s+\d|biaya\s+\d)/.test(t)) {
    return { type: "none" };
  }

  if (/\b(perubahan terakhir|tampilkan perubahan)\b/.test(t)) {
    return { type: "show", text: formatLastChange(ctx.focus) };
  }

  if (/\b(batalkan perubahan|kembalikan nilai|salah input)\b/.test(t)) {
    const before = ctx.focus?.before;
    if (!ctx.focus?.id || !before) return { type: "none" };
    const draft = draftOf("undo", ctx.focus, before);
    return guard(ctx.role, confirmUndo(ctx.focus, { ...ctx.focus, ...before }), draft);
  }

  if (/\bhapus\b/.test(t) && /\b(pengeluaran|biaya|tadi|itu|terakhir)\b/.test(t)) {
    const hit = resolveTarget(t, ctx);
    if (hit.kind !== "one") return hit.plan;
    const draft = draftOf("delete", hit.row, {});
    return guard(ctx.role, confirmDelete(hit.row), draft);
  }

  if (/\b(ubah|ganti|koreksi|pindahkan|edit)\b/.test(t)) {
    const hit = resolveTarget(t, ctx);
    if (hit.kind !== "one") return hit.plan;
    const patch = readPatch(t, hit.row);
    if (patch.ask) return { type: "ask", text: patch.ask };
    const draft = draftOf("patch", hit.row, patch);
    if (draft.amount === hit.row.amount && draft.note === hit.row.note && draft.expenseDate === hit.row.expenseDate) {
      return { type: "ask", text: "Sebut yang mau diubah: nominal, kategori, atau tanggal." };
    }
    return guard(ctx.role, confirmPatch(hit.row, draft), draft);
  }

  if (/\b(lihat|daftar|cek)\b/.test(t)) return { type: "none" };

  if (/\b(catat|pengeluaran|pengluaran|biaya|opex|expense)\b/.test(t)) {
    const amount = readAmount(t);
    if (!amount) return { type: "none" };
    const when = readMonthDate(t) || (/\bkemarin\b/.test(t) ? shiftDay(ctx.today, -1) : ctx.today);
    const note = cleanupNote(raw);
    if (!note) return { type: "ask", text: "Kategorinya apa? Contoh: bensin." };
    const draft: ExpenseDraft = {
      op: "create",
      key: `create:${amount}:${note.toLowerCase()}:${when}`,
      amount,
      note,
      expenseDate: when,
    };
    return guard(ctx.role, confirmCreate(draft), draft);
  }

  return { type: "none" };
}

function guard(role: string, text: string, draft: ExpenseDraft): ExpensePlan {
  if (!canChangeExpense(role, draft.op)) {
    return { type: "denied", text: "Ubah atau hapus biaya hanya untuk founder dan leader." };
  }
  return { type: "confirm", text, draft };
}

function resolveTarget(
  t: string,
  ctx: { focus?: ExpenseSnap | null; rows?: ExpenseSnap[] },
): { kind: "one"; row: ExpenseSnap } | { kind: "plan"; plan: ExpensePlan } {
  const hint = categoryHint(t);
  const rows = ctx.rows || [];
  const referred = /\b(tadi|itu|terakhir|nya)\b/.test(t);
  const pool = hint ? rows.filter((r) => r.note.toLowerCase().includes(hint)) : rows;
  if (hint && pool.length > 1) {
    return {
      kind: "plan",
      plan: {
        type: "clarify",
        text: `Ada ${pool.length} pengeluaran ${hint}. Sebut ID-nya:\n${pool
          .slice(0, 5)
          .map((r) => `${r.id.slice(0, 8)} · ${r.expenseDate} · ${r.note} · ${fmtRp(r.amount)}`)
          .join("\n")}`,
      },
    };
  }
  if (hint && pool.length === 1) return { kind: "one", row: pool[0] };
  if (ctx.focus && (!hint || ctx.focus.note.toLowerCase().includes(hint))) return { kind: "one", row: ctx.focus };
  if (hint && ctx.focus && !ctx.focus.note.toLowerCase().includes(hint)) {
    return { kind: "plan", plan: { type: "clarify", text: `Pengeluaran terakhir bukan ${hint}. Sebut ID atau nominal yang mana.` } };
  }
  if (referred) return { kind: "plan", plan: { type: "ask", text: "Pengeluaran yang mana? Catat dulu, atau sebut kategori dan bulan." } };
  return { kind: "plan", plan: { type: "ask", text: "Pengeluaran yang mana? Sebut kategori atau ID-nya." } };
}

function categoryHint(t: string) {
  const m = t.match(/\b(?:pengeluaran|biaya)\s+([a-z]{3,20})\b/);
  if (!m) return "";
  if (/^(tadi|itu|terakhir|yang|salah|september|oktober|november|desember|januari)$/.test(m[1])) return "";
  return m[1];
}

function readPatch(t: string, row: ExpenseSnap): { amount?: number; note?: string; expenseDate?: string; ask?: string } {
  const amount = /(?:jadi|menjadi|nominal)/.test(t) ? readAmount(t) : null;
  const cat = t.match(/\b(?:ganti|ubah)(?:kan)?\s+(?:kategori(?:nya)?\s+)?(?:jadi|ke|menjadi)\s+([a-z][a-z ]{2,30})/i);
  const category = cat && !/^(rp|\d)/.test(cat[1]) && !/\brp\b|\d/.test(cat[1]) ? titleCase(cat[1].trim()) : "";
  const month = readMonthDate(t);
  const day = t.match(/\btanggal(?:nya)?\s+(?:seharusnya\s+)?(?:tanggal\s+)?(\d{1,2})\b/);
  if (/\bnominal/.test(t) && !amount) return { ask: "Nominal barunya berapa?" };
  if (/\bkategori/.test(t) && !category && !amount) return { ask: "Kategori barunya apa?" };
  if (/\b(deskripsi|keterangan)\b/.test(t) && !category) return { ask: "Deskripsi barunya apa?" };
  let expenseDate = month || undefined;
  if (day) {
    const n = Number(day[1]);
    const [y, m] = row.expenseDate.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    if (n < 1 || n > last) return { ask: `Tanggal ${n} tidak ada di bulan itu.` };
    expenseDate = `${y}-${String(m).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
  }
  return {
    amount: amount || undefined,
    note: category || undefined,
    expenseDate,
  };
}

function readAmount(t: string) {
  const rp = t.match(/\brp\.?\s*([\d.]+)/i);
  if (rp) return parseIdrAmountToken(rp[1], null);
  const suf = t.match(/([\d.,]+)\s*(rb|ribu|k|jt|juta)\b/i);
  if (suf) return parseIdrAmountToken(suf[1], suf[2]);
  const bare = t.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (!bare) return null;
  return parseIdrAmountToken(bare[1], null);
}

function readMonthDate(t: string) {
  const named = t.match(new RegExp(`\\b(${MONTH})\\s+(20\\d{2})\\b`, "i"));
  if (!named) return "";
  const month = MONTH_INDEX[named[1].toLowerCase()];
  const year = Number(named[2]);
  if (!month) return "";
  const exact = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${MONTH})\\s+(20\\d{2})\\b`, "i"));
  if (exact) {
    const win = namedMonthWindow(month, year);
    const day = Number(exact[1]);
    const last = Number(win.to.slice(8, 10));
    if (day < 1 || day > last) return "";
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  return calendarMonthRange(year, month).from;
}

function cleanupNote(raw: string) {
  const note = raw
    .replace(new RegExp(`\\b(${MONTH}|20\\d{2})\\b`, "gi"), " ")
    .replace(/\brp\.?\s*/gi, " ")
    .replace(/\b(catat|pengeluaran|pengluaran|biaya|operasional|opex|expense|sebesar|nominal|idr|buat|untuk|keperluan|hari|ini|kemarin)\b/gi, " ")
    .replace(/[\d.,]+\s*(rb|ribu|k|jt|juta)?/gi, " ")
    .replace(/[,:.-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (note.length < 2) return "";
  return titleCase(note).slice(0, 80);
}

function draftOf(op: ExpenseDraft["op"], row: ExpenseSnap, patch: { amount?: number; note?: string; expenseDate?: string }): ExpenseDraft {
  const amount = patch.amount || row.amount;
  const note = patch.note || row.note;
  const expenseDate = patch.expenseDate || row.expenseDate;
  return {
    op,
    id: row.id,
    key: `${op}:${row.id}:${amount}:${note.toLowerCase()}:${expenseDate}`,
    amount,
    note,
    expenseDate,
    before: { id: row.id, amount: row.amount, note: row.note, expenseDate: row.expenseDate },
  };
}

function confirmCreate(d: ExpenseDraft) {
  const period = calendarMonthRange(Number(d.expenseDate.slice(0, 4)), Number(d.expenseDate.slice(5, 7)));
  const assumed = d.expenseDate.endsWith("-01") ? "\nTanggal harian tidak disebut, jadi dicatat di awal bulan itu." : "";
  return [
    "Konfirmasi pengeluaran:",
    `Kategori: ${d.note}`,
    `Nominal: ${fmtRp(d.amount)}`,
    `Tanggal transaksi: ${d.expenseDate}`,
    `Periode laporan: ${period.label}`,
    assumed,
    "",
    "Simpan pengeluaran ini?",
  ].filter((line) => line !== "").join("\n");
}

function confirmPatch(row: ExpenseSnap, d: ExpenseDraft) {
  return [
    `Ubah pengeluaran ${row.id.slice(0, 8)}:`,
    `Nominal: ${fmtRp(row.amount)} → ${fmtRp(d.amount)}`,
    `Kategori: ${row.note} → ${d.note}`,
    `Tanggal: ${row.expenseDate} → ${d.expenseDate}`,
    "",
    "Simpan perubahan?",
  ].join("\n");
}

function confirmDelete(row: ExpenseSnap) {
  return [
    "Hapus pengeluaran ini?",
    `ID: ${row.id.slice(0, 8)}`,
    `${row.expenseDate} · ${row.note} · ${fmtRp(row.amount)}`,
    "",
    "Setelah dihapus, biaya ini tidak masuk laporan.",
  ].join("\n");
}

function confirmUndo(current: ExpenseSnap, previous: ExpenseSnap) {
  return [
    "Kembalikan pengeluaran ke nilai sebelumnya?",
    `${current.note} ${fmtRp(current.amount)} (${current.expenseDate})`,
    `→ ${previous.note} ${fmtRp(previous.amount)} (${previous.expenseDate})`,
  ].join("\n");
}

function formatLastChange(focus?: ExpenseSnap | null) {
  if (!focus) return "Belum ada perubahan pengeluaran di percakapan ini.";
  return `Terakhir: ${focus.id.slice(0, 8)} · ${focus.expenseDate} · ${focus.note} · ${fmtRp(focus.amount)}`;
}

function titleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

function shiftDay(ymd: string, days: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}
