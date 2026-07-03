export type HiIngredient = {
  quantity: number;
  products: { cost: number | null } | { cost: number | null }[] | null;
};

export type HiRecipe = {
  id: string;
  name: string;
  yield_quantity: number;
  recipe_ingredients: HiIngredient[];
};

function unwrapCost(products: HiIngredient["products"]): number {
  if (!products) return 0;
  const p = Array.isArray(products) ? products[0] : products;
  return Number(p?.cost || 0);
}

export function calcRecipeHppPerUnit(recipe: HiRecipe): number {
  if (!recipe.recipe_ingredients.length || recipe.yield_quantity <= 0) return 0;
  const total = recipe.recipe_ingredients.reduce(
    (s, ing) => s + unwrapCost(ing.products) * Number(ing.quantity),
    0,
  );
  return total / recipe.yield_quantity;
}

export function findRecipeForProduct(productName: string, recipes: HiRecipe[]): HiRecipe | undefined {
  const key = productName.trim().toLowerCase();
  return recipes.find(r => r.name.trim().toLowerCase() === key);
}

export function calcProductHpp(
  product: { name: string; cost: number | null; category: string | null },
  recipes: HiRecipe[],
): number {
  if (product.category !== "Produk Jadi") return Number(product.cost || 0);
  const recipe = findRecipeForProduct(product.name, recipes);
  if (recipe) return Math.round(calcRecipeHppPerUnit(recipe));
  return Math.round(Number(product.cost || 0));
}

export function calcMarginPct(hargaJual: number, hpp: number): number | null {
  if (!hargaJual || hargaJual <= 0) return null;
  return Math.round(((hargaJual - hpp) / hargaJual) * 100);
}

export function fmtRp(n: number): string {
  if (n >= 1_000_000) return "Rp" + (n / 1_000_000).toFixed(1).replace(".0", "") + "jt";
  if (n >= 1_000) return "Rp" + Math.round(n / 1_000) + "rb";
  return "Rp" + n.toLocaleString("id-ID");
}
