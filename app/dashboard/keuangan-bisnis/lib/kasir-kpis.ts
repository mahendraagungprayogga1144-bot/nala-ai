import type { KasirExportKpis, KasirExportOrder } from "./kasir-export-types";

/** Pure KPI math — keep free of xlsx so Owner/server pages stay light. */
export function computeKasirKpis(orders: KasirExportOrder[]): KasirExportKpis {
  const omzet = orders.reduce((s, o) => s + o.total, 0);
  const laba = orders.reduce((s, o) => s + Number(o.laba || 0), 0);
  const byMetode = (m: string) =>
    orders.filter((o) => o.metode_bayar === m).reduce((s, o) => s + o.total, 0);
  return {
    totalOrders: orders.length,
    omzet,
    laba,
    tunai: byMetode("tunai"),
    qris: byMetode("qris"),
    transfer: byMetode("transfer"),
  };
}
