type StockItem = { name: string; stock: number; min_stock: number };

const PERM_KEY = "gercep_stock_notify_enabled";
const LAST_KEY = "gercep_stock_notify_last";

export function isStockNotifyEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PERM_KEY) === "1";
}

export function setStockNotifyEnabled(on: boolean) {
  localStorage.setItem(PERM_KEY, on ? "1" : "0");
}

export async function requestStockNotifyPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") {
    setStockNotifyEnabled(true);
    return true;
  }
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  const ok = result === "granted";
  setStockNotifyEnabled(ok);
  return ok;
}

function stockAlertKey(products: StockItem[]): string {
  const habis = products.filter(p => p.stock <= 0).map(p => p.name).sort().join(",");
  const kritis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock).map(p => `${p.name}:${p.stock}`).sort().join(",");
  return `${habis}|${kritis}`;
}

export function notifyLowStockIfNeeded(products: StockItem[], businessName: string) {
  if (typeof window === "undefined" || !isStockNotifyEnabled()) return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;

  const habis = products.filter(p => p.stock <= 0);
  const kritis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);
  if (!habis.length && !kritis.length) return;

  const key = stockAlertKey(products);
  if (localStorage.getItem(LAST_KEY) === key) return;
  localStorage.setItem(LAST_KEY, key);

  const body = habis.length
    ? `${habis.length} bahan habis: ${habis.slice(0, 3).map(p => p.name).join(", ")}`
    : `${kritis.length} bahan hampir habis: ${kritis.slice(0, 3).map(p => `${p.name} (${p.stock})`).join(", ")}`;

  try {
    new Notification(`⚠️ Stok ${businessName}`, { body, icon: "/favicon.ico", tag: "gercep-stock" });
  } catch {
    /* ignore */
  }
}

export function buildStockWhatsAppText(products: StockItem[], businessName: string): string {
  const habis = products.filter(p => p.stock <= 0);
  const kritis = products.filter(p => p.stock > 0 && p.stock <= p.min_stock);
  const lines = [`⚠️ *Peringatan Stok — ${businessName}*`, ""];
  if (habis.length) {
    lines.push(`🔴 *Habis (${habis.length}):*`);
    habis.forEach(p => lines.push(`• ${p.name}`));
    lines.push("");
  }
  if (kritis.length) {
    lines.push(`🟡 *Hampir habis (${kritis.length}):*`);
    kritis.forEach(p => lines.push(`• ${p.name} — sisa ${p.stock}`));
    lines.push("");
  }
  lines.push("_Via Gercep AI — segera restock ya!_");
  return lines.join("\n");
}

export function openStockWhatsApp(products: StockItem[], businessName: string) {
  const text = buildStockWhatsAppText(products, businessName);
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
}
