import type { LucideIcon } from "lucide-react";
import {
  Wallet, Store, Calculator, FileText, Package, Receipt, QrCode, Camera,
  ShoppingCart, ShoppingBag, Megaphone, BarChart3, Users, LayoutDashboard, Layers, Percent,
  Smartphone, MessageCircle, Factory, Bird, Sprout, UtensilsCrossed,
} from "lucide-react";

export type ModuleStatus = "live" | "beta";
export type ModuleCategory = "utama" | "keuangan" | "operasional" | "marketing" | "platform" | "manajemen";

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

/** Setiap modul punya route & data sendiri — tidak digabung */
export const GERCEP_MODULES: DashboardModule[] = [
  { id: "owner", name: "Dashboard Owner", desc: "Tanya kondisi bisnis, AI jawab lengkap.", href: "/dashboard/owner", icon: LayoutDashboard, category: "utama", status: "live" },
  { id: "chat", name: "Gercep Chat", desc: "Pusat kendali semua modul lewat chat.", href: "/dashboard/chat", icon: MessageCircle, category: "utama", status: "live" },

  { id: "keuangan-pribadi", name: "Keuangan Pribadi", desc: "Catat pemasukan-pengeluaran, target tabungan.", href: "/dashboard/keuangan-pribadi", icon: Wallet, category: "keuangan", status: "live" },
  { id: "keuangan-bisnis", name: "Keuangan Bisnis", desc: "Modal, HPP, hutang-piutang, gaji karyawan.", href: "/dashboard/keuangan-bisnis", icon: Store, category: "keuangan", status: "live" },
  { id: "smart-profit", name: "Smart Profit Calculator", desc: "Profit bersih sampai break even point.", href: "/dashboard/smart-profit", icon: Calculator, category: "keuangan", status: "live" },
  { id: "pajak", name: "Pajak NPWP Center", desc: "Input NPWP & lapor omzet sendiri.", href: "/dashboard/pajak-npwp", icon: FileText, category: "keuangan", status: "beta" },

  { id: "inventory", name: "Inventory", desc: "Stok berkurang otomatis, notif kalau habis.", href: "/dashboard/inventory", icon: Package, category: "operasional", status: "live" },
  { id: "kasir", name: "AI Kasir", desc: "Struk, rekap kas, tutup shift otomatis.", href: "/dashboard/ai-kasir", icon: Receipt, category: "operasional", status: "live" },
  { id: "master-menu", name: "Master Menu", desc: "Kelola menu & resep sendiri.", href: "/dashboard/master-menu", icon: UtensilsCrossed, category: "operasional", status: "live", bizTypes: ["kuliner"] },
  { id: "barcode", name: "Barcode QR Analyzer", desc: "Daftar barcode & SKU sendiri.", href: "/dashboard/barcode-qr", icon: QrCode, category: "operasional", status: "beta" },
  { id: "ai-jual-beli", name: "AI Jual Beli", desc: "Input listing jual/beli sendiri.", href: "/dashboard/ai-jual-beli", icon: Camera, category: "operasional", status: "beta" },

  { id: "marketplace", name: "Marketplace Center", desc: "Daftar toko Shopee/Tokopedia sendiri.", href: "/dashboard/marketplace-center", icon: ShoppingCart, category: "marketing", status: "beta" },
  { id: "marketplace-laporan", name: "Marketplace", desc: "Upload CSV laporan marketplace, analisis otomatis.", href: "/dashboard/marketplace", icon: ShoppingBag, category: "manajemen", status: "live" },
  { id: "marketing", name: "AI Marketing", desc: "Simpan draft caption & kampanye.", href: "/dashboard/ai-marketing", icon: Megaphone, category: "marketing", status: "beta" },
  { id: "riset", name: "AI Riset Bisnis", desc: "Catat temuan riset sendiri.", href: "/dashboard/ai-riset", icon: BarChart3, category: "marketing", status: "beta" },
  { id: "crm", name: "CRM Pelanggan", desc: "Database pelanggan perusahaan.", href: "/dashboard/crm-pelanggan", icon: Users, category: "marketing", status: "beta" },

  { id: "bisnis", name: "Multi Bisnis", desc: "Skincare, fashion, kuliner satu akun.", href: "/dashboard/multi-bisnis", icon: Layers, category: "platform", status: "live" },
  { id: "karyawan", name: "Karyawan Toko", desc: "Kelola tim & link kasir karyawan.", href: "/dashboard/karyawan-toko", icon: Users, category: "platform", status: "live", bizTypes: ["kuliner"] },
  { id: "tim-komisi", name: "Tim dan Komisi Karyawan", desc: "Input sales & hitung komisi sendiri.", href: "/dashboard/tim-komisi", icon: Percent, category: "platform", status: "beta" },
  { id: "multi-platform", name: "Multi Platform", desc: "Atur WA, Telegram, website sendiri.", href: "/dashboard/multi-platform", icon: Smartphone, category: "platform", status: "beta" },

  { id: "produksi", name: "Produksi", desc: "Resep dan produksi home industry.", href: "/dashboard/produksi", icon: Factory, category: "manajemen", status: "live", bizTypes: ["homeindustry"] },
  { id: "ternak", name: "Manajemen Ternak", desc: "Batch, pakan, panen ternak.", href: "/dashboard/peternakan", icon: Bird, category: "manajemen", status: "live", bizTypes: ["ternak"] },
  { id: "pertanian", name: "Modul Pertanian", desc: "Lahan, panen, saprotan.", href: "/dashboard/pertanian", icon: Sprout, category: "manajemen", status: "live", bizTypes: ["pertanian"] },
];

const CATEGORY_LABELS: Record<ModuleCategory, string> = {
  utama: "MENU UTAMA",
  keuangan: "KEUANGAN DAN PAJAK",
  operasional: "OPERASIONAL TOKO",
  marketing: "MARKETPLACE DAN MARKETING",
  platform: "PLATFORM DAN TIM",
  manajemen: "MANAJEMEN",
};

export function getSidebarModules(bizType: string | null | undefined): { label: string; modules: DashboardModule[] }[] {
  const visible = GERCEP_MODULES.filter(m => {
    if (!m.bizTypes) return true;
    return bizType && m.bizTypes.includes(bizType);
  });

  const order: ModuleCategory[] = ["utama", "keuangan", "operasional", "marketing", "platform", "manajemen"];
  return order
    .map(cat => ({
      label: CATEGORY_LABELS[cat],
      modules: visible.filter(m => m.category === cat),
    }))
    .filter(g => g.modules.length > 0);
}
