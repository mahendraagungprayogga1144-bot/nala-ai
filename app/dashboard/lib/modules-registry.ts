import type { LucideIcon } from "lucide-react";
import {
  Wallet, Store, Calculator, FileText, Package, Receipt, QrCode, Camera,
  ShoppingCart, ShoppingBag, Megaphone, BarChart3, Users, LayoutDashboard, Layers, Percent,
  Smartphone, MessageCircle, Factory, Bird, Sprout, UtensilsCrossed,
  Briefcase, Boxes, HeartPulse, Wrench,
} from "lucide-react";
import { normalizeBizType } from "@/lib/auth/post-login";

export type ModuleStatus = "live" | "beta";
export type ModuleCategory = "utama" | "keuangan" | "operasional" | "marketing" | "platform" | "manajemen" | "aplikasi";

export type DashboardModule = {
  id: string;
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  category: ModuleCategory;
  status: ModuleStatus;
  bizTypes?: string[];
};

const BIZ_TYPE_LABELS: Record<string, string> = {
  kuliner: "Kuliner / F&B",
  homeindustry: "Home Industry",
  ternak: "Peternakan",
  pertanian: "Pertanian",
  retail: "Retail",
  fashion: "Fashion",
  jasa: "Jasa",
  wholesale: "Grosir",
  olshop: "Online Shop",
  kesehatan: "Kesehatan",
  bengkel: "Bengkel",
};

/** Modul khusus per jenis bisnis — tampil di group terpisah di atas */
const BIZ_MODULES: DashboardModule[] = [
  { id: "fnb-kasir", name: "Kasir F&B", desc: "Kasir kuliner — menu, order meja, struk.", href: "/dashboard/fnb/kasir", icon: Receipt, category: "operasional", status: "live", bizTypes: ["kuliner"] },
  { id: "master-menu", name: "Master Menu", desc: "Kelola menu & resep sendiri.", href: "/dashboard/master-menu", icon: UtensilsCrossed, category: "operasional", status: "live", bizTypes: ["kuliner"] },
  { id: "karyawan", name: "Karyawan Toko", desc: "Kelola tim & link kasir karyawan.", href: "/dashboard/karyawan-toko", icon: Users, category: "platform", status: "live", bizTypes: ["kuliner"] },
  { id: "produksi", name: "Produksi", desc: "Resep dan produksi home industry.", href: "/dashboard/produksi", icon: Factory, category: "manajemen", status: "live", bizTypes: ["homeindustry"] },
  { id: "ternak", name: "Manajemen Ternak", desc: "Batch, pakan, panen ternak.", href: "/dashboard/peternakan", icon: Bird, category: "manajemen", status: "live", bizTypes: ["ternak"] },
  { id: "pertanian", name: "Modul Pertanian", desc: "Lahan, panen, saprotan.", href: "/dashboard/pertanian", icon: Sprout, category: "manajemen", status: "live", bizTypes: ["pertanian"] },
  { id: "retail-hub", name: "Pusat Retail", desc: "Stok & barcode untuk toko fisik.", href: "/dashboard/retail", icon: Store, category: "manajemen", status: "live", bizTypes: ["retail"] },
  { id: "jasa-orders", name: "Order Jasa", desc: "Catat order klien, fee, dan status.", href: "/dashboard/jasa", icon: Briefcase, category: "manajemen", status: "live", bizTypes: ["jasa"] },
  { id: "wholesale-hub", name: "Pusat Grosir", desc: "Harga grosir & minimal order (MOQ).", href: "/dashboard/wholesale", icon: Boxes, category: "manajemen", status: "live", bizTypes: ["wholesale"] },
  { id: "olshop-hub", name: "Pusat Online Shop", desc: "Stok + marketplace + laporan CSV.", href: "/dashboard/olshop", icon: ShoppingBag, category: "manajemen", status: "live", bizTypes: ["olshop"] },
  { id: "kesehatan-hub", name: "Pusat Kesehatan", desc: "Pantau kadaluarsa & stok kritis.", href: "/dashboard/kesehatan", icon: HeartPulse, category: "manajemen", status: "live", bizTypes: ["kesehatan"] },
  { id: "bengkel-hub", name: "Antrian Bengkel", desc: "Kendaraan, keluhan, status servis.", href: "/dashboard/bengkel", icon: Wrench, category: "manajemen", status: "live", bizTypes: ["bengkel"] },
];
/** Modul universal — tampil untuk semua jenis bisnis */
export const GERCEP_MODULES: DashboardModule[] = [
  { id: "owner", name: "Dashboard Owner", desc: "Tanya kondisi bisnis, AI jawab lengkap.", href: "/dashboard/owner", icon: LayoutDashboard, category: "utama", status: "live" },
  { id: "chat", name: "Gercep Chat", desc: "Pusat kendali semua modul lewat chat.", href: "/dashboard/chat", icon: MessageCircle, category: "utama", status: "live" },

  { id: "keuangan-pribadi", name: "Keuangan Pribadi", desc: "Catat pemasukan-pengeluaran, target tabungan.", href: "/dashboard/keuangan-pribadi", icon: Wallet, category: "keuangan", status: "live" },
  { id: "keuangan-bisnis", name: "Keuangan Bisnis", desc: "Modal, HPP, hutang-piutang, gaji karyawan.", href: "/dashboard/keuangan-bisnis", icon: Store, category: "keuangan", status: "live" },
  { id: "smart-profit", name: "Smart Profit Calculator", desc: "Profit bersih sampai break even point.", href: "/dashboard/smart-profit", icon: Calculator, category: "keuangan", status: "live" },
  { id: "pajak", name: "Pajak NPWP Center", desc: "Input NPWP & lapor omzet sendiri.", href: "/dashboard/pajak-npwp", icon: FileText, category: "keuangan", status: "beta" },

  { id: "inventory", name: "Inventory", desc: "Stok berkurang otomatis, notif kalau habis.", href: "/dashboard/inventory", icon: Package, category: "operasional", status: "live" },
  { id: "barcode", name: "Barcode QR Analyzer", desc: "Daftar barcode & SKU sendiri.", href: "/dashboard/barcode-qr", icon: QrCode, category: "operasional", status: "beta" },

  // Modul aplikasi sendiri — bukan bagian OPERASIONAL TOKO / fitur jenis bisnis
  { id: "kasir", name: "AI Kasir", desc: "Aplikasi kasir retail mandiri — jual produk inventory, shift, rekap. Bukan Kasir F&B.", href: "/dashboard/ai-kasir", icon: Receipt, category: "aplikasi", status: "live" },
  { id: "ai-jual-beli", name: "AI Jual Beli", desc: "Aplikasi listing jual/beli mandiri.", href: "/dashboard/ai-jual-beli", icon: Camera, category: "aplikasi", status: "beta" },

  { id: "marketplace", name: "Marketplace Center", desc: "Daftar toko Shopee/Tokopedia sendiri.", href: "/dashboard/marketplace-center", icon: ShoppingCart, category: "marketing", status: "beta" },
  { id: "marketplace-laporan", name: "Marketplace", desc: "Upload CSV laporan marketplace, analisis otomatis.", href: "/dashboard/marketplace", icon: ShoppingBag, category: "manajemen", status: "live" },
  { id: "marketing", name: "AI Marketing", desc: "Simpan draft caption & kampanye.", href: "/dashboard/ai-marketing", icon: Megaphone, category: "marketing", status: "beta" },
  { id: "riset", name: "AI Riset Bisnis", desc: "Catat temuan riset sendiri.", href: "/dashboard/ai-riset", icon: BarChart3, category: "marketing", status: "beta" },
  { id: "crm", name: "CRM Pelanggan", desc: "Database pelanggan perusahaan.", href: "/dashboard/crm-pelanggan", icon: Users, category: "marketing", status: "beta" },

  { id: "bisnis", name: "Multi Bisnis", desc: "Skincare, fashion, kuliner satu akun.", href: "/dashboard/multi-bisnis", icon: Layers, category: "platform", status: "live" },
  { id: "tim-komisi", name: "Tim dan Komisi Karyawan", desc: "Input sales & hitung komisi sendiri.", href: "/dashboard/tim-komisi", icon: Percent, category: "platform", status: "beta" },
  { id: "multi-platform", name: "Multi Platform", desc: "Atur WA, Telegram, website sendiri.", href: "/dashboard/multi-platform", icon: Smartphone, category: "platform", status: "beta" },
];

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  utama: "Utama",
  keuangan: "Keuangan",
  operasional: "Operasional",
  marketing: "Marketing",
  platform: "Platform",
  manajemen: "Manajemen",
  aplikasi: "Aplikasi",
};

