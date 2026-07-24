/** Path prefixes blocked when a feature flag is off. */
export function blockedPathForFlags(
  pathname: string,
  flags?: {
    ai_kasir?: boolean;
    ai_jual_beli?: boolean;
    marketplace?: boolean;
    pajak?: boolean;
  },
): boolean {
  if (!flags) return false;
  // AI Kasir only — do NOT gate real F&B POS behind this flag
  if (flags.ai_kasir === false) {
    if (pathname.startsWith("/dashboard/ai-kasir")) {
      return true;
    }
  }
  if (flags.ai_jual_beli === false) {
    if (pathname.startsWith("/dashboard/ai-jual-beli")) return true;
  }
  if (flags.marketplace === false) {
    // Marketplace modules only — jangan blok hub Online Shop (jenis bisnis olshop)
    if (
      pathname.startsWith("/dashboard/marketplace") ||
      pathname.startsWith("/dashboard/marketplace-center")
    ) {
      return true;
    }
  }
  if (flags.pajak === false) {
    if (pathname.startsWith("/dashboard/pajak-npwp")) return true;
  }
  return false;
}
