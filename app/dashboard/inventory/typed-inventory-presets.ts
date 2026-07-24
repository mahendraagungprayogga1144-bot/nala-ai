import type { InventorySection, TypedInventoryProps } from "./typed-inventory";
import { getConfig } from "./business-config";

type Preset = Pick<
  TypedInventoryProps,
  "tip" | "hubHref" | "hubLabel" | "sections" | "buyCategory" | "sellCategory" | "showSku" | "attrsMode" | "workflow"
>;

const retailSections: InventorySection[] = [
  { key: "fashion", label: "Fashion & Aksesoris", cats: ["Fashion", "Aksesoris"], defaultCat: "Fashion", accent: "#38BDF8" },
  { key: "elektronik", label: "Elektronik", cats: ["Elektronik"], defaultCat: "Elektronik", accent: "#8B5CF6" },
  { key: "fmcg", label: "Makanan & Minuman", cats: ["Makanan", "Minuman"], defaultCat: "Makanan", accent: "#F59E0B" },
  { key: "kosmetik", label: "Kosmetik & Perabot", cats: ["Kosmetik", "Perabot"], defaultCat: "Kosmetik", accent: "#EC4899" },
];

const jasaSections: InventorySection[] = [
  { key: "alat", label: "Peralatan Kerja", cats: ["Peralatan Kerja", "Elektronik", "Kamera", "Komputer"], defaultCat: "Peralatan Kerja", accent: "#EC4899" },
  { key: "kendaraan", label: "Kendaraan & Furniture", cats: ["Kendaraan", "Furniture"], defaultCat: "Kendaraan", accent: "#38BDF8" },
];

const wholesaleSections: InventorySection[] = [
  { key: "sembako", label: "Sembako & Minuman", cats: ["Sembako", "Minuman", "Snack", "Rokok"], defaultCat: "Sembako", accent: "#6366F1" },
  { key: "rumah", label: "Sabun & Lainnya", cats: ["Sabun/Deterjen", "Elektronik", "Fashion", "Lainnya"], defaultCat: "Sabun/Deterjen", accent: "#2DD4BF" },
];

const olshopSections: InventorySection[] = [
  { key: "fashion", label: "Fashion & Aksesoris", cats: ["Fashion", "Aksesoris"], defaultCat: "Fashion", accent: "#F43F5E" },
  { key: "beauty", label: "Kosmetik & Handmade", cats: ["Kosmetik", "Handmade"], defaultCat: "Kosmetik", accent: "#EC4899" },
  { key: "gadget", label: "Elektronik & Makanan", cats: ["Elektronik", "Makanan", "Minuman"], defaultCat: "Elektronik", accent: "#38BDF8" },
];

const kesehatanSections: InventorySection[] = [
  { key: "obat", label: "Obat", cats: ["Obat Bebas", "Obat Resep"], defaultCat: "Obat Bebas", accent: "#10B981" },
  { key: "suplemen", label: "Vitamin & Suplemen", cats: ["Vitamin", "Suplemen"], defaultCat: "Vitamin", accent: "#2DD4BF" },
  { key: "alkes", label: "Alkes & Kosmetik Medis", cats: ["Alat Kesehatan", "Kosmetik Medis"], defaultCat: "Alat Kesehatan", accent: "#38BDF8" },
];

const bengkelSections: InventorySection[] = [
  { key: "oli", label: "Oli & Filter", cats: ["Oli", "Filter"], defaultCat: "Oli", accent: "#EF4444" },
  { key: "part", label: "Ban, Aki, Rem, Busi", cats: ["Ban", "Aki", "Rem", "Busi"], defaultCat: "Ban", accent: "#F59E0B" },
  { key: "body", label: "Body & Aksesoris", cats: ["Lampu", "Body", "Aksesoris", "Lainnya"], defaultCat: "Aksesoris", accent: "#8B5CF6" },
];

export const INVENTORY_PRESETS: Record<string, Preset> = {
  retail: {
    tip: "Toko kecil: tambah + jual satu-satu. Partai: isi SKU, filter kritis, jual qty besar via tombol Jual.",
    hubHref: "/dashboard/retail",
    hubLabel: "Pusat Retail",
    sections: retailSections,
    buyCategory: "Pembelian Barang",
    sellCategory: "Penjualan",
    showSku: true,
    attrsMode: "none",
    workflow: ["Tambah + SKU", "Stok masuk/keluar", "Jual (kasir/qty)"],
  },
  jasa: {
    tip: "Catat aset/peralatan. Pinjam/rusak lewat Keluar. Order klien tetap di modul Order Jasa.",
    hubHref: "/dashboard/jasa",
    hubLabel: "Order Jasa",
    sections: jasaSections,
    buyCategory: "Pembelian Aset",
    sellCategory: "Penjualan Aset",
    showSku: false,
    attrsMode: "none",
    workflow: ["Tambah aset", "Pakai / pinjam", "Jual aset (opsional)"],
  },
  wholesale: {
    tip: "Partai: set MOQ + harga grosir saat tambah. Tombol Jual pakai chip qty 10/50/100 + harga grosir.",
    hubHref: "/dashboard/wholesale",
    hubLabel: "Pusat Grosir",
    sections: wholesaleSections,
    buyCategory: "Pembelian Grosir",
    sellCategory: "Penjualan Grosir",
    showSku: true,
    attrsMode: "wholesale",
    workflow: ["Tambah SKU + MOQ", "Stok partai", "Jual grosir"],
  },
  olshop: {
    tip: "Samakan stok online. Jual di sini atau upload CSV di Marketplace biar tidak oversell.",
    hubHref: "/dashboard/olshop",
    hubLabel: "Pusat Online Shop",
    sections: olshopSections,
    buyCategory: "Pembelian Barang",
    sellCategory: "Penjualan",
    showSku: true,
    attrsMode: "none",
    workflow: ["Tambah produk", "Update stok", "Jual / sync MP"],
  },
  kesehatan: {
    tip: "Wajib isi ED saat tambah. Filter kritis + pantau kadaluarsa ≤30 hari sebelum jual.",
    hubHref: "/dashboard/kesehatan",
    hubLabel: "Pusat Kesehatan",
    sections: kesehatanSections,
    buyCategory: "Pembelian Obat",
    sellCategory: "Penjualan",
    showSku: true,
    attrsMode: "expiry",
    workflow: ["Tambah + ED", "Pantau kadaluarsa", "Jual aman"],
  },
  bengkel: {
    tip: "Spare part per kategori. Dipasang ke kendaraan = Keluar. Tagih jasa di Antrian Bengkel.",
    hubHref: "/dashboard/bengkel",
    hubLabel: "Antrian Bengkel",
    sections: bengkelSections,
    buyCategory: "Pembelian Spare Part",
    sellCategory: "Penjualan Spare Part",
    showSku: false,
    attrsMode: "none",
    workflow: ["Tambah part", "Stok / pasang", "Jual part"],
  },
};

export function getInventoryPreset(type: string | null | undefined) {
  if (!type) return null;
  const preset = INVENTORY_PRESETS[type];
  if (!preset) return null;
  return { ...preset, config: getConfig(type) };
}

export const TYPED_INVENTORY_TYPES = Object.keys(INVENTORY_PRESETS);
