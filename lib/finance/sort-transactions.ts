type Tx = {
  type: string;
  category: string | null;
  description: string | null;
  transaction_date: string | null;
  created_at: string;
};

function txDate(t: Tx) {
  return t.transaction_date || t.created_at.slice(0, 10);
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
    const ts = new Date(t.created_at).getTime();
    groupLatest.set(key, Math.max(groupLatest.get(key) || 0, ts));
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

export function formatTxDateLabel(dateStr: string) {
  return new Date(dateStr + (dateStr.includes("T") ? "" : "T12:00:00")).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function formatTxTimeWib(createdAt: string) {
  return new Date(createdAt).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  });
}
