import type { SupabaseClient } from "@supabase/supabase-js";
import { todayWib } from "@/lib/date";

export type KasirChatSnapshot = {
  businessName: string;
  today: string;
  orderCount: number;
  omzetHari: number;
  labaHari: number;
  orderBulan: number;
  omzetBulan: number;
  labaBulan: number;
  topMenu: [string, number][];
  activeKasir: string[];
  mejaCount: Record<string, number>;
  recent: string[];
};

export async function fetchKasirChatSnapshot(
  supabase: SupabaseClient,
  businessId: string,
  businessName: string,
): Promise<KasirChatSnapshot> {
  const today = todayWib();
  const parts = today.split("-").map(Number);
  const monthStart = `${parts[0]}-${String(parts[1]).padStart(2, "0")}-01`;

  const [{ data: todayOrders }, { data: monthOrders }, { data: activeCheckins }] = await Promise.all([
    supabase
      .from("orders")
      .select("id, total, laba, catatan, created_at, order_items(qty, menus(nama))")
      .eq("business_id", businessId)
      .eq("order_date", today)
      .order("created_at", { ascending: false }),
    supabase
      .from("orders")
      .select("total, laba")
      .eq("business_id", businessId)
      .gte("order_date", monthStart)
      .lte("order_date", today),
    supabase
      .from("checkins")
      .select("jam_masuk, employees(nama)")
      .eq("business_id", businessId)
      .eq("tanggal", today)
      .is("jam_keluar", null),
  ]);

  const todayList = todayOrders || [];
  const menuCount: Record<string, number> = {};
  const mejaCount: Record<string, number> = {};

  todayList.forEach(o => {
    const c = o.catatan || "";
    const m = c.match(/^Meja\s+(\S+)/i)?.[1] || (c.startsWith("Takeaway") ? "Takeaway" : null);
    if (m) mejaCount[m] = (mejaCount[m] || 0) + 1;

    const items = (o.order_items || []) as { qty: number; menus: { nama: string } | { nama: string }[] | null }[];
    items.forEach(i => {
      const menu = i.menus;
      const nama = Array.isArray(menu) ? menu[0]?.nama : menu?.nama;
      if (nama) menuCount[nama] = (menuCount[nama] || 0) + i.qty;
    });
  });

  const activeKasir = (activeCheckins || []).map(c => {
    const emp = c.employees as { nama: string } | { nama: string }[] | null;
    const nama = Array.isArray(emp) ? emp[0]?.nama : emp?.nama;
    return nama ? `${nama} (masuk ${c.jam_masuk})` : null;
  }).filter((x): x is string => Boolean(x));

  const recent = todayList.slice(0, 5).map(o => {
    const items = (o.order_items || []) as { qty: number; menus: { nama: string } | { nama: string }[] | null }[];
    const summary = items.map(i => {
      const menu = i.menus;
      const nama = Array.isArray(menu) ? menu[0]?.nama : menu?.nama;
      return `${nama || "Menu"} x${i.qty}`;
    }).join(", ");
    return `Rp${Number(o.total).toLocaleString("id-ID")}${o.catatan ? ` (${o.catatan})` : ""} — ${summary}`;
  });

  return {
    businessName,
    today,
    orderCount: todayList.length,
    omzetHari: todayList.reduce((s, o) => s + Number(o.total || 0), 0),
    labaHari: todayList.reduce((s, o) => s + Number(o.laba || 0), 0),
    orderBulan: (monthOrders || []).length,
    omzetBulan: (monthOrders || []).reduce((s, o) => s + Number(o.total || 0), 0),
    labaBulan: (monthOrders || []).reduce((s, o) => s + Number(o.laba || 0), 0),
    topMenu: Object.entries(menuCount).sort((a, b) => b[1] - a[1]).slice(0, 5),
    activeKasir,
    mejaCount,
    recent,
  };
}

