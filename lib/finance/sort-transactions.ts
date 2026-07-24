type Tx = {
  type: string;
  category: string | null;
  description: string | null;
  transaction_date: string | null;
  created_at: string;
};

function txDate(t: Tx) {
  const raw = t.transaction_date || t.created_at || "";
  return raw.slice(0, 10) || "1970-01-01";
}

/** Kunci grup peristiwa (jual + HPP produk yang sama di hari yang sama) */
function eventKey(t: Tx) {
  const desc = (t.description || "")
    .replace(/^(HPP|Jual|Beli)\s+/i, "")
    .replace(/^Bahan baku produksi\s+\d+\s+pcs\s+/i, "")
    .trim()
    .toLowerCase();
  return `${txDate(t)}|${desc}`;
}

/** Urutan dalam satu grup: biaya/beli → jual → HPP */
function eventRank(t: Tx) {
  if (t.type === "pemasukan") return 2;
  if (t.category === "HPP") return 3;
  return 1;
}

/** Terbaru dulu per tanggal; dalam hari yang sama grup jual+HPP berdampingan */
export function sortBisnisTransactions<T extends Tx>(rows: T[]): T[] {
  const groupLatest = new Map<string, number>();
  for (const t of rows) {
    const key = eventKey(t);
    const ts = t.created_at ? new Date(t.created_at).getTime() : 0;
    groupLatest.set(key, Math.max(groupLatest.get(key) || 0, Number.isFinite(ts) ? ts : 0));
  }

  return [...rows].sort((a, b) => {
    const dateA = txDate(a);
    const dateB = txDate(b);
    if (dateA !== dateB) return dateB.localeCompare(dateA);

    const keyA = eventKey(a);
    const keyB = eventKey(b);
    if (keyA !== keyB) {
      return (groupLatest.get(keyB) || 0) - (groupLatest.get(keyA) || 0);
    }

    const rankDiff = eventRank(a) - eventRank(b);
    if (rankDiff !== 0) return rankDiff;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

export function formatTxDateLabel(dateStr: string | null | undefined) {
  if (!dateStr) return "Tanpa tanggal";
  const normalized = dateStr.includes("T") ? dateStr : `${dateStr}T12:00:00`;
  const d = new Date(normalized);
  if (Number.isNaN(d.getTime())) return "Tanpa tanggal";
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTxTimeWib(createdAt: string | null | undefined) {
  if (!createdAt) return "--:--";
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
