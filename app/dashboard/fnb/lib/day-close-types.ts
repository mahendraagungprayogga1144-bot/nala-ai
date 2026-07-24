import type { KasirExportKpis, KasirExportOrder } from "@/app/dashboard/keuangan-bisnis/lib/kasir-export-types";

export type DayCloseData = {
  businessName: string;
  tanggal: string;
  orders: KasirExportOrder[];
  kpis: KasirExportKpis;
  activeKasir: { nama: string; jamMasuk: string; orderCount: number; omzet: number }[];
};

export function buildDayCloseWhatsAppText(data: DayCloseData): string {
  const lines = [
    `📊 *Rekap Tutup Hari*`,
    data.businessName,
    `Tanggal: ${data.tanggal}`,
    ``,
    `Order: ${data.kpis.totalOrders}`,
    `Omzet: Rp${data.kpis.omzet.toLocaleString("id-ID")}`,
    `Laba: Rp${Math.round(data.kpis.laba).toLocaleString("id-ID")}`,
    `Tunai: Rp${data.kpis.tunai.toLocaleString("id-ID")} · QRIS: Rp${data.kpis.qris.toLocaleString("id-ID")}`,
  ];
  if (data.activeKasir.length) {
    lines.push("", "*Kasir shift hari ini:*");
    data.activeKasir.forEach((k) => {
      lines.push(`• ${k.nama} — ${k.orderCount} order · Rp${k.omzet.toLocaleString("id-ID")}`);
    });
  }
  lines.push("", "_Via Gercep AI_");
  return lines.join("\n");
}