export function kasirSnapshotToContext(s: KasirChatSnapshot): string {
  return `
Data kasir F&B (${s.businessName}) — REAL-TIME dari database, kamu PUNYA akses penuh:
Hari ini (${s.today}): ${s.orderCount} order, omzet Rp${s.omzetHari.toLocaleString("id-ID")}, laba Rp${Math.round(s.labaHari).toLocaleString("id-ID")}
Bulan ini: ${s.orderBulan} order, omzet Rp${s.omzetBulan.toLocaleString("id-ID")}, laba Rp${Math.round(s.labaBulan).toLocaleString("id-ID")}
Kasir aktif shift: ${s.activeKasir.length ? s.activeKasir.join(", ") : "tidak ada yang check-in"}
Menu terlaris hari ini: ${s.topMenu.length ? s.topMenu.map(([n, q]) => `${n} (${q}x)`).join(", ") : "belum ada"}
Order per meja: ${Object.keys(s.mejaCount).length ? Object.entries(s.mejaCount).map(([m, n]) => `${m}: ${n} order`).join(", ") : "belum ada data meja"}
Order terakhir: ${s.recent.length ? s.recent.join(" | ") : "belum ada"}`;
}

const KASIR_INTENT =
  /omzet|order|laba|kasir|meja|terlaris|penjualan|jualan|takeaway|shift|tutup hari/i;

export function isKasirQuestion(messages: { role: string; content: string }[]): boolean {
  const recentUser = messages
    .filter(m => m.role === "user")
    .slice(-3)
    .map(m => m.content)
    .join(" ");
  return KASIR_INTENT.test(recentUser);
}

export function directKasirAnswer(s: KasirChatSnapshot, question: string): string | null {
  const q = question.toLowerCase();
  const recent = q;

  if (/omzet.*bulan|bulan.*omzet/.test(recent)) {
    return `Omzet bulan ini di ${s.businessName}: Rp${s.omzetBulan.toLocaleString("id-ID")} (${s.orderBulan} order). Laba Rp${Math.round(s.labaBulan).toLocaleString("id-ID")}.`;
  }
  if (/berapa order|order hari|order.*hari ini|total order/.test(recent)) {
    if (s.orderCount === 0) return `Belum ada order masuk hari ini (${s.today}) di ${s.businessName}.`;
    return `Hari ini ${s.orderCount} order di ${s.businessName}, omzet Rp${s.omzetHari.toLocaleString("id-ID")}, laba Rp${Math.round(s.labaHari).toLocaleString("id-ID")}.`;
  }
  if (/omzet|penjualan|jualan|berapa.*hari|hari ini|di kasir|^kasir$/.test(recent)) {
    if (s.orderCount === 0) {
      return `Omzet hari ini (${s.today}) di ${s.businessName}: Rp0 — belum ada order dari kasir.`;
    }
    return `Omzet hari ini (${s.today}) di ${s.businessName}: Rp${s.omzetHari.toLocaleString("id-ID")} dari ${s.orderCount} order. Laba Rp${Math.round(s.labaHari).toLocaleString("id-ID")}.`;
  }
  if (/laba/.test(recent)) {
    return `Laba hari ini di ${s.businessName}: Rp${Math.round(s.labaHari).toLocaleString("id-ID")} (omzet Rp${s.omzetHari.toLocaleString("id-ID")}).`;
  }
  if (/terlaris|menu.*laris|paling laris/.test(recent)) {
    if (!s.topMenu.length) return `Belum ada data menu terlaris hari ini di ${s.businessName}.`;
    return `Menu terlaris hari ini di ${s.businessName}: ${s.topMenu.map(([n, c]) => `${n} (${c}x)`).join(", ")}.`;
  }
  if (/kasir aktif|siapa.*kasir|shift/.test(recent)) {
    return s.activeKasir.length
      ? `Kasir aktif sekarang di ${s.businessName}: ${s.activeKasir.join(", ")}.`
      : `Tidak ada karyawan yang sedang check-in di ${s.businessName}.`;
  }
  if (/meja/.test(recent)) {
    if (!Object.keys(s.mejaCount).length) return `Belum ada order dengan nomor meja hari ini di ${s.businessName}.`;
    return `Order per meja hari ini: ${Object.entries(s.mejaCount).map(([m, n]) => `${m} (${n} order)`).join(", ")}.`;
  }

  if (isKasirQuestion([{ role: "user", content: question }])) {
    return s.orderCount === 0
      ? `Data kasir ${s.businessName} hari ini (${s.today}): belum ada order.`
      : `Ringkasan kasir ${s.businessName} hari ini: ${s.orderCount} order, omzet Rp${s.omzetHari.toLocaleString("id-ID")}, laba Rp${Math.round(s.labaHari).toLocaleString("id-ID")}.${s.topMenu.length ? ` Menu terlaris: ${s.topMenu[0][0]}.` : ""}`;
  }

  return null;
}
