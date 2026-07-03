export type KasirExportOrder = {
  id: string;
  orderNo: string;
  kasirName: string;
  order_date: string;
  created_at: string;
  metode_bayar: string | null;
  catatan: string | null;
  diskon: number | null;
  total: number;
  laba: number | null;
  itemsSummary: string;
};

export type KasirExportKpis = {
  totalOrders: number;
  omzet: number;
  laba: number;
  tunai: number;
  qris: number;
  transfer: number;
};

export type KasirExportContext = {
  businessName: string;
  periodLabel: string;
};
