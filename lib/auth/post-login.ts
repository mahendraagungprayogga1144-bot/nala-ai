/** Destinations after login / onboarding — lighter than /dashboard/owner. */
export const BIZ_HOME: Record<string, string> = {
  kuliner: "/dashboard/inventory",
  homeindustry: "/dashboard/inventory",
  ternak: "/dashboard/peternakan",
  pertanian: "/dashboard/pertanian",
  retail: "/dashboard/retail",
  jasa: "/dashboard/jasa",
  wholesale: "/dashboard/wholesale",
  olshop: "/dashboard/olshop",
  kesehatan: "/dashboard/kesehatan",
  bengkel: "/dashboard/bengkel",
};

/** Custom / legacy labels → canonical type keys used in hubs & registry. */
const TYPE_ALIASES: Record<string, string> = {
  peternakan: "ternak",
  farm: "ternak",
  livestock: "ternak",
  ternak_ayam: "ternak",
  fnb: "kuliner",
  "f&b": "kuliner",
  food: "kuliner",
  restoran: "kuliner",
  warung: "kuliner",
  agriculture: "pertanian",
  agri: "pertanian",
  kebun: "pertanian",
  toko: "retail",
  shop: "retail",
  fashion: "retail",
  online_shop: "olshop",
  online: "olshop",
  apotek: "kesehatan",
  klinik: "kesehatan",
  workshop: "bengkel",
  otomotif: "bengkel",
  grosir: "wholesale",
  distributor: "wholesale",
};

export function normalizeBizType(type: string | null | undefined): string {
  if (!type) return "";
  const t = type.trim().toLowerCase().replace(/\s+/g, "_");
  return TYPE_ALIASES[t] || t;
}

export function homeForBizType(type: string | null | undefined) {
  const key = normalizeBizType(type);
  if (!key) return "/dashboard/inventory";
  return BIZ_HOME[key] || "/dashboard/inventory";
}

/** Clear gate cookies so a new login cannot inherit another user's active business / role. */
export function clearFastGateCookies() {
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  const expire = `path=/; max-age=0; samesite=lax${secure}`;
  document.cookie = `ob_done=; ${expire}`;
  document.cookie = `role_checked=; ${expire}`;
  document.cookie = `sub_checked=; ${expire}`;
  document.cookie = `sub_expired=; ${expire}`;
  document.cookie = `trial_days_left=; ${expire}`;
  document.cookie = `active_business_id=; ${expire}`;
}

/** Cookies that let middleware skip repeated DB checks on the next request. */
export function setFastGateCookies(opts?: { businessId?: string; isKasir?: boolean }) {
  const maxAge = 60 * 60 * 24 * 30;
  const short = 300;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:" ? "; secure" : "";
  // Always reset gates first — never leave a prior user's business/role cookie.
  clearFastGateCookies();
  document.cookie = `ob_done=1; path=/; max-age=${maxAge}; samesite=lax${secure}`;
  document.cookie = `role_checked=${opts?.isKasir ? "kasir" : "owner"}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax${secure}`;
  document.cookie = `sub_checked=1; path=/; max-age=${short}; samesite=lax${secure}`;
  if (opts?.businessId) {
    document.cookie = `active_business_id=${opts.businessId}; path=/; max-age=${maxAge}; samesite=lax${secure}`;
  }
}
