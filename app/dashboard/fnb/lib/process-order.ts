import { todayWib } from "@/lib/date";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CartLine } from "./calc";
import { getStockShortages } from "./calc";

export type StockApply = { productId: string; prevStock: number; qty: number };

export async function restoreStockApplies(
  supabase: SupabaseClient,
  applied: StockApply[],
) {
  for (const a of applied) {
    await supabase.from("products").update({ stock: a.prevStock }).eq("id", a.productId);
  }
}

/**
 * Deduct recipe BOM stock with optimistic concurrency.
 * On any failure, returns ok:false — caller must NOT print receipt / claim success.
 * On later finance failure, caller should restoreStockApplies(result.applied).
 */
export async function deductStockForSale(
  supabase: SupabaseClient,
  cart: CartLine[],
  userId: string,
  opts?: { today?: string; notePrefix?: string },
): Promise<{ ok: boolean; errors: string[]; applied: StockApply[] }> {
  const today = opts?.today || todayWib();
  const prefix = opts?.notePrefix || "Kasir";
  const errors: string[] = [];
  const applied: StockApply[] = [];

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
      const prev = Number(prod.stock);
      if (prev < needed) {
        errors.push(`${prod.name} (butuh ${needed.toFixed(1)}, stok ${prev})`);
        continue;
      }

      const newStock = prev - needed;
      const { data: updated, error: upErr } = await supabase
        .from("products")
        .update({ stock: newStock })
        .eq("id", prod.id)
        .eq("stock", prev)
        .select("id")
        .maybeSingle();

      if (upErr || !updated) {
        errors.push(`${prod.name} (stok berubah — coba lagi)`);
        continue;
      }

      applied.push({ productId: prod.id, prevStock: prev, qty: needed });

      const { error: movErr } = await supabase.from("stock_movements").insert({
        user_id: userId,
        product_id: prod.id,
        type: "keluar",
        reason: "terpakai",
        quantity: needed,
        note: `${prefix}: ${item.menu.nama} x${item.qty}`,
        movement_date: today,
      });
      if (movErr) {
        errors.push(`${prod.name} (mutasi gagal)`);
      }
    }
  }

  if (errors.length > 0) {
    if (applied.length > 0) await restoreStockApplies(supabase, applied);
    return { ok: false, errors, applied: [] };
  }

  return { ok: true, errors: [], applied };
}

export function validateCartStock(cart: CartLine[]) {
  const shortages = getStockShortages(cart);
  if (!shortages.length) return { ok: true as const };
  const msg = shortages
    .map((s) => `${s.name} (butuh ${s.needed.toFixed(1)}, stok ${s.stock})`)
    .join(", ");
  return { ok: false as const, message: `Stok bahan kurang: ${msg}` };
}
