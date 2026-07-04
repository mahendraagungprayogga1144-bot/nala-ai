import Papa from "papaparse";
import * as XLSX from "xlsx";

export type ParsedOrder = {
  order_id: string;
  platform: string;
  tanggal: string;
  nama_produk: string;
  sku: string;
  harga_jual: number;
  harga_setelah_diskon: number;
  fee_komisi: number;
  fee_admin: number;
  fee_layanan: number;
  fee_payment: number;
  ongkir: number;
  dana_diterima: number;
  status: string;
};

export type ParseResult = {
  platform: string;
  orders: ParsedOrder[];
  totalOmzet: number;
  totalFee: number;
  danaDiterima: number;
  periode: string;
};

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (!v) return 0;
  const s = String(v).replace(/[^0-9.\-,]/g, "").replace(/,/g, "");
  return parseFloat(s) || 0;
}

function str(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function parseShopee(rows: Record<string, unknown>[]): ParsedOrder[] {
  return rows
    .filter(r => {
      const status = str(r["Status Pesanan"]);
      return status.toLowerCase().includes("selesai");
    })
    .map(r => ({
      order_id: str(r["No. Pesanan"]),
      platform: "Shopee",
      tanggal: str(r["Waktu Pesanan Dibuat"]),
      nama_produk: str(r["Nama Produk"]) || str(r["Product Name"]) || "",
      sku: str(r["SKU Induk"]) || str(r["Variasi"]) || "",
      harga_jual: num(r["Harga Awal"]),
      harga_setelah_diskon: num(r["Total Harga Produk Setelah Diskon"]),
      fee_komisi: Math.abs(num(r["Biaya Komisi Shopee"])),
      fee_admin: Math.abs(num(r["Biaya Administrasi"])),
      fee_layanan: Math.abs(num(r["Biaya Layanan"])),
      fee_payment: 0,
      ongkir: num(r["Ongkir Dibayar Pembeli"]),
      dana_diterima: num(r["Estimasi Dana Diterima"]),
      status: str(r["Status Pesanan"]),
    }));
}

function parseTikTok(rows: Record<string, unknown>[]): ParsedOrder[] {
  return rows
    .filter(r => {
      const status = str(r["Order Status"]);
      return status.toLowerCase().includes("completed") || status.toLowerCase().includes("selesai");
    })
    .map(r => ({
      order_id: str(r["Order ID"]),
      platform: "TikTok Shop",
      tanggal: str(r["Created Time"]),
      nama_produk: str(r["Product Name"]),
      sku: str(r["Seller SKU"]),
      harga_jual: num(r["Original Price"]),
      harga_setelah_diskon: num(r["Original Price"]),
      fee_komisi: Math.abs(num(r["Commission Fee"])),
      fee_admin: 0,
      fee_layanan: 0,
      fee_payment: Math.abs(num(r["Payment Fee"])),
      ongkir: 0,
      dana_diterima: num(r["Settlement Amount"]),
      status: str(r["Order Status"]),
    }));
}

function parseTokopedia(rows: Record<string, unknown>[]): ParsedOrder[] {
  return rows.map(r => {
    const feeLayanan = Math.abs(num(r["Biaya Layanan"]));
    const feeAdmin = Math.abs(num(r["Biaya Admin"]));
    return {
      order_id: str(r["No Invoice"]),
      platform: "Tokopedia",
      tanggal: str(r["Tanggal Transaksi"]),
      nama_produk: str(r["Nama Produk"]),
      sku: str(r["SKU"]) || "",
      harga_jual: num(r["Harga Jual"]),
      harga_setelah_diskon: num(r["Harga Jual"]),
      fee_komisi: 0,
      fee_admin: feeAdmin,
      fee_layanan: feeLayanan,
      fee_payment: 0,
      ongkir: 0,
      dana_diterima: num(r["Total Pembayaran"]),
      status: "Selesai",
    };
  });
}

function detectPlatform(headers: string[]): string {
  const h = headers.map(x => x.toLowerCase());
  if (h.some(x => x.includes("shopee") || x.includes("no. pesanan"))) return "Shopee";
  if (h.some(x => x.includes("order id") && h.some(y => y.includes("tiktok") || y.includes("seller sku")))) return "TikTok Shop";
  if (h.some(x => x.includes("no invoice") || x.includes("tanggal transaksi"))) return "Tokopedia";
  if (h.some(x => x.includes("order id"))) return "TikTok Shop";
  return "unknown";
}

function buildResult(platform: string, orders: ParsedOrder[]): ParseResult {
  const totalOmzet = orders.reduce((s, o) => s + o.harga_jual, 0);
  const totalFee = orders.reduce((s, o) => s + o.fee_komisi + o.fee_admin + o.fee_layanan + o.fee_payment, 0);
  const danaDiterima = orders.reduce((s, o) => s + o.dana_diterima, 0);

  const dates = orders.map(o => o.tanggal).filter(Boolean).sort();
  const periode = dates.length > 0 ? `${dates[0]} — ${dates[dates.length - 1]}` : "";

  return { platform, orders, totalOmzet, totalFee, danaDiterima, periode };
}

function rowsToData(rows: Record<string, unknown>[], forcePlatform?: string): ParseResult {
  if (rows.length === 0) return { platform: forcePlatform || "unknown", orders: [], totalOmzet: 0, totalFee: 0, danaDiterima: 0, periode: "" };

  const headers = Object.keys(rows[0]);
  const platform = forcePlatform || detectPlatform(headers);

  let parsed: ParsedOrder[];
  switch (platform) {
    case "Shopee": parsed = parseShopee(rows); break;
    case "TikTok Shop": parsed = parseTikTok(rows); break;
    case "Tokopedia": parsed = parseTokopedia(rows); break;
    default: parsed = [];
  }

  return buildResult(platform, parsed);
}

export async function parseFile(file: File, forcePlatform?: string): Promise<ParseResult> {
  const ext = file.name.split(".").pop()?.toLowerCase();

  if (ext === "xlsx" || ext === "xls") {
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
    return rowsToData(rows, forcePlatform);
  }

  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => resolve(rowsToData(results.data, forcePlatform)),
      error: (err: Error) => reject(err),
    });
  });
}
