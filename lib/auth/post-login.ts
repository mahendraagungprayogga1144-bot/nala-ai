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

export function homeForBizType(type: string | null | undefined) {
  if (!type) return "/dashboard/inventory";
  return BIZ_HOME[type] || "/dashboard/inventory";
}

/** Cookies that let middleware skip repeated DB checks on the next request. */
export function setFastGateCookies(opts?: { businessId?: string; isKasir?: boolean }) {
  const maxAge = 60 * 60 * 24 * 30;
  const short = 300;
  document.cookie = `ob_done=1; path=/; max-age=${maxAge}; samesite=lax`;
  document.cookie = `role_checked=${opts?.isKasir ? "kasir" : "owner"}; path=/; max-age=${60 * 60 * 24 * 7}; samesite=lax`;
  document.cookie = `sub_checked=1; path=/; max-age=${short}; samesite=lax`;
  if (opts?.businessId) {
    document.cookie = `active_business_id=${opts.businessId}; path=/; max-age=${maxAge}; samesite=lax`;
  }
}
