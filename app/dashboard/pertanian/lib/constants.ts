export const HARVEST_CATEGORIES = ["Padi", "Sayuran", "Buah", "Palawija", "Komoditas Lain"];
export const SAPROTAN_CATEGORIES = ["Benih", "Pupuk", "Pestisida", "Herbisida", "Fungisida", "Insektisida", "Nutrisi", "Bibit"];
export const ALL_SAPROTAN_TYPES = SAPROTAN_CATEGORIES;

export const HARVEST_UNITS = ["kg", "ton", "karung", "kuintal", "liter", "pcs"];
export const SAPROTAN_UNITS = ["kg", "liter", "karung", "sak", "botol", "pcs"];

export const GRADE_OPTIONS = ["A", "B", "C", "Premium", "Standar", "Ekspor"];

export const FIELD_STATUS = [
  { value: "persemaian", label: "Persemaian", progress: 15 },
  { value: "pertumbuhan", label: "Pertumbuhan", progress: 40 },
  { value: "berbunga", label: "Berbunga", progress: 60 },
  { value: "berbuah", label: "Berbuah", progress: 80 },
  { value: "siap_panen", label: "Siap Panen", progress: 95 },
  { value: "panen", label: "Panen", progress: 100 },
] as const;

export const COST_CATEGORIES = [
  "Benih", "Pupuk", "Pestisida", "Tenaga Kerja", "Transportasi",
  "Sewa Lahan", "Listrik", "Air", "Lainnya",
];

export const SPRAYING_TYPES = ["Pestisida", "Herbisida", "Fungisida", "Insektisida", "Nutrisi", "Pupuk Daun"];

export const AGRI_TABS = [
  { id: "dashboard", label: "Dashboard", icon: "LayoutDashboard" },
  { id: "panen", label: "Hasil Panen", icon: "Wheat" },
  { id: "saprotan", label: "Saprotan", icon: "FlaskConical" },
  { id: "lahan", label: "Lahan", icon: "MapPin" },
  { id: "semprot", label: "Penyemprotan", icon: "Droplets" },
  { id: "biaya", label: "Biaya Produksi", icon: "Calculator" },
  { id: "insight", label: "Insight Gercep", icon: "Sparkles" },
] as const;

export type AgriTabId = (typeof AGRI_TABS)[number]["id"];

export const inputCls =
  "w-full px-3 py-2.5 rounded-xl bg-[#0A0A12] border border-white/10 text-[#F2F1F8] placeholder:text-[#8B8AA0] focus:outline-none focus:border-violet-500/40 text-sm";

export const cardCls = "bg-[#0F0F1A]/80 backdrop-blur-sm border border-white/10 rounded-2xl";

export function isHarvestCategory(cat: string | null) {
  if (!cat) return false;
  return HARVEST_CATEGORIES.some(c => cat.toLowerCase().includes(c.toLowerCase()));
}

export function isSaprotanCategory(cat: string | null) {
  if (!cat) return false;
  return SAPROTAN_CATEGORIES.some(c => cat.toLowerCase().includes(c.toLowerCase()));
}

export function fmtRp(n: number) {
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(1).replace(".0", "") + "jt";
  if (n >= 1_000) return "Rp" + Math.round(n / 1_000) + "rb";
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}

export function daysBetween(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.max(0, Math.round((d2.getTime() - d1.getTime()) / 86400000));
}
