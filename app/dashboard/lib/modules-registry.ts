import type { LucideIcon } from "lucide-react";
import {
  Wallet, Store, Calculator, FileText, Package, Receipt, QrCode, Camera,
  ShoppingCart, Megaphone, BarChart3, Users, LayoutDashboard, Layers, Percent,
  Smartphone, MessageCircle, Factory, Bird, Sprout,
} from "lucide-react";

export type ModuleStatus = "live" | "beta";
export type ModuleCategory = "utama" | "keuangan" | "operasional" | "marketing" | "platform" | "manajemen" | "fnb";

export type DashboardModule = {
  id: string;
  name: string;
  desc: string;
  href: string;
  icon: LucideIcon;
  category: ModuleCategory;
  status: ModuleStatus;
  /** Hanya tampil kalau bisnis aktif punya type ini */
  bizTypes?: string[];
};

export const GERCEP_MODULES: DashboardModule[] = [
  { id: "owner", name: "Dashboard Owner", desc: "Tanya kondisi bisnis, AI jawab lengkap.", href: "/dashboard/owner", icon: LayoutDashboard, category: "utama", status: "live" },
  { id: "chat", name: "Gercep Chat", desc: "Pusat kendali semua modul lewat chat.", href: "/dashboard/chat", icon: MessageCircle, category: "utama", status: "live" },

  { id: "keuangan-pribadi", name: "Keuangan Pribadi", desc: "Catat pemasukan-pengeluaran, target tabungan.", href: "/dashboard/keuangan-pribadi", icon: Wallet, category: "keuangan", status: "live" },
  { id: "keuangan-bisnis", name: "Keuangan Bisnis", desc: "Modal, HPP, hutang-piutang, gaji karyawan.", href: "/dashboard/keuangan-bisnis", icon: Store, category: "keuangan", status: "live" },
  { id: "smart-profit", name: "Smart Profit Calculator", desc: "Profit bersih sampai break even point.", href: "/dashboard/smart-profit", icon: Calculator, category: "keuangan", status: "live" },
  { id: "pajak", name: "Pajak NPWP Center", desc: "Rekap omzet, siap buat lapor pajak.", href: "/dashboard/pajak", icon: FileText, category: "keuangan", status: "beta" },

  { id: "inventory", name: "Inventory", desc: "Stok berkurang otomatis, notif kalau habis.", href: "/dashboard/inventory", icon: Package, category: "operasional", status: "live" },
  { id: "kasir", name: "AI Kasir", desc: "Struk, rekap kas, tutup shift otomatis.", href: "/dashboard/kasir", icon: Receipt, category: "operasional", status: "live", bizTypes: ["kuliner"] },
  { id: "barcode", name: "Barcode QR Analyzer", desc: "Scan barcode, cek info dan keaslian.", href: "/dashboard/barcode", icon: QrCode, category: "operasional", status: "beta" },
  { id: "ai-jual-beli", name: "AI Jual Beli", desc: "Foto barang, AI estimasi harga pasar.", href: "/dashboard/ai-jual-beli", icon: Camera, category: "operasional", status: "beta" },

  { id: "marketplace", name: "Marketplace Center", desc: "Shopee, TikTok Shop, Tokopedia jadi satu.", href: "/dashboard/marketplace", icon: ShoppingCart, category: "marketing", status: "beta" },
  { id: "marketing", name: "AI Marketing", desc: "Caption, broadcast WA, kalender konten.", href: "/dashboard/marketing", icon: Megaphone, category: "marketing", status: "beta" },
  { id: "riset", name: "AI Riset Bisnis", desc: "Tren pasar, kompetitor, peluang usaha.", href: "/dashboard/riset", icon: BarChart3, category: "marketing", status: "beta" },
  { id: "crm", name: "CRM Pelanggan", desc: "Riwayat order, follow up otomatis.", href: "/dashboard/crm", icon: Users, category: "marketing", status: "beta" },

  { id: "bisnis", name: "Multi Bisnis", desc: "Skincare, fashion, kuliner satu akun.", href: "/dashboard/bisnis", icon: Layers, category: "platform", status: "live" },
  { id: "tim-komisi", name: "Tim dan Komisi Karyawan", desc: "Rekap penjualan per sales, hitung komisi.", href: "/dashboard/tim-komisi", icon: Percent, category: "platform", status: "beta" },
  { id: "multi-platform", name: "Multi Platform", desc: "Website, WhatsApp Bot, Telegram Bot.", href: "/dashboard/multi-platform", icon: Smartphone, category: "platform", status: "beta" },

  // Manajemen per tipe bisnis
  { id: "produksi", name: "Produksi", desc: "Resep dan produksi home industry.", href: "/dashboard/produksi", icon: Factory, category: "manajemen", status: "live", bizTypes: ["homeindustry"] },
  { id: "ternak", name: "Manajemen Ternak", desc: "Batch, pakan, panen ternak.", href: "/dashboard/peternakan", icon: Bird, category: "manajemen", status: "live", bizTypes: ["ternak"] },
  { id: "pertanian", name: "Modul Pertanian", desc: "Lahan, panen, saprotan.", href: "/dashboard/pertanian", icon: Sprout, category: "manajemen", status: "live", bizTypes: ["pertanian"] },
  { id: "menu", name: "Master Menu", desc: "Menu, resep, HPP kuliner.", href: "/dashboard/fnb/menu", icon: Receipt, category: "fnb", status: "live", bizTypes: ["kuliner"] },
  { id: "karyawan", name: "Karyawan", desc: "Tim kasir dan link karyawan.", href: "/dashboard/fnb/karyawan", icon: Users, category: "fnb", status: "live", bizTypes: ["kuliner"] },
];

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  utama: "MENU UTAMA",
  keuangan: "KEUANGAN DAN PAJAK",
  operasional: "OPERASIONAL TOKO",
  marketing: "MARKETPLACE DAN MARKETING",
  platform: "PLATFORM DAN TIM",
  manajemen: "MANAJEMEN",
  fnb: "F&B KULINER",
};

export function getSidebarModules(bizType: string | null | undefined): { label: string; modules: DashboardModule[] }[] {
  const visible = GERCEP_MODULES.filter(m => {
    if (!m.bizTypes) return true;
    return bizType && m.bizTypes.includes(bizType);
  });

  const order: ModuleCategory[] = ["utama", "keuangan", "operasional", "marketing", "platform", "manajemen", "fnb"];
  return order
    .map(cat => ({
      label: CATEGORY_LABELS[cat],
      modules: visible.filter(m => m.category === cat),
    }))
    .filter(g => g.modules.length > 0);
}

/** Modul homepage (tanpa sub-route manajemen per tipe) */
export const HOMEPAGE_MODULES = GERCEP_MODULES.filter(
  m => !["menu", "karyawan", "produksi", "ternak", "pertanian"].includes(m.id),
);
