import { fmtRp } from "../money";
import { parseIdrAmountToken } from "./nl-sale";
import type { TargetPeriod } from "../types";

export type SaleSnap = {
  id: string;
  total: number;
  qty: number;
  product: string;
  items: number;
};

export type ProductSnap = { id: string; name: string; price: number; stock: number };

export type WorkDraft = {
  kind: "sale_total" | "sale_delete" | "stock" | "catalog_price" | "target" | "expense_restore";
  key: string;
  id: string;
  label: string;
  next: number;
  before: number;
  period?: TargetPeriod;
  note?: string;
  expenseDate?: string;
};

export type WorkPlan =
  | { type: "none" }
  | { type: "say"; text: string }
  | { type: "confirm"; draft: WorkDraft; text: string };

export function looksLikeWorkEdit(text: string) {
  const t = (text || "").toLowerCase();
  if (/\b(saldo rekening|rekening bank|kirim whatsapp|whatsapp blast|ssh|shell|deploy server|ubah server)\b/.test(t)) return true;
  if (/\b(kembalikan nilai|batalkan perubahan)\b/.test(t)) return true;
  return (
    /\b(ubah|ganti|koreksi|hapus|jadi|menjadi)\b/.test(t) &&
    /\b(closing|penjualan|transaksi|stok|harga|target)\b/.test(t)
  );
}

export function planWorkMessage(
  text: string,
  ctx: {
    role: string;
    sales?: SaleSnap[];
    products?: ProductSnap[];
    focusSale?: SaleSnap | null;
  },
): WorkPlan {
  const raw = (text || "").replace(/\s+/g, " ").trim();
  const t = raw.toLowerCase();
  if (!t) return { type: "none" };

  if (/\b(saldo rekening|rekening bank)\b/.test(t)) {
    return {
      type: "say",
      text: "Saldo rekening belum terhubung. Angka sisa uang di sini adalah laba operasional: omzet dikurangi HPP dan biaya, bukan saldo bank.",
    };
  }
  if (/\b(kirim whatsapp|whatsapp blast|ssh|shell|deploy server|ubah server)\b/.test(t)) {
    return { type: "say", text: "Itu belum terhubung. Aku tidak mengirim pesan ke aplikasi lain dan tidak mengubah server." };
  }
  if (!looksLikeWorkEdit(t)) return { type: "none" };
  if (/\b(kembalikan nilai|batalkan perubahan)\b/.test(t)) return { type: "none" };

  if (/\bhapus\b/.test(t) && /\b(closing|penjualan|transaksi)\b/.test(t)) {
    const hit = pickSale(t, ctx);
    if (hit.kind !== "one") return hit.plan;
    if (ctx.role === "SALES") return { type: "say", text: "Hapus penjualan hanya untuk founder dan leader." };
    return confirm({
      kind: "sale_delete",
      key: `del:${hit.row.id}`,
      id: hit.row.id,
      label: hit.row.product,
      next: 0,
      before: hit.row.total,
    }, `Hapus closing ${hit.row.id.slice(0, 8)}?\n${hit.row.product} · ${fmtRp(hit.row.total)}\n\nSetelah dihapus, omzet tidak menghitung transaksi ini.`);
  }

  if (/\b(closing|penjualan|transaksi)\b/.test(t) && /\b(ubah|ganti|koreksi|jadi|menjadi)\b/.test(t)) {
    const amount = readAmount(t);
    if (!amount) return { type: "say", text: "Total barunya berapa?" };
    const hit = pickSale(t, ctx);
    if (hit.kind !== "one") return hit.plan;
    if (hit.row.items > 1) {
      return { type: "say", text: "Closing ini punya lebih dari satu produk. Sebut ID-nya supaya tidak salah ubah." };
    }
    const unit = Math.round(amount / Math.max(1, hit.row.qty));
    return confirm({
      kind: "sale_total",
      key: `sale:${hit.row.id}:${amount}`,
      id: hit.row.id,
      label: hit.row.product,
      next: unit,
      before: hit.row.total,
    }, `Ubah closing ${hit.row.id.slice(0, 8)}:\n${hit.row.product} × ${hit.row.qty}\nTotal: ${fmtRp(hit.row.total)} → ${fmtRp(amount)}\n\nSimpan perubahan?`);
  }

  if (/\bstok\b/.test(t)) {
    if (ctx.role !== "FOUNDER") return { type: "say", text: "Ubah stok hanya untuk founder." };
    const parsed = t.match(/\bstok\s+(.+?)\s+(?:jadi|menjadi|=)\s*(\d{1,6})\b/);
    if (!parsed) return { type: "say", text: "Contoh: stok Afternoon jadi 20" };
    const hit = pickProduct(parsed[1], ctx.products || []);
    if (hit.kind !== "one") return hit.plan;
    const next = Number(parsed[2]);
    return confirm({
      kind: "stock",
      key: `stock:${hit.row.id}:${next}`,
      id: hit.row.id,
      label: hit.row.name,
      next,
      before: hit.row.stock,
    }, `Ubah stok ${hit.row.name}:\n${hit.row.stock} → ${next} pcs\n\nSimpan?`);
  }

  if (/\bharga\b/.test(t)) {
    if (ctx.role !== "FOUNDER") return { type: "say", text: "Ubah harga katalog hanya untuk founder." };
    const amount = readAmount(t);
    const name = t.replace(/\b(ubah|ganti|koreksi|harga|jadi|menjadi|rp)\b/g, " ").replace(/[\d.,]+/g, " ").replace(/\s+/g, " ").trim();
    if (!amount || name.length < 3) return { type: "say", text: "Contoh: ubah harga Afternoon jadi Rp199.999" };
    const hit = pickProduct(name, ctx.products || []);
    if (hit.kind !== "one") return hit.plan;
    return confirm({
      kind: "catalog_price",
      key: `price:${hit.row.id}:${amount}`,
      id: hit.row.id,
      label: hit.row.name,
      next: amount,
      before: hit.row.price,
    }, `Ubah harga ${hit.row.name}:\n${fmtRp(hit.row.price)} → ${fmtRp(amount)}\n\nIni harga katalog, bukan satu closing. Simpan?`);
  }

  if (/\btarget\b/.test(t)) {
    if (ctx.role === "SALES") return { type: "say", text: "Ubah target hanya untuk founder dan leader." };
    const qty = t.match(/(\d{1,4})\s*unit/);
    if (!qty) return { type: "say", text: "Contoh: ganti target menjadi 10 unit sehari" };
    const period: TargetPeriod = /\b(sehari|harian|hari)\b/.test(t) ? "daily" : /\b(seminggu|mingguan|minggu)\b/.test(t) ? "weekly" : "monthly";
    const n = Number(qty[1]);
    const label = period === "daily" ? "harian" : period === "weekly" ? "mingguan" : "bulanan";
    return confirm({
      kind: "target",
      key: `target:${period}:${n}`,
      id: period,
      label,
      next: n,
      before: 0,
      period,
    }, `Target ${label} menjadi ${n} unit.\n\nSimpan target baru?`);
  }

  return { type: "none" };
}

