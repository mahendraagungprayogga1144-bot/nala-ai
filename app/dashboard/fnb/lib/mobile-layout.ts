/** Tinggi bottom tab bar F&B (px, tanpa safe-area) */
export const FNB_NAV_HEIGHT_PX = 56;

export const FNB_NAV_BOTTOM_OFFSET = `calc(${FNB_NAV_HEIGHT_PX}px + env(safe-area-inset-bottom))`;

/** Padding bawah konten: nav + action bar */
export const FNB_MOBILE_PAGE_PAD = `calc(${FNB_NAV_HEIGHT_PX}px + 3.25rem + env(safe-area-inset-bottom))`;

/** Padding bawah konten: nav saja */
export const FNB_MOBILE_PAGE_PAD_NAV_ONLY = FNB_NAV_BOTTOM_OFFSET;
