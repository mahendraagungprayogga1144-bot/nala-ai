import { normalizeBizType } from "@/lib/auth/post-login";

const LABELS: Record<string, string> = {
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

export function bizTypeLabel(type: string | null | undefined): string {
  const key = normalizeBizType(type);
  if (!key) return "Bisnis";
  return LABELS[key] || key.replace(/_/g, " ");
}