export function taskJob(title: string): "pdf" | "xlsx" | null {
  const t = (title || "").toLowerCase();
  if (/\b(excel|xlsx|spreadsheet)\b/.test(t)) return "xlsx";
  if (/\b(pdf|laporan)\b/.test(t)) return "pdf";
  return null;
}

function confirm(draft: WorkDraft, text: string): WorkPlan {
  return { type: "confirm", draft, text };
}

function pickSale(t: string, ctx: { sales?: SaleSnap[]; focusSale?: SaleSnap | null }): { kind: "one"; row: SaleSnap } | { kind: "plan"; plan: WorkPlan } {
  const rows = ctx.sales || [];
  if (ctx.focusSale && /\b(tadi|itu|terakhir)\b/.test(t)) return { kind: "one", row: ctx.focusSale };
  if (rows.length === 1) return { kind: "one", row: rows[0] };
  if (ctx.focusSale) return { kind: "one", row: ctx.focusSale };
  if (rows.length > 1) {
    return {
      kind: "plan",
      plan: {
        type: "say",
        text: `Ada ${rows.length} closing. Sebut ID:\n${rows.slice(0, 4).map((r) => `${r.id.slice(0, 8)} · ${r.product} · ${fmtRp(r.total)}`).join("\n")}`,
      },
    };
  }
  return { kind: "plan", plan: { type: "say", text: "Closing yang mana? Belum ada transaksi terakhir di chat ini." } };
}

function pickProduct(hint: string, products: ProductSnap[]): { kind: "one"; row: ProductSnap } | { kind: "plan"; plan: WorkPlan } {
  const q = hint.toLowerCase().trim();
  const hits = products.filter((p) => p.name.toLowerCase() === q || p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()));
  if (hits.length === 1) return { kind: "one", row: hits[0] };
  if (hits.length > 1) return { kind: "plan", plan: { type: "say", text: `Produk mana?\n${hits.map((p) => p.name).join(", ")}` } };
  return { kind: "plan", plan: { type: "say", text: "Produk itu tidak ada di katalog." } };
}

function readAmount(t: string) {
  const rp = t.match(/\brp\.?\s*([\d.]+)/i);
  if (rp) return parseIdrAmountToken(rp[1], null);
  const suf = t.match(/([\d.,]+)\s*(rb|ribu|k|jt|juta)\b/i);
  if (suf) return parseIdrAmountToken(suf[1], suf[2]);
  const bare = t.match(/\b(\d{1,3}(?:\.\d{3})+)\b/);
  if (bare) return parseIdrAmountToken(bare[1], null);
  return null;
}