export function getSidebarModules(
  bizType: string | null | undefined,
  flags?: { ai_kasir?: boolean; ai_jual_beli?: boolean; marketplace?: boolean; pajak?: boolean },
): { label: string; modules: DashboardModule[] }[] {
  const result: { label: string; modules: DashboardModule[] }[] = [];
  const hide = new Set<string>();
  if (flags?.ai_kasir === false) {
    hide.add("kasir");
    // F&B POS is separate from AI Kasir — keep fnb-kasir visible
  }
  if (flags?.ai_jual_beli === false) hide.add("ai-jual-beli");
  if (flags?.marketplace === false) {
    hide.add("marketplace");
    hide.add("marketplace-laporan");
  }
  if (flags?.pajak === false) hide.add("pajak");
  const keep = (m: DashboardModule) => !hide.has(m.id);

  const utama = GERCEP_MODULES.filter((m) => m.category === "utama" && keep(m));
  if (utama.length > 0) result.push({ label: CATEGORY_LABELS.utama, modules: utama });

  const normalized = normalizeBizType(bizType);
  if (normalized) {
    const bizSpecific = BIZ_MODULES.filter((m) => m.bizTypes?.includes(normalized) && keep(m));
    if (bizSpecific.length > 0) {
      result.push({
        label: BIZ_TYPE_LABELS[normalized] || normalized.replace(/_/g, " "),
        modules: bizSpecific,
      });
    }
  }

  const order: ModuleCategory[] = ["keuangan", "operasional", "marketing", "platform", "manajemen"];
  for (const cat of order) {
    const mods = GERCEP_MODULES.filter((m) => m.category === cat && keep(m));
    if (mods.length > 0) result.push({ label: CATEGORY_LABELS[cat], modules: mods });
  }

  const apps = GERCEP_MODULES.filter((m) => m.category === "aplikasi" && keep(m));
  if (apps.length > 0) result.push({ label: CATEGORY_LABELS.aplikasi, modules: apps });

  return result;
}
