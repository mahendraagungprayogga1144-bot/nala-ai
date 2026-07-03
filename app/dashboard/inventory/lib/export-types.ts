export type InventoryProductInput = {
  name: string;
  sku: string | null;
  category: string | null;
  stock: number;
  min_stock: number;
  price: number | null;
  cost: number | null;
  unit?: string | null;
};

export type StockStatus = "aman" | "menipis" | "habis";

export type ExportProductRow = {
  no: number;
  kode: string;
  nama: string;
  kategori: string;
  satuan: string;
  stok: number;
  minStok: number;
  hargaBeli: number;
  hargaJual: number;
  nilaiStok: number;
  status: StockStatus;
  statusLabel: string;
};

export type InventoryKpis = {
  totalItem: number;
  stokTersedia: number;
  stokMenipis: number;
  stokHabis: number;
  totalNilaiStok: number;
};

export type ExportContext = {
  businessName: string;
  businessType?: string;
  reportTitle?: string;
  filterLabel?: string;
};

export type PdfVariant = "ringkas" | "detail";
export type PrintFormat = "a4-ringkas" | "a4-detail" | "thermal-58" | "thermal-80" | "thermal-custom";
