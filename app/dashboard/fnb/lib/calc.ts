export type FnbProduct = { id: string; name: string; cost: number | null; stock: number; min_stock?: number; category?: string | null };
export type FnbMenuRecipe = { id: string; quantity: number; unit: string; products: FnbProduct };
export type FnbMenu = {
  id: string;
  nama: string;
  kategori?: string | null;
  harga_jual: number;
  yield_quantity: number;
  status?: string;
  foto_url?: string | null;
  menu_recipes: FnbMenuRecipe[];
};

export type CartLine = { menu: FnbMenu; qty: number };

export function unwrapProduct(products: FnbProduct | FnbProduct[] | null | undefined): FnbProduct | null {
  if (!products) return null;
  return Array.isArray(products) ? products[0] ?? null : products;
}

export function normalizeMenu(menu: Record<string, unknown> & { menu_recipes?: Array<Record<string, unknown> & { products?: FnbProduct | FnbProduct[] | null }> | null }): FnbMenu {
  const recipes = (menu.menu_recipes || []).map(r => {
    const p = unwrapProduct(r.products);
    return { id: String(r.id), quantity: Number(r.quantity), unit: String(r.unit || ""), products: p || { id: "", name: "?", cost: null, stock: 0, category: null } };
  }).filter(r => r.products.id);

  return {
    id: String(menu.id),
    nama: String(menu.nama),
    kategori: menu.kategori as string | null | undefined,
    harga_jual: Number(menu.harga_jual),
    yield_quantity: Number(menu.yield_quantity) || 1,
    status: menu.status as string | undefined,
    foto_url: (menu.foto_url ?? menu.photo_url) as string | null | undefined,
    menu_recipes: recipes,
  };
}

export function normalizeMenus(menus: Parameters<typeof normalizeMenu>[0][]): FnbMenu[] {
  return (menus || []).map(m => normalizeMenu(m));
}

export function recipeLineCost(r: FnbMenuRecipe): number {
  const p = unwrapProduct(r.products);
  return (Number(p?.cost) || 0) * Number(r.quantity);
}

export function calcHpp(menu: FnbMenu): number {
  const recipes = menu.menu_recipes || [];
  if (!recipes.length) return 0;
  const total = recipes.reduce((s, r) => s + recipeLineCost(r), 0);
  return total / (menu.yield_quantity || 1);
}

export function hppStatus(menu: FnbMenu): "no_recipe" | "no_cost" | "ok" {
  const recipes = menu.menu_recipes || [];
  if (!recipes.length) return "no_recipe";
  const hasCost = recipes.some(r => (unwrapProduct(r.products)?.cost || 0) > 0);
  return hasCost ? "ok" : "no_cost";
}

export function calcMargin(menu: FnbMenu) {
  const status = hppStatus(menu);
  if (status !== "ok" || menu.harga_jual <= 0) return null;
  const hpp = calcHpp(menu);
  const laba = menu.harga_jual - hpp;
  return { hpp, laba, marginPct: Math.round((laba / menu.harga_jual) * 100), isLoss: laba < 0 };
}

export function fmtRp(n: number) {
  if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
  if (n >= 1_000) return `Rp${Math.round(n / 1_000)}rb`;
  return `Rp${n.toLocaleString("id-ID")}`;
}

export function getStockShortages(cart: CartLine[]) {
  const map: Record<string, { name: string; needed: number; stock: number }> = {};
  for (const item of cart) {
    if (!item.menu.menu_recipes.length) continue;
    for (const r of item.menu.menu_recipes) {
      const p = unwrapProduct(r.products);
      if (!p) continue;
      const needed = (r.quantity / (item.menu.yield_quantity || 1)) * item.qty;
      if (!map[p.id]) map[p.id] = { name: p.name, needed: 0, stock: p.stock };
      map[p.id].needed += needed;
    }
  }
  return Object.values(map).filter(x => x.stock < x.needed);
}
