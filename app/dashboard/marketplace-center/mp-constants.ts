export const PLATFORMS = ["Shopee", "Tokopedia", "TikTok Shop", "Lazada", "Bukalapak"] as const;

export const PLATFORM_COLOR: Record<string, string> = {
  Shopee: "#EE4D2D",
  Tokopedia: "#42B549",
  "TikTok Shop": "#FF0050",
  Lazada: "#0F146D",
  Bukalapak: "#E31E52",
};

export const ORDER_STATUS = ["baru", "proses", "kirim", "selesai", "batal"] as const;
export type OrderStatus = (typeof ORDER_STATUS)[number];

export const STATUS_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  baru: { bg: "rgba(56,189,248,.12)", text: "#38BDF8", border: "rgba(56,189,248,.3)" },
  proses: { bg: "rgba(251,191,36,.12)", text: "#FBBF24", border: "rgba(251,191,36,.3)" },
  kirim: { bg: "rgba(167,139,250,.12)", text: "#A78BFA", border: "rgba(167,139,250,.3)" },
  selesai: { bg: "rgba(74,222,128,.12)", text: "#4ADE80", border: "rgba(74,222,128,.3)" },
  batal: { bg: "rgba(244,63,94,.12)", text: "#F43F5E", border: "rgba(244,63,94,.3)" },
};

export function platformColor(p: string | null): string {
  return PLATFORM_COLOR[p || ""] || "#8B8AA0";
}

export function fmtRp(n: number): string {
  return "Rp" + Math.round(n).toLocaleString("id-ID");
}
