/** Retail POS (AI Kasir) — sellable SKUs only. Not F&B menus. */

const NON_SELLABLE_CATS = new Set(
  [
    "bahan baku",
    "bahan pendukung",
    "bahan menu",
    "bahan",
    "raw material",
    "ingredient",
    "saprotan",
  ].map((s) => s.toLowerCase()),
);

export function isNonSellableCategory(category: string | null | undefined): boolean {
  if (!category) return false;
  return NON_SELLABLE_CATS.has(category.trim().toLowerCase());
}

/** Produk siap dijual di kasir retail: punya harga jual > 0 dan bukan bahan baku. */
export function isRetailSellable(p: {
  price: number | null | undefined;
  category?: string | null;
}): boolean {
  const price = Number(p.price) || 0;
  if (price <= 0) return false;
  if (isNonSellableCategory(p.category)) return false;
  return true;
}
