import { todayWib } from "@/lib/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "./calc";
import { getStockShortages } from "./calc";

export async function deductStockForSale(
  supabase: SupabaseClient,
  cart: CartLine[],
  userId: string,
  opts?: { today?: string; notePrefix?: string },
) {
  const today = opts?.today || todayWib();
  const prefix = opts?.notePrefix || "Kasir";
  const errors: string[] = [];

  for (const item of cart) {
    for (const r of item.menu.menu_recipes) {
      const needed = (r.quantity / (item.menu.yield_quantity || 1)) * item.qty;
      const { data: prod, error: readErr } = await supabase
        .from("products")
        .select("id, stock, name")
        .eq("id", r.products.id)
        .single();
      if (readErr || !prod) {
        errors.push(r.products?.name || "bahan");
        continue;
      }
      if (Number(prod.stock) < needed) {
        errors.push(`${prod.name} (butuh ${needed.toFixed(1)}, stok ${prod.stock})`);
        continue;
      }

      const { error: upErr } = await supabase
        .from("products")
        .update({ stock: Number(prod.stock) - needed })
        .eq("id", prod.id);
      if (upErr) {
        errors.push(prod.name);
        continue;
      }

      await supabase.from("stock_movements").insert({
        user_id: userId,
        product_id: prod.id,
        type: "keluar",
        reason: "terpakai",
        quantity: needed,
        note: `${prefix}: ${item.menu.nama} x${item.qty}`,
        movement_date: today,
      });
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateCartStock(cart: CartLine[]) {
  const shortages = getStockShortages(cart);
  if (!shortages.length) return { ok: true as const };
  const msg = shortages
    .map(s => `${s.name} (butuh ${s.needed.toFixed(1)}, stok ${s.stock})`)
    .join(", ");
  return { ok: false as const, message: `Stok bahan kurang: ${msg}` };
}
